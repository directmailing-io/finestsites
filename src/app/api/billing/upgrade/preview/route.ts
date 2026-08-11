import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { getStripe, getPriceIdByPlan, type PlanKey, type BillingInterval } from '@/lib/stripe/client'
import { canUpgradeTo } from '@/lib/plans'

/**
 * Read-only preview of an in-place upgrade: what the user pays TODAY
 * (prorated, discounts + tax included) and what the plan costs at the
 * next renewal. Mirrors exactly what /api/billing/upgrade will charge
 * (same items + proration_behavior=always_invoice).
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const { plan, interval = 'monthly' } = await req.json() as {
    plan: PlanKey; interval?: BillingInterval
  }

  const newPriceId = getPriceIdByPlan(plan, interval)
  if (!newPriceId) return NextResponse.json({ error: 'Ungültiger Plan.' }, { status: 400 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeCustomerId: true, plan: true },
  })
  if (!profile?.stripeCustomerId) {
    return NextResponse.json({ error: 'Kein aktives Abonnement gefunden.' }, { status: 400 })
  }
  if (!canUpgradeTo(profile.plan, plan)) {
    return NextResponse.json({ error: 'Nur Upgrades sind möglich.' }, { status: 400 })
  }

  const stripe = getStripe()
  const subscriptions = await stripe.subscriptions.list({
    customer: profile.stripeCustomerId,
    status: 'active',
    limit: 1,
  })
  if (!subscriptions.data.length) {
    return NextResponse.json({ error: 'Kein aktives Abonnement gefunden.' }, { status: 400 })
  }
  const sub = subscriptions.data[0]
  const existingItem = sub.items.data[0]
  if (!existingItem) {
    return NextResponse.json({ error: 'Abonnement hat keine aktiven Positionen.' }, { status: 400 })
  }

  try {
    // Preview 1: the immediate proration invoice (what always_invoice will charge now).
    // Preview 2: the next regular renewal invoice on the new plan.
    const [prorationPreview, renewalPreview] = await Promise.all([
      stripe.invoices.createPreview({
        subscription: sub.id,
        subscription_details: {
          items: [{ id: existingItem.id, price: newPriceId }],
          proration_behavior: 'always_invoice',
        },
      }),
      stripe.invoices.createPreview({
        subscription: sub.id,
        subscription_details: {
          items: [{ id: existingItem.id, price: newPriceId }],
          proration_behavior: 'none',
        },
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
    const renewalDate =
      renewalPreview.lines.data[0]?.period?.start ??
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
    })
  } catch (err: any) {
    console.error('[billing/upgrade/preview] stripe error:', err?.message)
    return NextResponse.json(
      { error: 'Vorschau konnte nicht geladen werden. Bitte versuch es gleich nochmal.' },
      { status: 500 },
    )
  }
}
