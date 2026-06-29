/**
 * Cron: Monthly affiliate payout processor
 *
 * Runs on the 1st of each month at 09:00 UTC (configured in vercel.json).
 * Also callable manually via POST with CRON_SECRET for on-demand payouts.
 *
 * Steps:
 *  1. Move commissions from `pending` → `available` when available_at has passed
 *  2. For each referrer with available commissions + affiliate_onboarded=true:
 *     a. Create Stripe transfer to their Connect account
 *     b. Insert affiliate_payouts row
 *     c. Mark commissions as `paid`
 *
 * Prerequisite: Stripe account must be set to manual payouts
 * (dashboard.stripe.com/settings/payouts → Manual)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { affiliateCommissions, affiliatePayouts, users } from '@/lib/db/schema'
import { eq, lte, inArray, and } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { affiliatePayoutEmail } from '@/lib/email/templates'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stripe = getStripe()
  const now = new Date()
  const nowIso = now.toISOString()

  // ── Step 1: pending → available ───────────────────────────────────────────
  const released = await db.update(affiliateCommissions)
    .set({ status: 'available', updatedAt: now })
    .where(and(
      eq(affiliateCommissions.status, 'pending'),
      lte(affiliateCommissions.availableAt, now)
    ))
    .returning({ id: affiliateCommissions.id })
    .catch(() => [])

  console.log(`[affiliate-payouts] released ${released.length} commissions to available`)

  // ── Step 2: fetch all available commissions ───────────────────────────────
  let commissions: { id: string; referrerId: string; commissionAmount: number }[]
  try {
    commissions = await db
      .select({ id: affiliateCommissions.id, referrerId: affiliateCommissions.referrerId, commissionAmount: affiliateCommissions.commissionAmount })
      .from(affiliateCommissions)
      .where(eq(affiliateCommissions.status, 'available'))
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (commissions.length === 0) {
    return NextResponse.json({ message: 'Keine fälligen Provisionen.', paid: 0, skipped: 0 })
  }

  // ── Step 3: load referrer profiles ───────────────────────────────────────
  const referrerIds = [...new Set(commissions.map(c => c.referrerId))]
  const referrers = await db
    .select({ id: users.id, email: users.email, username: users.username, stripeConnectId: users.stripeConnectId, affiliateOnboarded: users.affiliateOnboarded })
    .from(users)
    .where(inArray(users.id, referrerIds))

  const referrerMap = new Map(referrers.map(r => [r.id, r]))

  // ── Step 4: group by referrer ─────────────────────────────────────────────
  const grouped = new Map<string, { commissionIds: string[]; totalAmount: number }>()
  for (const c of commissions) {
    const g = grouped.get(c.referrerId)
    if (g) {
      g.commissionIds.push(c.id)
      g.totalAmount += c.commissionAmount
    } else {
      grouped.set(c.referrerId, { commissionIds: [c.id], totalAmount: c.commissionAmount })
    }
  }

  const results: { referrer: string; status: string; amount?: number; error?: string }[] = []

  // ── Step 5: transfer per referrer ─────────────────────────────────────────
  for (const [referrerId, { commissionIds, totalAmount }] of grouped) {
    const referrer = referrerMap.get(referrerId)

    if (!referrer?.affiliateOnboarded || !referrer.stripeConnectId) {
      results.push({ referrer: referrer?.username ?? referrerId, status: 'skipped_no_connect' })
      continue
    }

    if (totalAmount < 100) {
      // Minimum €1.00 to avoid Stripe fees eating the commission
      results.push({ referrer: referrer.username ?? referrerId, status: 'skipped_below_minimum', amount: totalAmount })
      continue
    }

    // Idempotency key = sorted commission IDs — prevents double-transfer if DB update fails after Stripe success
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

      const periodStart = new Date()
      periodStart.setDate(1)
      periodStart.setHours(0, 0, 0, 0)

      try {
        await db.insert(affiliatePayouts).values({
          referrerId: referrer.id,
          commissionIds,
          totalAmount,
          commissionCount: commissionIds.length,
          stripeTransferId: transfer.id,
          status: 'completed',
          periodStart: periodStart.toISOString().slice(0, 10),
          periodEnd: nowIso.slice(0, 10),
          paidAt: now,
        })
      } catch (err) {
        console.error(`[affiliate-payouts] payout insert error for ${referrer.username}:`, err)
      }

      await db.update(affiliateCommissions)
        .set({ status: 'paid', paidAt: now, updatedAt: now })
        .where(inArray(affiliateCommissions.id, commissionIds))

      results.push({ referrer: referrer.username ?? referrerId, status: 'paid', amount: totalAmount })
      console.log(`[affiliate-payouts] paid ${totalAmount} cents to ${referrer.username} (${transfer.id})`)

      // Notify affiliate by email (fire-and-forget)
      if (referrer.email) {
        getResend().emails.send({
          from: FROM_EMAIL,
          to: referrer.email,
          subject: `Deine Provision wurde ausgezahlt – FinestSites`,
          html: affiliatePayoutEmail({ amountCents: totalAmount, commissionCount: commissionIds.length }),
        }).catch(err => console.error(`[affiliate-payouts] payout email error for ${referrer.username}:`, err))
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[affiliate-payouts] transfer failed for ${referrer.username}:`, message)
      results.push({ referrer: referrer.username ?? referrerId, status: 'error', error: message })
    }
  }

  const paid = results.filter(r => r.status === 'paid').length
  const skipped = results.filter(r => r.status !== 'paid').length

  return NextResponse.json({ results, paid, skipped })
}
