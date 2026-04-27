/**
 * POST /api/affiliate/payout
 * Self-service payout for the authenticated partner.
 * Transfers all available commissions to their Stripe Connect account.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const stripe = getStripe()
  const now = new Date().toISOString()

  // Load referrer profile
  const { data: profile } = await admin
    .from('users')
    .select('id, username, stripe_connect_id, affiliate_onboarded')
    .eq('id', user.id)
    .single()

  if (!profile?.affiliate_onboarded || !profile?.stripe_connect_id) {
    return NextResponse.json(
      { error: 'Kein Auszahlungskonto eingerichtet. Bitte zuerst das Bankkonto verbinden.' },
      { status: 400 }
    )
  }

  // Move pending → available for this user where available_at has passed
  await admin
    .from('affiliate_commissions')
    .update({ status: 'available', updated_at: now })
    .eq('referrer_id', user.id)
    .eq('status', 'pending')
    .lte('available_at', now)

  // Fetch available commissions for this user
  const { data: commissions, error } = await admin
    .from('affiliate_commissions')
    .select('id, commission_amount')
    .eq('referrer_id', user.id)
    .eq('status', 'available')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!commissions || commissions.length === 0) {
    return NextResponse.json({ paid: 0, message: 'Keine auszahlbaren Provisionen vorhanden.' })
  }

  const totalAmount = commissions.reduce((s, c) => s + c.commission_amount, 0)
  const commissionIds = commissions.map(c => c.id)

  if (totalAmount < 100) {
    return NextResponse.json({
      paid: 0,
      message: `Mindestbetrag für Auszahlung: €1,00. Aktuell: ${(totalAmount / 100).toFixed(2).replace('.', ',')} €`,
    })
  }

  // Idempotency key = sorted commission IDs — prevents double-transfer if DB update fails
  const idempotencyKey = `payout-${[...commissionIds].sort().join('-')}`

  try {
    const transfer = await stripe.transfers.create({
      amount: totalAmount,
      currency: 'eur',
      destination: profile.stripe_connect_id,
      description: `FinestSites Affiliate Provision – ${profile.username}`,
      metadata: {
        referrer_id: profile.id,
        referrer_username: profile.username ?? '',
        commission_ids: commissionIds.join(','),
      },
    }, { idempotencyKey })

    const periodStart = new Date()
    periodStart.setDate(1)
    periodStart.setHours(0, 0, 0, 0)

    const { error: payoutInsertErr } = await admin.from('affiliate_payouts').insert({
      referrer_id: profile.id,
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
      console.error('[affiliate/payout] payout insert error:', payoutInsertErr.message)
    }

    await admin
      .from('affiliate_commissions')
      .update({ status: 'paid', paid_at: now, updated_at: now })
      .in('id', commissionIds)

    return NextResponse.json({ paid: 1, amount_cents: totalAmount, transfer_id: transfer.id })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('[affiliate/payout] transfer error:', message)

    // Detect insufficient funds specifically
    const isInsufficientFunds = message.includes('insufficient funds')
    return NextResponse.json(
      {
        error: isInsufficientFunds
          ? 'Auszahlung aktuell nicht möglich — die Zahlung deines Partners wird noch von Stripe verarbeitet (ca. 7 Tage). Bitte versuche es in einigen Tagen erneut.'
          : message,
      },
      { status: 400 }
    )
  }
}
