/**
 * POST /api/admin/affiliate/trigger-payout
 * Admin-only: immediately processes payouts for all affiliates with available commissions.
 * Reuses the same logic as the monthly cron job.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { affiliatePayoutEmail } from '@/lib/email/templates'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const stripe = getStripe()
  const now = new Date().toISOString()

  // Step 1: move pending → available where available_at has passed
  await admin
    .from('affiliate_commissions')
    .update({ status: 'available', updated_at: now })
    .eq('status', 'pending')
    .lte('available_at', now)

  // Step 2: fetch all available commissions
  const { data: commissions, error } = await admin
    .from('affiliate_commissions')
    .select('id, referrer_id, commission_amount')
    .eq('status', 'available')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!commissions?.length) return NextResponse.json({ message: 'Keine fälligen Provisionen.', paid: 0, skipped: 0 })

  // Step 3: load referrer profiles
  const referrerIds = [...new Set(commissions.map(c => c.referrer_id))]
  const { data: referrers } = await admin
    .from('users')
    .select('id, email, username, stripe_connect_id, affiliate_onboarded')
    .in('id', referrerIds)

  const referrerMap = new Map((referrers ?? []).map(r => [r.id, r]))

  // Step 4: group by referrer
  const grouped = new Map<string, { commissionIds: string[]; totalAmount: number }>()
  for (const c of commissions) {
    const g = grouped.get(c.referrer_id)
    if (g) { g.commissionIds.push(c.id); g.totalAmount += c.commission_amount }
    else grouped.set(c.referrer_id, { commissionIds: [c.id], totalAmount: c.commission_amount })
  }

  const results: { referrer: string; status: string; amount?: number; error?: string }[] = []

  // Step 5: transfer per referrer
  for (const [referrerId, { commissionIds, totalAmount }] of grouped) {
    const referrer = referrerMap.get(referrerId)

    if (!referrer?.affiliate_onboarded || !referrer.stripe_connect_id) {
      results.push({ referrer: referrer?.username ?? referrerId, status: 'skipped_no_connect' })
      continue
    }
    if (totalAmount < 100) {
      results.push({ referrer: referrer.username, status: 'skipped_below_minimum', amount: totalAmount })
      continue
    }

    const idempotencyKey = `payout-${[...commissionIds].sort().join('-')}`

    try {
      const transfer = await stripe.transfers.create({
        amount: totalAmount,
        currency: 'eur',
        destination: referrer.stripe_connect_id,
        description: `FinestSites Affiliate Provision – ${referrer.username}`,
        metadata: { referrer_id: referrer.id, commission_ids: commissionIds.join(',') },
      }, { idempotencyKey })

      const periodStart = new Date(); periodStart.setDate(1); periodStart.setHours(0, 0, 0, 0)

      await admin.from('affiliate_payouts').insert({
        referrer_id: referrer.id,
        amount: totalAmount,
        total_amount: totalAmount,
        commission_count: commissionIds.length,
        stripe_transfer_id: transfer.id,
        status: 'paid',
        period_start: periodStart.toISOString(),
        period_end: now,
        paid_at: now,
        updated_at: now,
      })

      await admin.from('affiliate_commissions')
        .update({ status: 'paid', paid_at: now, updated_at: now })
        .in('id', commissionIds)

      results.push({ referrer: referrer.username, status: 'paid', amount: totalAmount })

      // Notify affiliate by email (fire-and-forget)
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
      results.push({ referrer: referrer.username, status: 'error', error: message })
    }
  }

  const paid = results.filter(r => r.status === 'paid').length
  const skipped = results.filter(r => r.status !== 'paid').length
  return NextResponse.json({ results, paid, skipped })
}
