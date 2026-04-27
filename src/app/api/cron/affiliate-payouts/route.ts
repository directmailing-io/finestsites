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
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { affiliatePayoutEmail } from '@/lib/email/templates'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const querySecret = request.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (cronSecret && querySecret === cronSecret)

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const stripe = getStripe()
  const now = new Date().toISOString()

  // ── Step 1: pending → available ───────────────────────────────────────────
  const { data: released } = await admin
    .from('affiliate_commissions')
    .update({ status: 'available', updated_at: now })
    .eq('status', 'pending')
    .lte('available_at', now)
    .select('id')

  console.log(`[affiliate-payouts] released ${released?.length ?? 0} commissions to available`)

  // ── Step 2: fetch all available commissions ───────────────────────────────
  const { data: commissions, error: fetchError } = await admin
    .from('affiliate_commissions')
    .select('id, referrer_id, commission_amount')
    .eq('status', 'available')

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!commissions || commissions.length === 0) {
    return NextResponse.json({ message: 'Keine fälligen Provisionen.', paid: 0, skipped: 0 })
  }

  // ── Step 3: load referrer profiles ───────────────────────────────────────
  const referrerIds = [...new Set(commissions.map(c => c.referrer_id))]
  const { data: referrers } = await admin
    .from('users')
    .select('id, email, username, stripe_connect_id, affiliate_onboarded')
    .in('id', referrerIds)

  const referrerMap = new Map((referrers ?? []).map(r => [r.id, r]))

  // ── Step 4: group by referrer ─────────────────────────────────────────────
  const grouped = new Map<string, { commissionIds: string[]; totalAmount: number }>()
  for (const c of commissions) {
    const g = grouped.get(c.referrer_id)
    if (g) {
      g.commissionIds.push(c.id)
      g.totalAmount += c.commission_amount
    } else {
      grouped.set(c.referrer_id, { commissionIds: [c.id], totalAmount: c.commission_amount })
    }
  }

  const results: { referrer: string; status: string; amount?: number; error?: string }[] = []

  // ── Step 5: transfer per referrer ─────────────────────────────────────────
  for (const [referrerId, { commissionIds, totalAmount }] of grouped) {
    const referrer = referrerMap.get(referrerId)

    if (!referrer?.affiliate_onboarded || !referrer.stripe_connect_id) {
      results.push({ referrer: referrer?.username ?? referrerId, status: 'skipped_no_connect' })
      continue
    }

    if (totalAmount < 100) {
      // Minimum €1.00 to avoid Stripe fees eating the commission
      results.push({ referrer: referrer.username, status: 'skipped_below_minimum', amount: totalAmount })
      continue
    }

    // Idempotency key = sorted commission IDs — prevents double-transfer if DB update fails after Stripe success
    const idempotencyKey = `payout-${[...commissionIds].sort().join('-')}`

    try {
      const transfer = await stripe.transfers.create({
        amount: totalAmount,
        currency: 'eur',
        destination: referrer.stripe_connect_id,
        description: `FinestSites Affiliate Provision – ${referrer.username}`,
        metadata: {
          referrer_id: referrer.id,
          referrer_username: referrer.username,
          commission_ids: commissionIds.join(','),
        },
      }, { idempotencyKey })

      const periodStart = new Date()
      periodStart.setDate(1)
      periodStart.setHours(0, 0, 0, 0)

      const { error: payoutInsertErr } = await admin.from('affiliate_payouts').insert({
        referrer_id: referrer.id,
        amount: totalAmount,
        total_amount: totalAmount,
        commission_count: commissionIds.length,
        stripe_transfer_id: transfer.id,
        status: 'completed',
        period_start: periodStart.toISOString().slice(0, 10),
        period_end: now.slice(0, 10),
        paid_at: now,
      })
      if (payoutInsertErr) {
        console.error(`[affiliate-payouts] payout insert error for ${referrer.username}:`, payoutInsertErr.message)
      }

      await admin
        .from('affiliate_commissions')
        .update({ status: 'paid', paid_at: now, updated_at: now })
        .in('id', commissionIds)

      results.push({ referrer: referrer.username, status: 'paid', amount: totalAmount })
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
      results.push({ referrer: referrer.username, status: 'error', error: message })
    }
  }

  const paid = results.filter(r => r.status === 'paid').length
  const skipped = results.filter(r => r.status !== 'paid').length

  return NextResponse.json({ results, paid, skipped })
}
