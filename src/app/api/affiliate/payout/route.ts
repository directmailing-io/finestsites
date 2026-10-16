/**
 * POST /api/affiliate/payout
 * Self-service payout for the authenticated partner.
 * Uses the shared payout engine (same rules as cron + admin trigger):
 * 10 € minimum, max one payout per month, live Stripe Connect verification,
 * negative balance offsetting, tax profile required, platform balance check
 * (dem Partner gegenüber nie offengelegt).
 */

import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'
import { releaseMaturedCommissions, processReferrerPayout, notifyAdminSingle, PAYOUT_MINIMUM_CENTS } from '@/lib/affiliate/payout'
import { rateLimit } from '@/lib/security/request'

function euros(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €'
}

/** Neutrale Antwort, die nichts über den internen Stand (z. B. Plattform-Guthaben) verrät. */
const NEUTRAL_PENDING_MESSAGE = 'Deine Auszahlung wird gerade vorbereitet und kommt automatisch. Dein Guthaben bleibt dir sicher erhalten.'

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { id: true, email: true, username: true, stripeConnectId: true, affiliateOnboarded: true, affiliatePayoutMode: true },
  })

  // Verrechnung mit dem eigenen Abo läuft nur automatisch im Monatslauf – hier gibt es nichts zu klicken.
  if (profile && profile.affiliatePayoutMode !== 'payout') {
    return NextResponse.json(
      { error: 'Deine Provision wird jeden Monat automatisch mit deinem Abo verrechnet. Möchtest du lieber aufs Bankkonto ausgezahlt bekommen, stell das oben unter „So bekommst du deine Provision“ um.' },
      { status: 400 }
    )
  }

  // affiliate_onboarded wird von der Auszahlungs-Engine live mit Stripe abgeglichen –
  // hier reicht ein verbundenes Konto.
  if (!profile?.stripeConnectId) {
    return NextResponse.json(
      { error: 'Du hast noch kein Auszahlungskonto verbunden. Richte zuerst dein Bankkonto ein.' },
      { status: 400 }
    )
  }

  if (!rateLimit('affiliate-payout', user.id, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Bitte warte ein paar Minuten und versuch es dann nochmal.' }, { status: 429 })
  }

  await releaseMaturedCommissions(user.id)

  const result = await processReferrerPayout(getStripe(), profile)
  notifyAdminSingle(result).catch(() => {})

  switch (result.status) {
    case 'paid':
      return NextResponse.json({ paid: 1, amount_cents: result.amount, credit_note_number: result.creditNoteNumber ?? null })
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
    case 'skipped_tax_profile_missing':
      return NextResponse.json(
        { error: 'Damit wir dir deine Provision auszahlen können, brauchen wir noch kurz deine Angaben für die Abrechnung. Du findest sie weiter unten auf dieser Seite.', reason: 'tax_profile_missing' },
        { status: 400 }
      )
    // Plattform-Guthaben zu knapp ist ein internes Thema (Admin bekommt den Hinweis):
    // Der Partner sieht dieselbe neutrale Antwort wie bei einer noch laufenden Auszahlung.
    case 'skipped_insufficient_platform_balance':
    case 'unclear':
      return NextResponse.json({ paid: 0, message: NEUTRAL_PENDING_MESSAGE })
    case 'failed':
    case 'error': {
      const isInsufficientFunds = result.reason === 'insufficient_platform_balance' || (result.error ?? '').includes('insufficient funds')
      if (isInsufficientFunds) return NextResponse.json({ paid: 0, message: NEUTRAL_PENDING_MESSAGE })
      return NextResponse.json(
        { error: 'Da ist was schiefgelaufen. Versuch es später nochmal oder melde dich beim Support.' },
        { status: 400 }
      )
    }
    default:
      return NextResponse.json({ error: 'Da ist was schiefgelaufen. Versuch es später nochmal oder melde dich beim Support.' }, { status: 400 })
  }
}
