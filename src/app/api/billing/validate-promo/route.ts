import { NextRequest, NextResponse } from 'next/server'
import { blockPurchaseInApp } from '@/lib/app-mode'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { getClientIp, rateLimit } from '@/lib/security/request'
import { anonymousReferralOffer, loadReferralContext, referralOfferFor, referralProfileColumns } from '@/lib/affiliate/referral-offer'

/**
 * Validates a partner/affiliate or promo code in two phases:
 * 1. Check if code matches a username in our DB (affiliate/partner code) → Empfehlungsrabatt
 *    (Konditionen aus src/lib/affiliate/referral-model.ts, mitgeliefert als `referral`)
 * 2. If not, check Stripe promotion codes (action codes like BLACKFRIDAY)
 */
export async function GET(req: NextRequest) {
  // App: Kauf-/Abo-Schnittstellen gesperrt (Apple 3.1.1). Browser: unverändert.
  const appBlocked = blockPurchaseInApp(req)
  if (appBlocked) return appBlocked
  const code = req.nextUrl.searchParams.get('code')?.trim()
  if (!code) return NextResponse.json({ valid: false })
  // Ohne Anmeldung erreichbar: Code-Raten und Stripe-Abfragen bremsen (30 je IP und Minute)
  if (!rateLimit('validate-promo', getClientIp(req), 30, 60 * 1000)) {
    return NextResponse.json({ valid: false, error: 'Zu viele Versuche. Bitte warte kurz.' }, { status: 429 })
  }

  // Phase 1 — affiliate/partner code: match against usernames in our system
  try {
    const affiliateUser = await db.query.users.findFirst({
      where: eq(users.username, code.toLowerCase()),
      columns: { id: true, username: true, firstName: true, isAdmin: true },
    })
    if (affiliateUser?.username) {
      // Eigener Benutzername ist kein Partnercode (keine Selbstempfehlung/-rabatt)
      const me = await getUserFromRequest(req).catch(() => null)
      if (me?.id === affiliateUser.id) {
        return NextResponse.json({ valid: false, own_code: true, error: 'Deinen eigenen Partnercode kannst du nicht verwenden.' })
      }
      // Angebot so, wie der Checkout es rechnet (angemeldet: inkl. Neukunden-Prüfung)
      let referral = anonymousReferralOffer({ username: affiliateUser.username, firstName: affiliateUser.firstName, isAdmin: affiliateUser.isAdmin })
      // Neukunden-Prüfung (DB + Stripe) nur für angemeldete Nutzer und gedrosselt je Konto;
      // anonym bleibt es beim Angebot für Neukunden ohne Prüfung.
      if (me && rateLimit('validate-promo-user', me.id, 10, 60 * 1000)) {
        const profile = await db.query.users.findFirst({ where: eq(users.id, me.id), columns: referralProfileColumns })
        const ctx = profile ? await loadReferralContext({ profile, referrerUsername: affiliateUser.username, stripe: getStripe() }).catch(() => null) : null
        if (ctx) referral = referralOfferFor(ctx)
      }
      return NextResponse.json({
        valid: true,
        type: 'affiliate',
        username: affiliateUser.username,
        display_name: affiliateUser.firstName ?? affiliateUser.username,
        // Kompatibilität (Monatsabo-Wert); maßgeblich ist `referral`
        percent_off: referral.monthly?.percent_off ?? null,
        amount_off: null,
        duration: referral.monthly?.duration ?? 'forever',
        duration_in_months: null,
        referral,
      })
    }
  } catch { /* DB error: fall through to Stripe check */ }

  // Phase 2 — Stripe promotion code (action codes: BLACKFRIDAY etc.)
  try {
    const stripe = getStripe()
    const result = await stripe.promotionCodes.list({
      code: code.toUpperCase(),
      active: true,
      limit: 1,
      expand: ['data.promotion.coupon'],
    })

    if (!result.data.length) return NextResponse.json({ valid: false })

    const promotion = result.data[0].promotion
    const coupon = promotion.coupon as Stripe.Coupon | string | null
    const percentOff = typeof coupon === 'object' && coupon ? coupon.percent_off ?? null : null
    const amountOff = typeof coupon === 'object' && coupon ? coupon.amount_off ?? null : null
    const name = typeof coupon === 'object' && coupon ? (coupon.name ?? code.toUpperCase()) : code.toUpperCase()
    const intervalRestriction = typeof coupon === 'object' && coupon ? ((coupon as any).metadata?.interval ?? 'both') : 'both'
    // Duration is needed by the UI: a time-limited coupon must never be shown as a permanent discount
    const duration = typeof coupon === 'object' && coupon ? coupon.duration : 'forever'
    const durationInMonths = typeof coupon === 'object' && coupon ? coupon.duration_in_months ?? null : null

    return NextResponse.json({ valid: true, type: 'promo', percent_off: percentOff, amount_off: amountOff, name, interval_restriction: intervalRestriction, duration, duration_in_months: durationInMonths })
  } catch {
    return NextResponse.json({ valid: false })
  }
}
