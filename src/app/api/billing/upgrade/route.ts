import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { getStripe, getPriceIdByPlan, type PlanKey, type BillingInterval } from '@/lib/stripe/client'
import { canUpgradeTo } from '@/lib/plans'

/**
 * In-place subscription upgrade with proration.
 *
 * Uses stripe.subscriptions.update() so:
 * - User pays only the prorated difference for the remaining billing period
 * - Existing discounts (AKTION25, affiliate coupons) are automatically preserved
 *   because we do NOT pass a `discounts` parameter
 * - Tax rates stay on the subscription (already configured at checkout time)
 * - Works for SEPA: payment_behavior=pending_if_incomplete means the subscription
 *   item updates immediately, the invoice stays open until SEPA settles
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

  // Server-side guard: only upgrades allowed, no downgrades
  if (!canUpgradeTo(profile.plan, plan)) {
    return NextResponse.json({ error: 'Nur Upgrades sind möglich.' }, { status: 400 })
  }

  const stripe = getStripe()

  const subscriptions = await stripe.subscriptions.list({
    customer: profile.stripeCustomerId,
    status: 'active',
    limit: 1,
    expand: ['data.items'],
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
    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ id: existingItem.id, price: newPriceId }],

      // always_invoice: Stripe sofort eine Rechnung für die Differenz erstellt
      // und den anteiligen Betrag (verbleibende Tage im aktuellen Abrechnungszeitraum)
      // unmittelbar einzieht. Beim nächsten normalen Verlängerungstermin zahlt
      // der User dann den vollen neuen Preis.
      proration_behavior: 'always_invoice',

      // pending_if_incomplete: Wenn die sofortige Zahlung fehlschlägt (z.B. SEPA läuft
      // noch), bleibt das Abonnement aktiv und die Rechnung offen — kein harter Fehler.
      payment_behavior: 'pending_if_incomplete',

      // WICHTIG: discounts NICHT mitschicken → Stripe behält alle bestehenden
      // Rabatte (AKTION25, Affiliate-Gutscheine etc.) automatisch bei.

      // Falls der User zuvor gekündigt hatte (cancel_at_period_end), gleichzeitig
      // reaktivieren — Upgrade impliziert Weitermachen.
      ...(sub.cancel_at_period_end ? { cancel_at_period_end: false } : {}),
    })

    // DB sofort aktualisieren; Stripe-Webhook ist Safety-Net für den Fall,
    // dass der Request hier abbricht.
    const itemTs = (updated.items.data[0] as any)?.current_period_end
    const rootTs = (updated as any).current_period_end
    const currentPeriodEnd = (itemTs ?? rootTs) ? new Date((itemTs ?? rootTs) * 1000) : null

    await db.update(users).set({
      plan,
      billingInterval: interval,
      subscriptionStatus: updated.status,
      stripeSubscriptionId: updated.id,
      ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
      ...(sub.cancel_at_period_end ? { deactivatedAt: null } : {}),
    }).where(eq(users.id, user.id))

    return NextResponse.json({ success: true, plan, interval })
  } catch (err: any) {
    console.error('[billing/upgrade] stripe error:', err?.message)
    return NextResponse.json(
      { error: err?.message ?? 'Upgrade fehlgeschlagen.' },
      { status: 500 },
    )
  }
}
