/**
 * Treue-Rabatt (Daniel, 03.11.2026; docs/kuendigung/konzept.html, Abschnitt 07/08): 10 % dauerhaft auf
 * das laufende Abo, nur aus dem Kündigungsflow heraus, einmal pro Konto. Der Coupon (STRIPE_RETENTION_COUPON_ID,
 * Standard BLEIB10) wird
 *   - sofort angewendet, wenn kein Rabatt läuft, oder
 *   - vorgemerkt („Rabatt-Anschluss“), wenn ein befristeter Rabatt läuft: der Webhook wendet ihn bei
 *     `customer.discount.deleted` an, der tägliche Cron ist das Sicherheitsnetz.
 * Rabatte werden nie gestapelt. Die Markierung „gezeigt“ (users.retention_offer_shown_at) setzt
 * cancellation.ts beim Anzeigen des Angebots, nicht erst beim Annehmen.
 */
import type Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'
import { PLANS, PLAN_ORDER, type BillingInterval, type PlanKey } from '@/lib/plans'
import { activeSubscription, formatDate } from '@/lib/billing/plan-change'
import { RETENTION_PERCENT } from '@/lib/billing/cancellation-offer'
import { sendEmail } from '@/lib/resend'
import { retentionDiscountEmail } from '@/lib/email/templates'

export class RetentionError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message)
    this.name = 'RetentionError'
  }
}

export function retentionCouponId(): string {
  return (process.env.STRIPE_RETENTION_COUPON_ID ?? 'BLEIB10').trim()
}

export type ActiveDiscount = { percent: number; end: Date | null; forever: boolean; coupon: string }

/** Laufende Rabatte eines Abos (mit `expand: discounts.source.coupon` geladen). */
export function activeDiscountsOf(sub: Stripe.Subscription, now: Date = new Date()): ActiveDiscount[] {
  const list = (sub as unknown as { discounts?: unknown[] }).discounts ?? []
  const out: ActiveDiscount[] = []
  for (const d of list) {
    if (!d || typeof d !== 'object') continue
    const disc = d as { end?: number | null; coupon?: unknown; source?: { coupon?: unknown } }
    const raw = disc.source?.coupon ?? disc.coupon
    const coupon = typeof raw === 'string' ? raw : raw && typeof raw === 'object' ? (raw as { id?: string }).id ?? '' : ''
    const obj = raw && typeof raw === 'object' ? (raw as { percent_off?: number | null; duration?: string }) : null
    const end = disc.end ? new Date(disc.end * 1000) : null
    if (end && end.getTime() <= now.getTime()) continue
    out.push({ percent: obj?.percent_off ?? 0, end, forever: obj?.duration === 'forever' || (!end && obj?.duration !== 'once'), coupon })
  }
  return out
}

/** Mindestens eine bezahlte Rechnung mit Betrag > 0 (kein Angebot in der ersten Woche / für reine Guthaben-Konten). */
export async function hasPaidInvoice(stripe: Stripe, customerId: string): Promise<boolean> {
  const inv = await stripe.invoices.list({ customer: customerId, status: 'paid', limit: 10 })
  return inv.data.some(i => (i.amount_paid ?? 0) > 0)
}

function priceAfter(plan: string, interval: string | null): { price: number; unit: 'Monat' | 'Jahr' } {
  const key: PlanKey = PLAN_ORDER.includes(plan as PlanKey) ? (plan as PlanKey) : 'starter'
  const yearly = interval === 'yearly'
  const base = yearly ? PLANS[key].yearly_eur : PLANS[key].monthly_eur
  return { price: Math.round(base * (1 - RETENTION_PERCENT / 100) * 100) / 100, unit: yearly ? 'Jahr' : 'Monat' }
}

/**
 * Treue-Rabatt annehmen. 'now' = sofort auf dem Abo, 'pending' = vorgemerkt bis der laufende Rabatt endet.
 */
export async function applyRetentionDiscount(userId: string): Promise<{ mode: 'now' | 'pending'; startsAfter: Date | null }> {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      email: true, plan: true, billingInterval: true, stripeCustomerId: true, isAdmin: true, isInternal: true,
      retentionCouponAppliedAt: true, retentionCouponPending: true, retentionOfferShownAt: true,
    },
  })
  if (!u) throw new RetentionError('NOT_FOUND', 404, 'Konto nicht gefunden.')
  if (u.retentionCouponAppliedAt || u.retentionCouponPending) throw new RetentionError('ALREADY', 409, 'Der Treue-Rabatt ist für dein Konto schon aktiv.')
  if (u.isAdmin || u.isInternal) throw new RetentionError('NOT_ELIGIBLE', 403, 'Für dieses Konto ist der Rabatt nicht verfügbar.')
  if (!u.stripeCustomerId) throw new RetentionError('NO_SUBSCRIPTION', 400, 'Kein aktives Abonnement gefunden.')
  const stripe = getStripe()
  const sub = await activeSubscription(stripe, u.stripeCustomerId)
  if (!sub) throw new RetentionError('NO_SUBSCRIPTION', 400, 'Kein aktives Abonnement gefunden.')
  if (sub.schedule) throw new RetentionError('SCHEDULE', 409, 'Zieh zuerst den geplanten Tarifwechsel zurück, dann kannst du den Rabatt nutzen.')
  const now = new Date()
  const active = activeDiscountsOf(sub, now)
  if (active.some(d => d.coupon === retentionCouponId())) {
    await db.update(users).set({ retentionCouponAppliedAt: now, retentionCouponPending: false }).where(eq(users.id, userId))
    return { mode: 'now', startsAfter: null }
  }
  const { price, unit } = priceAfter(u.plan, u.billingInterval)
  if (active.length === 0) {
    await stripe.subscriptions.update(sub.id, { discounts: [{ coupon: retentionCouponId() }], proration_behavior: 'none' })
    await db.update(users).set({ retentionCouponAppliedAt: now, retentionCouponPending: false, retentionOfferShownAt: u.retentionOfferShownAt ?? now }).where(eq(users.id, userId))
    console.info('[retention] applied now:', userId)
    if (u.email) {
      sendEmail({ to: u.email, subject: 'Dein Treue-Rabatt ist aktiv · FinestSites', html: retentionDiscountEmail({ priceAfter: price, unit, startsAfter: null }), type: 'retention_discount' }).catch(() => {})
    }
    return { mode: 'now', startsAfter: null }
  }
  if (active.some(d => d.forever || !d.end)) throw new RetentionError('HAS_FOREVER', 409, 'Auf deinem Abo läuft schon ein dauerhafter Rabatt.')
  const end = active.map(d => d.end!).sort((a, b) => b.getTime() - a.getTime())[0]
  await db.update(users).set({ retentionCouponPending: true, retentionOfferShownAt: u.retentionOfferShownAt ?? now }).where(eq(users.id, userId))
  console.info('[retention] pending until discount ends:', userId, end.toISOString())
  if (u.email) {
    sendEmail({ to: u.email, subject: 'Dein Treue-Rabatt ist vorgemerkt · FinestSites', html: retentionDiscountEmail({ priceAfter: price, unit, startsAfter: formatDate(end) }), type: 'retention_discount' }).catch(() => {})
  }
  return { mode: 'pending', startsAfter: end }
}

/**
 * Webhook (customer.discount.deleted) und Cron: vorgemerkten Treue-Rabatt anwenden, sobald kein Rabatt
 * mehr läuft. Idempotent – ohne Vormerkung oder mit noch laufendem Rabatt passiert nichts.
 */
export async function applyPendingRetentionIfDue(userId: string): Promise<boolean> {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, plan: true, billingInterval: true, stripeCustomerId: true, retentionCouponPending: true, retentionCouponAppliedAt: true, deletedAt: true },
  })
  if (!u?.retentionCouponPending || u.retentionCouponAppliedAt || u.deletedAt || !u.stripeCustomerId) return false
  const stripe = getStripe()
  const sub = await activeSubscription(stripe, u.stripeCustomerId)
  if (!sub) return false
  if (sub.schedule) return false
  const active = activeDiscountsOf(sub)
  if (active.length > 0) return false
  await stripe.subscriptions.update(sub.id, { discounts: [{ coupon: retentionCouponId() }], proration_behavior: 'none' })
  await db.update(users).set({ retentionCouponAppliedAt: new Date(), retentionCouponPending: false }).where(eq(users.id, userId))
  console.info('[retention] pending applied:', userId)
  return true
}

/** Für die Abo-Karte: Rabatt-Anschluss vorgemerkt? */
export const RETENTION_COLUMNS = { retentionOfferShownAt: true, retentionCouponPending: true, retentionCouponAppliedAt: true } as const

export type RetentionInfo = { applied: boolean; pending: boolean; shown: boolean }
export function retentionInfoOf(u: { retentionOfferShownAt: Date | null; retentionCouponPending: boolean; retentionCouponAppliedAt: Date | null }): RetentionInfo {
  return { applied: !!u.retentionCouponAppliedAt, pending: u.retentionCouponPending, shown: !!u.retentionOfferShownAt }
}

export type { BillingInterval }
