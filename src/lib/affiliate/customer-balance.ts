/**
 * Kundenguthaben des Partners bei Stripe (NUR der eigene Stripe-Kunde, nie das Plattform-Guthaben).
 * Stripe: customer.balance < 0 = Guthaben, das mit den nächsten Rechnungen verrechnet wird.
 *
 * Kurzer Speicher-Cache je Kunde (PM2-Prozess), damit wiederholte Seitenaufrufe Stripe nicht
 * belasten. Fehler bei Stripe → null (die Seite zeigt die Zeile dann einfach nicht).
 */

import type Stripe from 'stripe'

const TTL_MS = 5 * 60 * 1000
const MAX_ENTRIES = 2000
const cache = new Map<string, { at: number; credit: number | null }>()

/** Guthaben in Cent (positiv = Guthaben des Partners), 0 = keins, null = unbekannt. */
export async function getCustomerCreditCents(
  stripe: Stripe,
  customerId: string,
  opts: { fresh?: boolean } = {},
): Promise<number | null> {
  const hit = cache.get(customerId)
  if (!opts.fresh && hit && Date.now() - hit.at < TTL_MS) return hit.credit

  let credit: number | null
  try {
    const c = await stripe.customers.retrieve(customerId)
    if ((c as Stripe.DeletedCustomer).deleted) credit = null
    else {
      const cust = c as Stripe.Customer
      // Nur Euro-Guthaben ist für FinestSites-Rechnungen relevant
      credit = cust.currency && cust.currency !== 'eur' ? null : Math.max(0, -(cust.balance ?? 0))
    }
  } catch (err) {
    console.error('[affiliate] customer balance lookup failed:', err instanceof Error ? err.message : err)
    // Fehler nicht cachen, aber einen alten Wert lieber zeigen als nichts
    return hit?.credit ?? null
  }

  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
  cache.set(customerId, { at: Date.now(), credit })
  return credit
}

/** Nach einer Verrechnung: nächster Aufruf liest frisch. */
export function invalidateCustomerCredit(customerId: string): void {
  cache.delete(customerId)
}

/**
 * Wird das eigene Abo des Partners künftig überhaupt etwas kosten? Ein Abo mit 100-%-Rabatt
 * (Team-/Admin-/Gratis-Gutschein) würde gutgeschriebenes Guthaben nie verbrauchen.
 * Prüft die Vorschau der nächsten Abo-Rechnung (rein lesend, inkl. aller Rabatte, VOR Guthaben):
 *  true  = nächste Rechnung > 0 → Verrechnung sinnvoll
 *  false = kein laufendes Abo oder nächste Rechnung 0 € → wie "ohne Abo" behandeln
 *  null  = unbekannt (Stripe-Fehler) → Aufrufer entscheidet (bisheriges Verhalten: verrechnen)
 */
export async function subscriptionConsumesCredit(stripe: Stripe, customerId: string): Promise<boolean | null> {
  try {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 })
    const sub = subs.data[0]
    if (!sub) {
      const trialing = await stripe.subscriptions.list({ customer: customerId, status: 'trialing', limit: 1 })
      if (!trialing.data[0]) return false
      return await previewTotalPositive(stripe, customerId, trialing.data[0].id)
    }
    return await previewTotalPositive(stripe, customerId, sub.id)
  } catch (err) {
    console.error('[customer-balance] subscription preview failed:', err instanceof Error ? err.message : err)
    return null
  }
}

async function previewTotalPositive(stripe: Stripe, customerId: string, subscriptionId: string): Promise<boolean> {
  const preview = await stripe.invoices.createPreview({ customer: customerId, subscription: subscriptionId })
  return (preview.total ?? 0) > 0
}
