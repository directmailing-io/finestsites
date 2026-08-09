/**
 * Shared affiliate payout engine — single source of truth for the payout rules.
 * Used by the monthly cron, the admin trigger and the self-service payout route.
 *
 * Rules (Spec):
 *  - Minimum payout: 10 € (1000 cents). Below that the balance carries over.
 *  - Max ONE payout per affiliate per calendar month.
 *  - Payout only if the Stripe Connect account is verified AND payouts_enabled
 *    (live check against Stripe, not just our DB flag).
 *  - Negative bookings (chargebacks after payout) offset the balance.
 *    No payout while the balance is negative or below the minimum.
 *  - Only the computed commission is transferred — never customer revenue.
 *  - All amounts are integer cents.
 */

import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { affiliateCommissions, affiliatePayouts, users } from '@/lib/db/schema'
import { eq, and, lte, gte, inArray } from 'drizzle-orm'
import { sendEmail } from '@/lib/resend'
import { affiliatePayoutEmail } from '@/lib/email/templates'

export const PAYOUT_MINIMUM_CENTS = 1000

export interface PayoutResult {
  referrer: string
  status:
    | 'paid'
    | 'skipped_no_connect'
    | 'skipped_not_verified'
    | 'skipped_below_minimum'
    | 'skipped_negative_balance'
    | 'skipped_already_paid_this_month'
    | 'skipped_no_commissions'
    | 'error'
  amount?: number
  error?: string
}

interface ReferrerProfile {
  id: string
  email: string | null
  username: string | null
  stripeConnectId: string | null
  affiliateOnboarded: boolean | null
}

/** Release matured commissions (pending → available once the hold has passed). */
export async function releaseMaturedCommissions(referrerId?: string): Promise<number> {
  const now = new Date()
  const conditions = [
    eq(affiliateCommissions.status, 'pending'),
    lte(affiliateCommissions.availableAt, now),
  ]
  if (referrerId) conditions.push(eq(affiliateCommissions.referrerId, referrerId))

  const released = await db.update(affiliateCommissions)
    .set({ status: 'available', updatedAt: now })
    .where(and(...conditions))
    .returning({ id: affiliateCommissions.id })
    .catch(() => [])
  return released.length
}

/** True if this referrer already received a payout in the current calendar month. */
async function hasPayoutThisMonth(referrerId: string, now: Date): Promise<boolean> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const rows = await db
    .select({ id: affiliatePayouts.id })
    .from(affiliatePayouts)
    .where(and(
      eq(affiliatePayouts.referrerId, referrerId),
      inArray(affiliatePayouts.status, ['completed', 'paid', 'processing']),
      gte(affiliatePayouts.createdAt, monthStart),
    ))
    .limit(1)
  return rows.length > 0
}

/**
 * Process the payout for one referrer. All guards included.
 * Pass `enforceMonthlyLimit: false` never — the limit is part of the spec;
 * the parameter does not exist on purpose.
 */
export async function processReferrerPayout(
  stripe: Stripe,
  referrer: ReferrerProfile,
): Promise<PayoutResult> {
  const now = new Date()
  const name = referrer.username ?? referrer.id

  if (!referrer.affiliateOnboarded || !referrer.stripeConnectId) {
    return { referrer: name, status: 'skipped_no_connect' }
  }

  // Live verification: account must be fully verified and payouts enabled.
  try {
    const account = await stripe.accounts.retrieve(referrer.stripeConnectId)
    const disabledReason = (account.requirements as any)?.disabled_reason ?? null
    if (!account.payouts_enabled || disabledReason) {
      return { referrer: name, status: 'skipped_not_verified' }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'account retrieve failed'
    return { referrer: name, status: 'error', error: message }
  }

  // Max one payout per calendar month.
  if (await hasPayoutThisMonth(referrer.id, now)) {
    return { referrer: name, status: 'skipped_already_paid_this_month' }
  }

  // All available commissions, including negative chargeback bookings.
  const commissions = await db
    .select({
      id: affiliateCommissions.id,
      commissionAmount: affiliateCommissions.commissionAmount,
      grossAmount: affiliateCommissions.grossAmount,
    })
    .from(affiliateCommissions)
    .where(and(
      eq(affiliateCommissions.referrerId, referrer.id),
      eq(affiliateCommissions.status, 'available'),
    ))

  if (commissions.length === 0) {
    return { referrer: name, status: 'skipped_no_commissions' }
  }

  // Safety: a commission may never exceed the customer revenue it is based on.
  for (const c of commissions) {
    if (Math.abs(c.commissionAmount) > Math.abs(c.grossAmount)) {
      console.error(`[affiliate-payout] SANITY VIOLATION commission ${c.id}: ${c.commissionAmount} > gross ${c.grossAmount}`)
      return { referrer: name, status: 'error', error: 'sanity_check_failed' }
    }
  }

  const totalAmount = commissions.reduce((s, c) => s + c.commissionAmount, 0)
  const commissionIds = commissions.map(c => c.id)

  if (totalAmount < 0) {
    return { referrer: name, status: 'skipped_negative_balance', amount: totalAmount }
  }
  if (totalAmount < PAYOUT_MINIMUM_CENTS) {
    return { referrer: name, status: 'skipped_below_minimum', amount: totalAmount }
  }

  // Idempotency key = sorted commission IDs — prevents double transfer
  // if the DB update fails after the Stripe call succeeded.
  const idempotencyKey = `payout-${[...commissionIds].sort().join('-')}`

  try {
    const transfer = await stripe.transfers.create({
      amount: totalAmount,
      currency: 'eur',
      destination: referrer.stripeConnectId,
      description: `FinestSites Affiliate Provision – ${referrer.username}`,
      metadata: {
        referrer_id: referrer.id,
        referrer_username: referrer.username ?? '',
        commission_ids: commissionIds.join(','),
      },
    }, { idempotencyKey })

    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)

    let payoutId: string | null = null
    try {
      const inserted = await db.insert(affiliatePayouts).values({
        referrerId: referrer.id,
        commissionIds,
        totalAmount,
        commissionCount: commissionIds.length,
        stripeTransferId: transfer.id,
        status: 'completed',
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: now.toISOString().slice(0, 10),
        paidAt: now,
      }).returning({ id: affiliatePayouts.id })
      payoutId = inserted[0]?.id ?? null
    } catch (err) {
      console.error(`[affiliate-payout] payout insert error for ${name}:`, err)
    }

    await db.update(affiliateCommissions)
      .set({ status: 'paid', paidAt: now, updatedAt: now, ...(payoutId ? { payoutId } : {}) })
      .where(inArray(affiliateCommissions.id, commissionIds))

    if (referrer.email) {
      sendEmail({
        to: referrer.email,
        subject: 'Deine Provision ist unterwegs – FinestSites',
        html: affiliatePayoutEmail({ amountCents: totalAmount, commissionCount: commissionIds.length }),
        type: 'affiliate_payout',
      }).catch(() => {})
    }

    console.log(`[affiliate-payout] paid ${totalAmount} cents to ${name} (${transfer.id})`)
    return { referrer: name, status: 'paid', amount: totalAmount }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[affiliate-payout] transfer failed for ${name}:`, message)
    return { referrer: name, status: 'error', error: message }
  }
}

/** Full payout run over all referrers with available commissions (cron/admin). */
export async function runPayoutBatch(stripe: Stripe): Promise<{ results: PayoutResult[]; released: number }> {
  const released = await releaseMaturedCommissions()

  const available = await db
    .select({ referrerId: affiliateCommissions.referrerId })
    .from(affiliateCommissions)
    .where(eq(affiliateCommissions.status, 'available'))

  const referrerIds = [...new Set(available.map(c => c.referrerId))]
  if (referrerIds.length === 0) return { results: [], released }

  const referrers = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      stripeConnectId: users.stripeConnectId,
      affiliateOnboarded: users.affiliateOnboarded,
    })
    .from(users)
    .where(inArray(users.id, referrerIds))

  const results: PayoutResult[] = []
  for (const referrer of referrers) {
    results.push(await processReferrerPayout(stripe, referrer))
  }
  return { results, released }
}
