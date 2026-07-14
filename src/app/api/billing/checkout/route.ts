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

    const { plan, interval = 'monthly', site_id, promo_code } = await req.json() as {
      plan: PlanKey; interval?: BillingInterval; site_id?: string; promo_code?: string
    }
    const priceId = getPriceIdByPlan(plan, interval)
    if (!priceId) return NextResponse.json({ error: 'Ungültiger Plan.' }, { status: 400 })

    const stripe = getStripe()
    const profile = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { stripeCustomerId: true, email: true, username: true, referredByUsername: true, firstName: true, lastName: true },
    })

    // Build customer display name and metadata from current profile
    const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() || undefined
    const customerMeta = {
      user_id: user.id,
      username: profile?.username ?? '',
      first_name: profile?.firstName ?? '',
      last_name: profile?.lastName ?? '',
    }

    // Create or reuse Stripe customer — always sync metadata so Stripe stays up-to-date
    let customerId = profile?.stripeCustomerId ?? undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email ?? '',
        ...(fullName ? { name: fullName } : {}),
        metadata: customerMeta,
      })
      customerId = customer.id
      await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id))
    } else {
      // Keep existing customer metadata in sync (fire-and-forget, non-blocking)
      stripe.customers.update(customerId, {
        ...(fullName ? { name: fullName } : {}),
        metadata: customerMeta,
      }).catch((e: Error) => console.error('[billing/checkout] customer update error:', e.message))
    }

    // Always use the canonical app URL for Stripe redirect URLs.
    // Never use request origin/referer — the proxy chain (CF Worker → Caddy) means
    // req.url / origin headers reflect the internal VPS address (0.0.0.0:3002),
    // which would make Stripe redirect users to that address instead of the public URL.
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')

    // Success always hits the server-side activate route, which verifies the
    // Stripe session, updates the DB, then redirects to /sites (or back to the
    // editor if site_id was passed — e.g. triggered from the publish gate).
    const isOnboarding = !profile?.username
    const siteParam = site_id ? `&site_id=${encodeURIComponent(site_id)}` : ''
    const successUrl = `${appUrl}/api/billing/activate?session_id={CHECKOUT_SESSION_ID}${siteParam}`
    const cancelUrl = site_id
      ? `${appUrl}/sites/${site_id}/edit?payment_canceled=1`
      : isOnboarding
        ? `${appUrl}/onboarding/plan?canceled=1`
        : `${appUrl}/settings?canceled=1`

    // Apply affiliate discount coupon if user was referred.
    // If user manually entered a promo code and has no referral, look it up in Stripe.
    const affiliateCouponId = process.env.STRIPE_AFFILIATE_COUPON_ID
    const referredBy = profile?.referredByUsername ?? null
    const hasReferral = !!referredBy && !!affiliateCouponId

    // Resolve manually entered code: affiliate username OR Stripe promotion code.
    // Priority: explicit Stripe promo code > referral affiliate coupon > allow_promotion_codes.
    // An explicitly entered Stripe promo code (e.g. ADMIN100, SUMMER50) always wins —
    // the user may have received a better deal than their referral discount.
    let affiliateApplied = false
    let promoCodeId: string | undefined

    if (promo_code) {
      const { users: usersTable } = await import('@/lib/db/schema')
      const { eq: eqFn } = await import('drizzle-orm')

      // First check if code is a Stripe promotion code (action codes: ADMIN100, BLACKFRIDAY etc.)
      // Stripe promo codes take priority — they may offer a better deal than referral.
      try {
        const codes = await stripe.promotionCodes.list({ code: promo_code.toUpperCase(), active: true, limit: 1 })
        if (codes.data.length > 0) promoCodeId = codes.data[0].id
      } catch { /* ignore: fall through to affiliate check */ }

      // Only check for affiliate username if no Stripe promo code matched AND user has no existing referral
      if (!promoCodeId && !hasReferral) {
        const affiliateUser = await db.query.users.findFirst({
          where: eqFn(usersTable.username, promo_code.toLowerCase().trim()),
          columns: { username: true },
        })

        if (affiliateUser?.username) {
          // It's an affiliate/partner code — track referral + apply coupon
          affiliateApplied = true
          if (!profile?.referredByUsername) {
            await db.update(usersTable)
              .set({ referredByUsername: affiliateUser.username })
              .where(eqFn(usersTable.id, user.id))
          }
        }
      }
    }

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
      // Discount priority: explicit Stripe promo code > (auto-referral OR affiliate code) > allow any code.
      // An explicitly entered Stripe promo code wins over the referral coupon so users can
      // always use a better admin/action code even if they have a referral on file.
      // Stripe doesn't allow mixing discounts[] with allow_promotion_codes.
      ...(promoCodeId
        ? { discounts: [{ promotion_code: promoCodeId }] }
        : hasReferral || affiliateApplied
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
          user_id: user.id,
          plan,
          interval,
          referred_by: referredBy ?? '',
        },
      },

      metadata: {
        user_id: user.id,
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
