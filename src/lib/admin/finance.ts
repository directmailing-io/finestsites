/**
 * Finanz-Kennzahlen direkt aus Stripe – einzige Quelle für Admin-Dashboard und /admin/finanzen.
 *
 * Warum eigenes Modul (12.10.2026): Das Dashboard holte nur die ersten 100 Abos/Rechnungen,
 * zählte nur bezahlte Rechnungen (SEPA in Bearbeitung fehlte) und rechnete MRR mit festen
 * Listenpreisen aus der eigenen DB. Hier wird alles vollständig paginiert aus Stripe gelesen:
 *   - Umsatz = Zahlungen (Charges): bezahlt / SEPA in Bearbeitung / fehlgeschlagen (offen vs. später bezahlt)
 *   - Abos = Stripe-Subscriptions mit echtem Preis (inkl. Alt-Preise) und aktivem Rabatt
 *   - Guthaben/Auszahlungen = Stripe-Balance + Payouts
 * Ergebnis wird 5 Minuten im Prozess gecacht (Stripe-Rate-Limits, schnelle Seite).
 */
import type Stripe from 'stripe'
import { getStripe, getPlanByPriceId } from '@/lib/stripe/client'

export type PlanKey = 'starter' | 'pro' | 'unlimited' | 'unbekannt'

export interface MonthRow {
  key: string            // 2026-10
  paidCents: number      // erfolgreich eingegangen (brutto)
  pendingCents: number   // SEPA in Bearbeitung
  refundedCents: number
  failedOpenCents: number
  paidCount: number
  pendingCount: number
}

export interface OpenFailure {
  created: number
  amountCents: number
  email: string | null
  method: string | null
  reason: string | null
  customerId: string | null
}

export interface SubRow {
  id: string
  customerId: string
  email: string | null
  status: Stripe.Subscription.Status
  plan: PlanKey
  interval: 'month' | 'year'
  listCents: number          // Preis laut Stripe-Preis (pro Intervall)
  effectiveCents: number     // nach aktivem Rabatt (pro Intervall)
  mrrCents: number           // monatliches Äquivalent, nach Rabatt
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: number | null
  created: number
}

export interface FinanceSnapshot {
  generatedAt: number
  balance: { availableCents: number; pendingCents: number }
  payouts: { paidCents: number; inTransitCents: number; count: number; lastPaidAt: number | null }
  fees: { totalCents: number }
  charges: {
    paid: { count: number; cents: number }
    pending: { count: number; cents: number }
    refundedCents: number
    failedOpen: OpenFailure[]
    failedRecovered: { count: number; cents: number }
    firstPaymentAt: number | null
  }
  months: MonthRow[]         // alle Monate seit erster Zahlung, neueste zuletzt
  subs: {
    rows: SubRow[]
    byStatus: Record<string, number>
    active: number           // active + trialing
    pastDue: number
    cancelingAtPeriodEnd: number
    byPlan: Record<PlanKey, { month: number; year: number; mrrCents: number }>
    mrrCents: number         // effektiv (nach Rabatten), active + trialing + past_due
    mrrListCents: number     // ohne Rabatte
    mrrAtRiskCents: number   // gekündigt zum Periodenende
    mrrPastDueCents: number
  }
}

const TTL_MS = 5 * 60_000
let cache: { at: number; data: FinanceSnapshot } | null = null
let inflight: Promise<FinanceSnapshot> | null = null

export async function getFinanceSnapshot(opts: { fresh?: boolean } = {}): Promise<FinanceSnapshot> {
  if (!opts.fresh && cache && Date.now() - cache.at < TTL_MS) return cache.data
  if (inflight) return inflight
  inflight = build().then(d => { cache = { at: Date.now(), data: d }; return d }).finally(() => { inflight = null })
  return inflight
}

const monthKey = (ts: number) => {
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Aktiver Rabatt einer Subscription als Funktion Preis → effektiver Preis. */
function applyDiscounts(cents: number, sub: Stripe.Subscription): number {
  const now = Date.now() / 1000
  const list = ((sub as unknown as { discounts?: unknown[] }).discounts ?? []) as Array<Stripe.Discount | string>
  let out = cents
  for (const d of list) {
    if (typeof d === 'string') continue
    if (d.end && d.end < now) continue
    const src = (d as unknown as { source?: { coupon?: Stripe.Coupon | string } }).source
    const coupon = (typeof src?.coupon === 'object' ? src.coupon : (d as unknown as { coupon?: Stripe.Coupon }).coupon) as Stripe.Coupon | undefined
    if (!coupon) continue
    if (coupon.percent_off) out = Math.round(out * (1 - coupon.percent_off / 100))
    else if (coupon.amount_off) out = Math.max(0, out - coupon.amount_off)
  }
  return out
}

async function build(): Promise<FinanceSnapshot> {
  const stripe = getStripe()
  const priceToPlan = getPlanByPriceId()

  const [balance, charges, subs, payouts, balanceTx] = await Promise.all([
    stripe.balance.retrieve(),
    stripe.charges.list({ limit: 100, expand: ['data.customer'] }).autoPagingToArray({ limit: 10_000 }),
    stripe.subscriptions.list({ status: 'all', limit: 100, expand: ['data.discounts.source.coupon', 'data.customer'] }).autoPagingToArray({ limit: 10_000 }),
    stripe.payouts.list({ limit: 100 }).autoPagingToArray({ limit: 10_000 }),
    stripe.balanceTransactions.list({ limit: 100 }).autoPagingToArray({ limit: 10_000 }),
  ])

  const eur = (arr: Stripe.Balance.Available[] | Stripe.Balance.Pending[]) =>
    arr.filter(b => b.currency === 'eur').reduce((s, b) => s + b.amount, 0)

  // ── Zahlungen ────────────────────────────────────────────────────────────
  const custOf = (c: Stripe.Charge) => typeof c.customer === 'string' ? c.customer : c.customer?.id ?? null
  const emailOf = (c: Stripe.Charge) =>
    c.billing_details?.email ?? c.receipt_email
    ?? (c.customer && typeof c.customer === 'object' && !('deleted' in c.customer && c.customer.deleted) ? (c.customer as Stripe.Customer).email : null)

  const months = new Map<string, MonthRow>()
  const row = (k: string) => {
    let r = months.get(k)
    if (!r) { r = { key: k, paidCents: 0, pendingCents: 0, refundedCents: 0, failedOpenCents: 0, paidCount: 0, pendingCount: 0 }; months.set(k, r) }
    return r
  }

  let paidCount = 0, paidCents = 0, pendingCount = 0, pendingCents = 0, refundedCents = 0
  const failedOpen: OpenFailure[] = []
  let recCount = 0, recCents = 0
  for (const c of charges) {
    const r = row(monthKey(c.created))
    if (c.status === 'succeeded') {
      paidCount++; paidCents += c.amount; r.paidCents += c.amount; r.paidCount++
      if (c.amount_refunded) { refundedCents += c.amount_refunded; r.refundedCents += c.amount_refunded }
    } else if (c.status === 'pending') {
      pendingCount++; pendingCents += c.amount; r.pendingCents += c.amount; r.pendingCount++
    } else if (c.status === 'failed') {
      // „Später bezahlt“: derselbe Kunde hat danach erfolgreich oder per SEPA in Bearbeitung gezahlt
      const cust = custOf(c)
      const recovered = !!cust && charges.some(o => custOf(o) === cust && o.created > c.created && (o.status === 'succeeded' || o.status === 'pending'))
      if (recovered) { recCount++; recCents += c.amount }
      else {
        r.failedOpenCents += c.amount
        failedOpen.push({
          created: c.created, amountCents: c.amount, email: emailOf(c), customerId: cust,
          method: c.payment_method_details?.type ?? null,
          reason: c.outcome?.reason ?? c.failure_code ?? null,
        })
      }
    }
  }
  const firstPaymentAt = charges.length ? Math.min(...charges.map(c => c.created)) : null

  // Alle Monate seit der ersten Zahlung (auch leere), chronologisch
  const monthList: MonthRow[] = []
  if (firstPaymentAt) {
    const start = new Date(firstPaymentAt * 1000), now = new Date()
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthList.push(months.get(k) ?? row(k))
    }
  }

  // ── Abos ─────────────────────────────────────────────────────────────────
  const rows: SubRow[] = []
  const byStatus: Record<string, number> = {}
  const byPlan: FinanceSnapshot['subs']['byPlan'] = {
    starter: { month: 0, year: 0, mrrCents: 0 }, pro: { month: 0, year: 0, mrrCents: 0 },
    unlimited: { month: 0, year: 0, mrrCents: 0 }, unbekannt: { month: 0, year: 0, mrrCents: 0 },
  }
  let mrr = 0, mrrList = 0, atRisk = 0, pastDueMrr = 0, active = 0, pastDue = 0, canceling = 0
  for (const s of subs) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1
    const item = s.items.data[0]
    if (!item) continue
    const interval = item.price.recurring?.interval === 'year' ? 'year' : 'month'
    const listCents = (item.price.unit_amount ?? 0) * (item.quantity ?? 1)
    const effectiveCents = applyDiscounts(listCents, s)
    const mrrCents = interval === 'year' ? Math.round(effectiveCents / 12) : effectiveCents
    const plan: PlanKey = priceToPlan[item.price.id] ?? 'unbekannt'
    const cust = s.customer
    const email = typeof cust === 'object' && cust && !('deleted' in cust && cust.deleted) ? (cust as Stripe.Customer).email : null
    const periodEnd = (item as unknown as { current_period_end?: number }).current_period_end
      ?? (s as unknown as { current_period_end?: number }).current_period_end ?? null
    rows.push({
      id: s.id, customerId: typeof cust === 'string' ? cust : cust.id, email, status: s.status, plan, interval,
      listCents, effectiveCents, mrrCents, cancelAtPeriodEnd: s.cancel_at_period_end, currentPeriodEnd: periodEnd, created: s.created,
    })
    const counts = s.status === 'active' || s.status === 'trialing' || s.status === 'past_due'
    if (!counts) continue
    if (s.status === 'past_due') { pastDue++; pastDueMrr += mrrCents } else active++
    mrr += mrrCents
    mrrList += interval === 'year' ? Math.round(listCents / 12) : listCents
    byPlan[plan][interval]++
    byPlan[plan].mrrCents += mrrCents
    if (s.cancel_at_period_end) { canceling++; atRisk += mrrCents }
  }

  const fees = balanceTx.reduce((s, t) => s + t.fee, 0) + balanceTx.filter(t => t.type === 'stripe_fee').reduce((s, t) => s - t.amount, 0)
  const paidPayouts = payouts.filter(p => p.status === 'paid')

  return {
    generatedAt: Date.now(),
    balance: { availableCents: eur(balance.available), pendingCents: eur(balance.pending) },
    payouts: {
      paidCents: paidPayouts.reduce((s, p) => s + p.amount, 0),
      inTransitCents: payouts.filter(p => p.status === 'pending' || p.status === 'in_transit').reduce((s, p) => s + p.amount, 0),
      count: paidPayouts.length,
      lastPaidAt: paidPayouts.length ? Math.max(...paidPayouts.map(p => p.arrival_date)) : null,
    },
    fees: { totalCents: fees },
    charges: {
      paid: { count: paidCount, cents: paidCents },
      pending: { count: pendingCount, cents: pendingCents },
      refundedCents,
      failedOpen: failedOpen.sort((a, b) => b.created - a.created),
      failedRecovered: { count: recCount, cents: recCents },
      firstPaymentAt,
    },
    months: monthList,
    subs: {
      rows: rows.sort((a, b) => b.created - a.created),
      byStatus, active, pastDue, cancelingAtPeriodEnd: canceling, byPlan,
      mrrCents: mrr, mrrListCents: mrrList, mrrAtRiskCents: atRisk, mrrPastDueCents: pastDueMrr,
    },
  }
}
