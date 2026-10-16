import type Stripe from 'stripe'

/**
 * Versionsfeste Lesehilfen für Stripe-Objekte.
 *
 * Der Webhook-Endpunkt liefert Payloads in API-Version 2024-04-10 (invoice.subscription,
 * charge.invoice vorhanden). Das SDK (stripe 22) ruft dagegen mit 2026-03-25.dahlia ab –
 * dort gibt es charge.invoice nicht mehr, und die Subscription einer Rechnung steht unter
 * invoice.parent.subscription_details.subscription. Diese Helfer lesen beide Formen.
 */

function idOf(v: unknown): string | null {
  if (typeof v === 'string' && v) return v
  if (v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string') return (v as { id: string }).id
  return null
}

/** Subscription-ID einer Rechnung (alte Payload-Form oder dahlia-Form). */
export function invoiceSubscriptionId(inv: unknown): string | null {
  const i = inv as { subscription?: unknown; parent?: { subscription_details?: { subscription?: unknown } | null } | null } | null
  if (!i) return null
  return idOf(i.subscription) ?? idOf(i.parent?.subscription_details?.subscription)
}

/**
 * Coupon-IDs, die auf einer Rechnung wirken. Liest die alte Form (invoice.discount.coupon),
 * expandierte discounts[] (alt: discount.coupon, dahlia: discount.source.coupon).
 * Nicht expandierte discounts (nur IDs) lassen sich ohne API-Aufruf nicht auflösen →
 * `unknown: true`, der Aufrufer fällt dann auf den DB-Stand zurück.
 */
export function invoiceCouponIds(inv: unknown): { ids: string[]; unknown: boolean } {
  const i = inv as { discount?: { coupon?: unknown; source?: { coupon?: unknown } } | null; discounts?: unknown[] } | null
  const ids = new Set<string>()
  let unknown = false
  const fromDiscount = (d: unknown) => {
    if (typeof d === 'string') { unknown = true; return }
    const obj = d as { coupon?: unknown; source?: { coupon?: unknown } } | null
    const c = idOf(obj?.coupon) ?? idOf(obj?.source?.coupon)
    if (c) ids.add(c)
  }
  if (i?.discount) fromDiscount(i.discount)
  if (Array.isArray(i?.discounts)) for (const d of i.discounts) fromDiscount(d)
  return { ids: [...ids], unknown }
}

/**
 * Rechnungs-ID zu einer Charge. Reihenfolge:
 * 1. charge.invoice (nur in alten Payloads vorhanden)
 * 2. charge.payment_intent → invoice_payments (dahlia-Weg, funktioniert immer)
 */
export async function resolveChargeInvoiceId(
  stripe: Pick<Stripe, 'invoicePayments'>,
  charge: unknown,
): Promise<string | null> {
  const ch = charge as { invoice?: unknown; payment_intent?: unknown } | null
  const direct = idOf(ch?.invoice)
  if (direct) return direct
  const piId = idOf(ch?.payment_intent)
  if (!piId) return null
  const list = await stripe.invoicePayments.list({
    payment: { type: 'payment_intent', payment_intent: piId },
    limit: 1,
  })
  return idOf(list.data[0]?.invoice)
}
