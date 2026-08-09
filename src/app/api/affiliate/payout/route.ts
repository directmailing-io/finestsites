/**
 * POST /api/affiliate/payout
 * Self-service payout for the authenticated partner.
 * Uses the shared payout engine (same rules as cron + admin trigger):
 * 10 € minimum, max one payout per month, live Stripe Connect verification,
 * negative balance offsetting.
 */

import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'
import { releaseMaturedCommissions, processReferrerPayout, PAYOUT_MINIMUM_CENTS } from '@/lib/affiliate/payout'

function euros(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €'
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { id: true, email: true, username: true, stripeConnectId: true, affiliateOnboarded: true },
  })

  if (!profile?.affiliateOnboarded || !profile?.stripeConnectId) {
    return NextResponse.json(
      { error: 'Du hast noch kein Auszahlungskonto verbunden. Richte zuerst dein Bankkonto ein.' },
      { status: 400 }
    )
  }

  await releaseMaturedCommissions(user.id)

  const result = await processReferrerPayout(getStripe(), profile)

  switch (result.status) {
    case 'paid':
      return NextResponse.json({ paid: 1, amount_cents: result.amount })
    case 'skipped_no_commissions':
      return NextResponse.json({ paid: 0, message: 'Gerade gibt es nichts auszuzahlen. Dein Guthaben bleibt dir aber sicher erhalten.' })
    case 'skipped_below_minimum':
      return NextResponse.json({
        paid: 0,
        message: `Ausgezahlt wird ab ${euros(PAYOUT_MINIMUM_CENTS)}. Du hast aktuell ${euros(result.amount ?? 0)}. Keine Sorge, dein Guthaben verfällt nicht und wandert in den nächsten Monat.`,
      })
    case 'skipped_negative_balance':
      return NextResponse.json({
        paid: 0,
        message: 'Dein Guthaben ist gerade im Minus (z. B. durch eine Rückbuchung). Neue Provisionen gleichen das automatisch wieder aus.',
      })
    case 'skipped_already_paid_this_month':
      return NextResponse.json({
        paid: 0,
        message: 'Du hast diesen Monat schon eine Auszahlung bekommen. Pro Monat ist eine Auszahlung möglich, ab nächstem Monat geht es wieder.',
      })
    case 'skipped_not_verified':
      return NextResponse.json(
        { error: 'Dein Auszahlungskonto ist bei Stripe noch nicht vollständig verifiziert. Schließe die Verifizierung ab, dein Guthaben bleibt solange erhalten.' },
        { status: 400 }
      )
    case 'skipped_no_connect':
      return NextResponse.json(
        { error: 'Du hast noch kein Auszahlungskonto verbunden. Richte zuerst dein Bankkonto ein.' },
        { status: 400 }
      )
    case 'error': {
      const isInsufficientFunds = (result.error ?? '').includes('insufficient funds')
      return NextResponse.json(
        {
          error: isInsufficientFunds
            ? 'Auszahlung gerade nicht möglich. Die Zahlung deines Partners wird noch von Stripe verarbeitet (ca. 7 Tage). Versuch es in ein paar Tagen nochmal.'
            : 'Da ist was schiefgelaufen. Versuch es später nochmal oder melde dich beim Support.',
        },
        { status: 400 }
      )
    }
  }
}
