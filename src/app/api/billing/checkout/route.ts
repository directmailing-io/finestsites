import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { getStripe, getPriceIdByPlan, type PlanKey, type BillingInterval } from '@/lib/stripe/client'

/**
 * Creates a Stripe Checkout Session for a subscription.
 *
 * Payment methods: card + SEPA Direct Debit.
 * Tax: Stripe Tax automatic_tax (gated by STRIPE_AUTOMATIC_TAX=1) — prices are
 *   stored gross (incl. VAT), so prices in Stripe must have tax_behavior=inclusive.
 *   Stripe Tax then breaks out the correct VAT per customer location on the invoice.
 * Address: collected and synced back to the customer so future invoices have it.
 * VAT-ID (tax_id_collection): enabled so B2B customers can enter their VAT ID
 *   and benefit from reverse charge where applicable.
 * Invoicing: invoices are created automatically by Stripe for subscription billing.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

    const { plan, interval = 'monthly' } = await req.json() as { plan: PlanKey; interval?: BillingInterval }
    const priceId = getPriceIdByPlan(plan, interval)
    if (!priceId) return NextResponse.json({ error: 'Ungültiger Plan.' }, { status: 400 })

    const stripe = getStripe()
    const profile = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { stripeCustomerId: true, email: true, username: true, referredByUsername: true },
    })

    // Create or reuse Stripe customer
    let customerId = profile?.stripeCustomerId ?? undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email ?? '',
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id))
    }

    // Always use the canonical app URL for Stripe redirect URLs.
    // Never use request origin/referer — the proxy chain (CF Worker → Caddy) means
    // req.url / origin headers reflect the internal VPS address (0.0.0.0:3002),
    // which would make Stripe redirect users to that address instead of the public URL.
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')

    // Success always hits the server-side activate route, which verifies the
    // Stripe session, updates the DB, then redirects to /sites.
    const isOnboarding = !profile?.username
    const successUrl = `${appUrl}/api/billing/activate?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = isOnboarding
      ? `${appUrl}/onboarding/plan?canceled=1`
      : `${appUrl}/settings?canceled=1`

    // Apply affiliate discount coupon if user was referred
    const affiliateCouponId = process.env.STRIPE_AFFILIATE_COUPON_ID
    const referredBy = profile?.referredByUsername ?? null
    const hasReferral = !!referredBy && !!affiliateCouponId

    // Stripe Tax: enabled when STRIPE_AUTOMATIC_TAX=1 in env.
    // Requires:
    //  - Stripe Tax activated in Dashboard (Settings → Tax)
    //  - Origin address set
    //  - Prices have tax_behavior set (we use 'inclusive')
    //  - Product has tax_code set
    //  - Customer has billing address (we collect it below)
    const automaticTaxEnabled = process.env.STRIPE_AUTOMATIC_TAX === '1'

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card', 'sepa_debit'],
      line_items: [{ price: priceId, quantity: 1 }],
      // Allow promo codes only when no affiliate discount is already applied
      // (Stripe doesn't allow mixing discounts and allow_promotion_codes)
      ...(hasReferral
        ? { discounts: [{ coupon: affiliateCouponId!.trim() }] }
        : { allow_promotion_codes: true }),
      success_url: successUrl,
      cancel_url: cancelUrl,

      // Collect billing address — required for Stripe Tax and for proper invoices
      billing_address_collection: 'required',
      // Sync address + name from checkout back to the customer object so
      // future renewal invoices keep the same data
      customer_update: { address: 'auto', name: 'auto' },
      // Allow B2B customers to enter their VAT ID (Stripe verifies it via VIES)
      tax_id_collection: { enabled: true },

      // Stripe Tax: opt-in via env flag (requires Stripe Tax activated in Dashboard)
      ...(automaticTaxEnabled ? { automatic_tax: { enabled: true } } : {}),

      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
          interval,
          referred_by: referredBy ?? '',
        },
      },

      metadata: {
        supabase_user_id: user.id,
        plan,
        interval,
        referred_by: referredBy ?? '',
      },

      // Locale: German by default. Stripe shows checkout in the right language
      // for international customers via their browser; we set 'auto' so Stripe decides.
      locale: 'auto',
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('[billing/checkout] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
