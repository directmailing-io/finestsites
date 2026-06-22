/**
 * POST /api/affiliate/payout
 * Self-service payout for the authenticated partner.
 * Transfers all available commissions to their Stripe Connect account.
 */

import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, affiliateCommissions, affiliatePayouts } from '@/lib/db/schema'
import { eq, and, lte, inArray } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stripe = getStripe()
  const now = new Date()
  const nowIso = now.toISOString()

  // Load referrer profile
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { id: true, username: true, stripeConnectId: true, affiliateOnboarded: true },
  })

  if (!profile?.affiliateOnboarded || !profile?.stripeConnectId) {
    return NextResponse.json(
      { error: 'Kein Auszahlungskonto eingerichtet. Bitte zuerst das Bankkonto verbinden.' },
      { status: 400 }
    )
  }

  // Move pending → available for this user where available_at has passed
  await db.update(affiliateCommissions)
    .set({ status: 'available', updatedAt: now })
    .where(and(
      eq(affiliateCommissions.referrerId, user.id),
      eq(affiliateCommissions.status, 'pending'),
      lte(affiliateCommissions.availableAt, now)
    ))

  // Fetch available commissions for this user
  let commissions: { id: string; commissionAmount: number }[]
  try {
    commissions = await db
      .select({ id: affiliateCommissions.id, commissionAmount: affiliateCommissions.commissionAmount })
      .from(affiliateCommissions)
      .where(and(
        eq(affiliateCommissions.referrerId, user.id),
        eq(affiliateCommissions.status, 'available')
      ))
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (commissions.length === 0) {
    return NextResponse.json({ paid: 0, message: 'Keine auszahlbaren Provisionen vorhanden.' })
  }

  const totalAmount = commissions.reduce((s, c) => s + c.commissionAmount, 0)
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
      destination: profile.stripeConnectId,
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

    try {
      await db.insert(affiliatePayouts).values({
        referrerId: profile.id,
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
      console.error('[affiliate/payout] payout insert error:', err)
    }

    await db.update(affiliateCommissions)
      .set({ status: 'paid', paidAt: now, updatedAt: now })
      .where(inArray(affiliateCommissions.id, commissionIds))

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
          : 'Internal server error',
      },
      { status: 400 }
    )
  }
}
