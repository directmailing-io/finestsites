import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { blockPurchaseInApp } from '@/lib/app-mode'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe, getPriceIdByPlan, PLANS, type PlanKey, type BillingInterval } from '@/lib/stripe/client'
import { getActiveCampaign } from '@/lib/billing/campaign'
import { campaignDiscount } from '@/lib/billing/campaign-shared'
import { getClientIp, rateLimit } from '@/lib/security/request'
import { getEventConfig, eventPageUrl } from '@/lib/event/config'

/**
 * Checkout ohne Konto für Event-Seiten (finestsites.io/<event>): Vorname + E-Mail → Stripe.
 * Das Konto entsteht nach der Zahlung (Webhook bzw. Danke-Seite, src/lib/event/signup.ts).
 *
 * - Bekannte E-Mail → 409 „Du hast schon ein Konto“: anmelden, der Aktionscode gilt im normalen
 *   Checkout automatisch (sitewide). So entstehen keine Doppelkonten.
 * - Aktionscode aus Stripe (sitewide, Code aus der Event-Konfiguration). Abgelaufen → normaler Preis,
 *   kein Gutscheinfeld bei Stripe (die Seite sagt vorher, dass das Angebot beendet ist).
 * - Keine Partnerlinks auf der Event-Seite (Konzept: Partner werben über ihre normalen Links).
 */
const MWST_TAX_RATE = 'txr_1TtjFpGWVCygqvfcuF1utKUc' // 19 % MwSt., inclusive, DE (wie /api/billing/checkout)

/**
 * Die Event-Seite liegt auf finestsites.io, diese Route auf app.finestsites.io: Der Cloudflare-Worker
 * vor finestsites.io reicht den Inhalt von POST-Anfragen nicht weiter, darum ruft der Browser die
 * App-Domain direkt auf. Dafür braucht es CORS: Preflight (OPTIONS) + Allow-Origin für unsere Domains.
 */
const ALLOWED_ORIGINS = new Set([
  'https://finestsites.io',
  'https://www.finestsites.io',
  (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, ''),
])

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  if (!ALLOWED_ORIGINS.has(origin) && !(process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost'))) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req)
  const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers })

  const appBlocked = blockPurchaseInApp(req)
  if (appBlocked) return appBlocked
  if (!rateLimit('event-checkout', getClientIp(req), 10, 60 * 1000)) {
    return json({ error: 'Zu viele Versuche. Bitte warte kurz und probiere es noch einmal.' }, 429)
  }

  let body: { slug?: string; first_name?: string; email?: string; plan?: string; interval?: string }
  try { body = await req.json() } catch { return json({ error: 'Ungültige Anfrage.' }, 400) }

  const event = getEventConfig(String(body.slug ?? ''))
  if (!event) return json({ error: 'Unbekanntes Event.' }, 404)

  const firstName = String(body.first_name ?? '').trim().slice(0, 60)
  const email = String(body.email ?? '').trim().toLowerCase()
  const plan = (body.plan ?? event.recommendedPlan) as PlanKey
  const interval = (body.interval ?? event.defaultInterval) as BillingInterval
  if (!firstName) return json({ error: 'Bitte gib deinen Vornamen ein.' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return json({ error: 'Bitte prüfe deine E-Mail-Adresse.' }, 400)
  }
  if (!PLANS[plan] || (interval !== 'monthly' && interval !== 'yearly')) {
    return json({ error: 'Ungültiger Tarif.' }, 400)
  }
  const priceId = getPriceIdByPlan(plan, interval)
  if (!priceId) return json({ error: 'Tarif nicht verfügbar.' }, 500)

  const existing = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } })
  if (existing) {
    return json({
      error: 'Mit dieser E-Mail-Adresse gibt es schon ein FinestSites-Konto.',
      existing: true,
    }, 409)
  }

  const stripe = getStripe()
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')

  // Aktionscode: nur der aus der Event-Konfiguration, und nur solange Stripe ihn als aktiv führt
  const campaign = await getActiveCampaign()
  const promo = campaign && campaign.code === event.code && campaignDiscount(campaign, interval) ? campaign : null

  try {
    const customer = await stripe.customers.create({
      email,
      name: firstName,
      metadata: { first_name: firstName, event_slug: event.slug, event_signup: '1' },
    })

    const meta = {
      event_signup: '1',
      event_slug: event.slug,
      first_name: firstName,
      email,
      plan,
      interval,
      promo_code: promo?.code ?? '',
      referred_by: '',
    }
    const params: Stripe.Checkout.SessionCreateParams = {
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card', 'sepa_debit'],
      line_items: [{ price: priceId, quantity: 1 }],
      ...(promo ? { discounts: [{ promotion_code: promo.promoCodeId }] } : {}),
      success_url: `${appUrl}/${event.slug}/danke?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${eventPageUrl(event)}?abgebrochen=1`,
      billing_address_collection: 'required',
      customer_update: { address: 'auto', name: 'auto' },
      subscription_data: { default_tax_rates: [MWST_TAX_RATE], metadata: meta },
      metadata: meta,
      locale: 'de',
    }

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create(params)
    } catch (err) {
      // Code gerade abgelaufen o. ä.: der Kauf darf daran nicht scheitern → normaler Preis
      if (!promo) throw err
      console.error('[event/checkout] campaign code rejected, continuing without:', err instanceof Error ? err.message : err)
      const withoutDiscount = { ...params, metadata: { ...meta, promo_code: '' } }
      delete withoutDiscount.discounts
      session = await stripe.checkout.sessions.create(withoutDiscount)
    }
    if (!session.url) throw new Error('Stripe lieferte keine Checkout-Adresse')
    return json({ url: session.url })
  } catch (err) {
    console.error('[event/checkout] error:', err instanceof Error ? err.message : err)
    return json({ error: 'Die Bezahlseite konnte nicht geöffnet werden. Bitte versuche es gleich noch einmal.' }, 500)
  }
}
