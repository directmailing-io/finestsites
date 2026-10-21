import { NextRequest, NextResponse } from 'next/server'
import { blockPurchaseInApp } from '@/lib/app-mode'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { getStripe, getPriceIdByPlan, type PlanKey, type BillingInterval } from '@/lib/stripe/client'
import { canUpgradeTo } from '@/lib/plans'
import { discountsParam } from '@/lib/affiliate/referral-model'
import { referralDiscountsForPlanChange, loadInheritedCustomerDiscount, PLAN_CHANGE_SUBSCRIPTION_EXPAND } from '@/lib/affiliate/referral-offer'

/**
 * Read-only preview of an in-place upgrade: what the user pays TODAY
 * (prorated, discounts + tax included) and what the plan costs at the
 * next renewal. Mirrors exactly what /api/billing/upgrade will charge
 * (same items + proration_behavior=always_invoice + the same discounts).
 *
 * Interval change (monthly → yearly): Stripe resets the billing cycle anchor to now and
 * invoices immediately — full yearly price minus a credit for the unused monthly days.
 * The next renewal is then one year from today (not the old monthly period end).
 */
export async function POST(req: NextRequest) {
  // App: Kauf-/Abo-Schnittstellen gesperrt (Apple 3.1.1). Browser: unverändert.
  const appBlocked = blockPurchaseInApp(req)
  if (appBlocked) return appBlocked
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const { plan, interval = 'monthly' } = await req.json() as {
    plan: PlanKey; interval?: BillingInterval
  }

  const newPriceId = getPriceIdByPlan(plan, interval)
  if (!newPriceId) return NextResponse.json({ error: 'Ungültiger Plan.' }, { status: 400 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeCustomerId: true, plan: true, username: true, referredByUsername: true, referralTerms: true },
  })
  if (!profile?.stripeCustomerId) {
    return NextResponse.json({ error: 'Kein aktives Abonnement gefunden.' }, { status: 400 })
  }

  const stripe = getStripe()
  const subscriptions = await stripe.subscriptions.list({
    customer: profile.stripeCustomerId,
    status: 'active',
    limit: 1,
    // Coupons expandiert: metadata.interval entscheidet beim Intervallwechsel
    expand: [...PLAN_CHANGE_SUBSCRIPTION_EXPAND],
  })
  if (!subscriptions.data.length) {
    return NextResponse.json({ error: 'Kein aktives Abonnement gefunden.' }, { status: 400 })
  }
  const sub = subscriptions.data[0]
  const existingItem = sub.items.data[0]
  if (!existingItem) {
    return NextResponse.json({ error: 'Abonnement hat keine aktiven Positionen.' }, { status: 400 })
  }
  // Gleiche Regeln wie /api/billing/upgrade: Intervall aus Stripe, Jahr → Monat nie
  const currentInterval: BillingInterval = existingItem.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'
  if (existingItem.price.id === newPriceId || !canUpgradeTo(profile.plan, plan, currentInterval, interval)) {
    return NextResponse.json({ error: 'Nur Upgrades sind möglich.' }, { status: 400 })
  }
  const intervalChange = currentInterval !== interval

  try {
    // Dieselben Rabatte wie das echte Upgrade (Modell C: + 10 % Partnerpreis im Jahresabo)
    // Intervallwechsel: immer explizite Rabattliste (Intervall-beschränkte Coupons fallen weg,
    // ein geerbter Kunden-Rabatt wird übernommen) – Vorschau und Upgrade identisch.
    const customerDiscount = await loadInheritedCustomerDiscount(stripe, sub)
    const referral = referralDiscountsForPlanChange({ profile, sub, targetInterval: interval, currentInterval, customerDiscount })
    const previewDiscounts = referral.discounts ? { discounts: discountsParam(referral.discounts) } : {}

    // Preview 1: the immediate proration invoice (what always_invoice will charge now).
    // Preview 2: the next regular renewal invoice on the new plan.
    const [prorationPreview, renewalPreview] = await Promise.all([
      stripe.invoices.createPreview({
        subscription: sub.id,
        subscription_details: {
          items: [{ id: existingItem.id, price: newPriceId }],
          proration_behavior: 'always_invoice',
        },
        ...previewDiscounts,
      }),
      stripe.invoices.createPreview({
        subscription: sub.id,
        subscription_details: {
          items: [{ id: existingItem.id, price: newPriceId }],
          proration_behavior: 'none',
        },
        ...previewDiscounts,
      }),
    ])

    // Line amounts are gross (tax-inclusive prices) with discounts already applied.
    let creditCents = 0
    let chargeCents = 0
    for (const line of prorationPreview.lines.data) {
      if (line.amount < 0) creditCents += line.amount
      else chargeCents += line.amount
    }

    // Next regular billing date = start of the renewal preview's line period
    // (equals the subscription's current_period_end).
    // Intervallwechsel: Stripe rechnet ab heute neu ab → nächste Verlängerung = Ende der neuen
    // Jahresposition auf der Sofort-Rechnung.
    const renewalDate = intervalChange
      ? Math.max(0, ...prorationPreview.lines.data.filter(l => l.amount > 0).map(l => l.period?.end ?? 0)) || null
      : renewalPreview.lines.data[0]?.period?.start ??
        prorationPreview.lines.data[0]?.period?.end ??
        null

    return NextResponse.json({
      due_cents: prorationPreview.amount_due,
      charge_cents: chargeCents,
      credit_cents: creditCents, // negative or 0
      next_amount_cents: renewalPreview.total,
      renewal_date: renewalDate, // unix seconds
      currency: prorationPreview.currency,
      plan,
      interval,
      interval_change: intervalChange,
      // Modell C: wird beim Wechsel der Partnerpreis ergänzt? (für den Hinweis in der Oberfläche)
      referral_yearly_added: !!referral.addedCoupon,
    })
  } catch (err: any) {
    console.error('[billing/upgrade/preview] stripe error:', err?.message)
    return NextResponse.json(
      { error: 'Vorschau konnte nicht geladen werden. Bitte versuch es gleich nochmal.' },
      { status: 500 },
    )
  }
}
