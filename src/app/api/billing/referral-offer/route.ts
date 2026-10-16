import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { getClientIp, rateLimit } from '@/lib/security/request'
import { getStripe } from '@/lib/stripe/client'
import { loadReferralContext, referralOfferFor, referralProfileColumns } from '@/lib/affiliate/referral-offer'

/**
 * GET /api/billing/referral-offer
 * Empfehlungsrabatt des angemeldeten Kunden, fertig berechnet (src/lib/affiliate/referral-model.ts):
 * Texte + Preise je Tarif und Intervall. Die Oberfläche rechnet nichts selbst.
 *
 * yearly_switch_hint: Modell-C-Kunde im Monatsabo → Hinweis "Wechsle ins Jahresabo und spar
 * dauerhaft 10 % Partnerpreis" (Einstellungen → Zahlung).
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  // Die Neukunden-Prüfung fragt Stripe ab → je Konto und je IP drosseln
  if (!rateLimit('referral-offer', user.id, 20, 60 * 1000) || !rateLimit('referral-offer-ip', getClientIp(req), 60, 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte kurz.' }, { status: 429 })
  }

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { ...referralProfileColumns, referredByUsername: true, billingInterval: true, cancelAtPeriodEnd: true },
  })
  if (!profile?.referredByUsername) return NextResponse.json({ offer: null, yearly_switch_hint: false })

  const hasRunningSubscription = !!profile.stripeSubscriptionId
    && ['active', 'trialing', 'past_due'].includes(profile.subscriptionStatus ?? '')

  // Laufendes Abo: Konditionen stehen fest (am Konto gespeichert) → nur der Jahresabo-Hinweis.
  if (hasRunningSubscription) {
    const yearlySwitchHint = profile.referralTerms === 'c2026'
      && profile.referredByUsername !== profile.username
      && profile.billingInterval !== 'yearly'
      && !profile.cancelAtPeriodEnd
    return NextResponse.json({ offer: null, yearly_switch_hint: yearlySwitchHint })
  }

  // Kein Abo: volle Prüfung wie beim Checkout (inkl. Stripe), damit Anzeige und Rechnung übereinstimmen.
  const ctx = await loadReferralContext({
    profile,
    referrerUsername: profile.referredByUsername,
    stripe: getStripe(),
  }).catch(err => {
    console.error('[billing/referral-offer] error:', err instanceof Error ? err.message : err)
    return null
  })
  return NextResponse.json({ offer: ctx ? referralOfferFor(ctx) : null, yearly_switch_hint: false })
}
