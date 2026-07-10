/**
 * POST /api/admin/affiliate/trigger-payout
 * Admin-only: immediately processes payouts for all affiliates with available commissions.
 * Reuses the same logic as the monthly cron job.
 */

import { NextResponse } from 'next/server'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, affiliateCommissions, affiliatePayouts } from '@/lib/db/schema'
import { eq, and, lte, inArray } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { affiliatePayoutEmail } from '@/lib/email/templates'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'info@daniel-kurzeja.de'

export async function POST(req: Request) {
  const user = await getRealUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const stripe = getStripe()
  const now = new Date()

  // Step 1: move pending → available where available_at has passed
  await db.update(affiliateCommissions)
    .set({ status: 'available', updatedAt: now })
    .where(and(
      eq(affiliateCommissions.status, 'pending'),
      lte(affiliateCommissions.availableAt, now)
    ))

  // Step 2: fetch all available commissions
  const commissions = await db
    .select({ id: affiliateCommissions.id, referrerId: affiliateCommissions.referrerId, commissionAmount: affiliateCommissions.commissionAmount })
    .from(affiliateCommissions)
    .where(eq(affiliateCommissions.status, 'available'))

  if (commissions.length === 0) {
    return NextResponse.json({ message: 'Keine fälligen Provisionen.', paid: 0, skipped: 0 })
  }

  // Step 3: load referrer profiles
  const referrerIds = [...new Set(commissions.map(c => c.referrerId))]
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

  const referrerMap = new Map(referrers.map(r => [r.id, r]))

  // Step 4: group by referrer
  const grouped = new Map<string, { commissionIds: string[]; totalAmount: number }>()
  for (const c of commissions) {
    const g = grouped.get(c.referrerId)
    if (g) { g.commissionIds.push(c.id); g.totalAmount += c.commissionAmount }
    else grouped.set(c.referrerId, { commissionIds: [c.id], totalAmount: c.commissionAmount })
  }

  const results: { referrer: string; status: string; amount?: number; error?: string }[] = []

  // Step 5: transfer per referrer
  for (const [referrerId, { commissionIds, totalAmount }] of grouped) {
    const referrer = referrerMap.get(referrerId)

    if (!referrer?.affiliateOnboarded || !referrer.stripeConnectId) {
      results.push({ referrer: referrer?.username ?? referrerId, status: 'skipped_no_connect' })
      continue
    }
    if (totalAmount < 100) {
      results.push({ referrer: referrer.username ?? referrerId, status: 'skipped_below_minimum', amount: totalAmount })
      continue
    }

    const idempotencyKey = `payout-${[...commissionIds].sort().join('-')}`

    try {
      const transfer = await stripe.transfers.create({
        amount: totalAmount,
        currency: 'eur',
        destination: referrer.stripeConnectId,
        description: `FinestSites Affiliate Provision – ${referrer.username}`,
        metadata: { referrer_id: referrer.id, commission_ids: commissionIds.join(',') },
      }, { idempotencyKey })

      const periodStart = new Date()
      periodStart.setDate(1)
      periodStart.setHours(0, 0, 0, 0)

      await db.insert(affiliatePayouts).values({
        referrerId: referrer.id,
        commissionIds,
        totalAmount,
        commissionCount: commissionIds.length,
        stripeTransferId: transfer.id,
        status: 'paid',
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: now.toISOString().slice(0, 10),
        paidAt: now,
      })

      await db.update(affiliateCommissions)
        .set({ status: 'paid', paidAt: now, updatedAt: now })
        .where(inArray(affiliateCommissions.id, commissionIds))

      results.push({ referrer: referrer.username ?? referrerId, status: 'paid', amount: totalAmount })

      if (referrer.email) {
        getResend().emails.send({
          from: FROM_EMAIL,
          to: referrer.email,
          subject: `Deine Provision wurde ausgezahlt – FinestSites`,
          html: affiliatePayoutEmail({ amountCents: totalAmount, commissionCount: commissionIds.length }),
        }).catch(err => console.error('[trigger-payout] payout email error:', err))
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.push({ referrer: referrer.username ?? referrerId, status: 'error', error: message })
    }
  }

  const paid = results.filter(r => r.status === 'paid').length
  const skipped = results.filter(r => r.status !== 'paid').length
  return NextResponse.json({ results, paid, skipped })
}
