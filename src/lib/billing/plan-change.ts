/**
 * Tarifwechsel nach unten – zum Ende des bezahlten Zeitraums (Daniel, 28.10.2026).
 *
 * Bisher gab es nur Upgrades (sofort, anteilig). Wer einen kleineren Tarif wollte, musste kündigen
 * und neu buchen. Jetzt plant der Nutzer den Wechsel in den Einstellungen; bis zum Laufzeitende
 * bleibt alles wie bisher, danach läuft das Abo im kleineren Tarif weiter – ohne Kündigung, ohne
 * neue Buchung, ohne Erstattung oder Zwischenrechnung.
 *
 * Mechanik: ein Stripe Subscription Schedule (`from_subscription`) mit zwei Phasen –
 *   Phase 1 = der laufende Zeitraum unverändert (Preis, Rabatte),
 *   Phase 2 = der neue Preis ab dem Periodenende (ein Zyklus), `end_behavior: 'release'`,
 * danach läuft das Abo normal weiter. Bestehende Rabatte, die über das Periodenende hinaus gelten,
 * werden übernommen: dauerhafte (Partner 10 %) ganz, befristete (3-Monats-Aktion) nur für ihre
 * Restlaufzeit – ggf. als eigene Phase (siehe splitCarryOverDiscounts).
 * Beim Wechsel schickt Stripe `customer.subscription.updated` mit dem neuen Preis → der Webhook
 * setzt den Tarif in der DB wie bisher und ruft `applyPendingPlanIfDue()` auf: überzählige
 * Webseiten werden zu Entwürfen (die vom Nutzer gewählten bleiben online), Merker gelöscht, Mail.
 *
 * Regeln:
 *  - nur nach unten, nur im gleichen Intervall (Monat → Monat, Jahr → Jahr)
 *  - nicht bei gekündigtem Abo, offener Zahlung oder laufender Kontolöschung
 *  - hat der Nutzer mehr veröffentlichte Premium-Seiten als der Zieltarif erlaubt, muss er beim
 *    Einplanen wählen, welche online bleiben (genau so viele, wie der Zieltarif erlaubt)
 *  - Upgrade, Kündigung oder Kontolöschung heben einen geplanten Wechsel auf (Schedule wird gelöst)
 *  - Zurückziehen jederzeit bis zum Periodenende möglich
 */
import type Stripe from 'stripe'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, userSites } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'
import { PLANS, PLAN_ORDER, getPlanMaxSites, getPriceIdByPlan, type BillingInterval, type PlanKey } from '@/lib/plans'
import { shouldBeOffline, recoveryColumns } from '@/lib/billing/payment-recovery'
import { unpublishSitesBeyondLimit } from '@/lib/billing/site-access'
import { sendEmail } from '@/lib/resend'
import { planChangeDoneEmail, planChangeScheduledEmail } from '@/lib/email/templates'

export class PlanChangeError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message)
    this.name = 'PlanChangeError'
  }
}

export type PendingPlanChange = {
  plan: PlanKey
  interval: BillingInterval
  /** ISO-Zeitpunkt des Wechsels (Periodenende beim Einplanen) */
  at: string | null
  /** Webseiten, die nach dem Wechsel online bleiben (leer = alle passen) */
  keep_site_ids: string[]
}

export const PENDING_PLAN_COLUMNS = {
  pendingPlan: true, pendingPlanInterval: true, pendingPlanAt: true, pendingPlanScheduleId: true, pendingKeepSiteIds: true,
} as const

type PendingRow = {
  pendingPlan: string | null
  pendingPlanInterval: string | null
  pendingPlanAt: Date | null
  pendingPlanScheduleId: string | null
  pendingKeepSiteIds: string[] | null
}

export function pendingChangeOf(u: PendingRow): PendingPlanChange | null {
  if (!u.pendingPlan || !PLAN_ORDER.includes(u.pendingPlan as PlanKey)) return null
  return {
    plan: u.pendingPlan as PlanKey,
    interval: u.pendingPlanInterval === 'yearly' ? 'yearly' : 'monthly',
    at: u.pendingPlanAt ? u.pendingPlanAt.toISOString() : null,
    keep_site_ids: u.pendingKeepSiteIds ?? [],
  }
}

const PENDING_CLEARED = {
  pendingPlan: null, pendingPlanInterval: null, pendingPlanAt: null, pendingPlanScheduleId: null, pendingKeepSiteIds: [] as string[],
}

/** Veröffentlichte Premium-Seiten des Nutzers (zählen gegen das Tarif-Limit) mit Titel und Adresse. */
export async function paidPublishedSites(userId: string): Promise<{ id: string; title: string; url: string | null }[]> {
  const rows = await db.query.userSites.findMany({
    where: and(eq(userSites.userId, userId), eq(userSites.status, 'published')),
    columns: { id: true, customDomain: true, createdAt: true },
    with: { template: { columns: { title: true, domain: true, isFree: true } }, user: { columns: { username: true } } },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  })
  return rows
    .filter(s => s.template && !s.template.isFree)
    .map(s => ({
      id: s.id,
      title: s.template?.title ?? 'Webseite',
      url: s.customDomain ? `https://${s.customDomain}` : (s.user?.username && s.template?.domain ? `https://${s.user.username}.${s.template.domain}` : null),
    }))
}

function periodEndOf(sub: Stripe.Subscription): number | null {
  const itemTs = (sub.items.data[0] as unknown as { current_period_end?: number })?.current_period_end
  const rootTs = (sub as unknown as { current_period_end?: number }).current_period_end
  return itemTs ?? rootTs ?? null
}

/**
 * Rabatte, die über den Wechsel hinaus gelten – getrennt nach dauerhaft (`forever`) und befristet
 * (`repeating`). Stripe nimmt in Zeitplänen keine bestehende Discount-ID an, nur Gutschein-Kennungen;
 * ein neu angewandter befristeter Gutschein würde seine Laufzeit von vorn beginnen. Deshalb wird die
 * Restlaufzeit selbst begrenzt: befristete Gutscheine gelten nur für so viele Abrechnungen nach dem
 * Wechsel, wie noch vor ihrem ursprünglichen Ende liegen (Daniel 28.10.2026: 3-Monats-Rabatt, ein
 * Monat genutzt → nach dem Wechsel genau 2 Monate, nicht 3). `once` ist mit der ersten Rechnung verbraucht.
 */
function splitCarryOverDiscounts(sub: Stripe.Subscription, switchAt: number, interval: BillingInterval): {
  forever: Stripe.SubscriptionScheduleUpdateParams.Phase.Discount[]
  limited: { discounts: Stripe.SubscriptionScheduleUpdateParams.Phase.Discount[]; cycles: number }
} {
  const list = (sub as unknown as { discounts?: unknown[] }).discounts ?? []
  const forever: Stripe.SubscriptionScheduleUpdateParams.Phase.Discount[] = []
  const limited: Stripe.SubscriptionScheduleUpdateParams.Phase.Discount[] = []
  let cycles = Infinity
  for (const d of list) {
    if (!d || typeof d !== 'object') continue
    const disc = d as { end?: number | null; coupon?: unknown; source?: { coupon?: unknown } }
    const couponRaw = disc.source?.coupon ?? disc.coupon
    const couponId = typeof couponRaw === 'string' ? couponRaw : couponRaw && typeof couponRaw === 'object' ? (couponRaw as { id?: string }).id ?? null : null
    const duration = couponRaw && typeof couponRaw === 'object' ? (couponRaw as { duration?: string }).duration : undefined
    if (!couponId || duration === 'once') continue
    if (duration === 'forever' || !disc.end) { forever.push({ coupon: couponId }); continue }
    const n = billingCyclesBefore(switchAt, disc.end, interval)
    if (n <= 0) continue
    limited.push({ coupon: couponId })
    cycles = Math.min(cycles, n)
  }
  return { forever, limited: { discounts: limited, cycles: limited.length ? cycles : 0 } }
}

type OriginalDiscount = { coupon: string; end: number | null; duration: string }

/** Rabatte des Abos in kompakter Form (für die Zeitplan-Metadaten). */
function originalDiscountsOf(sub: Stripe.Subscription): OriginalDiscount[] {
  const list = (sub as unknown as { discounts?: unknown[] }).discounts ?? []
  const out: OriginalDiscount[] = []
  for (const d of list) {
    if (!d || typeof d !== 'object') continue
    const disc = d as { end?: number | null; coupon?: unknown; source?: { coupon?: unknown } }
    const raw = disc.source?.coupon ?? disc.coupon
    const coupon = typeof raw === 'string' ? raw : raw && typeof raw === 'object' ? (raw as { id?: string }).id ?? null : null
    const duration = raw && typeof raw === 'object' ? (raw as { duration?: string }).duration ?? 'forever' : 'forever'
    if (coupon) out.push({ coupon, end: disc.end ?? null, duration })
  }
  return out
}

/**
 * Nach dem Lösen eines Zeitplans die Rabatte so wiederherstellen, wie sie ohne den Zeitplan gewesen
 * wären: dauerhafte Gutscheine unverändert, befristete mit genau der Restlaufzeit (abgeleiteter Gutschein
 * mit gleichem Namen/Prozent, `duration_in_months` = verbleibende Abrechnungen). `once` ist verbraucht.
 */
async function restoreOriginalDiscounts(stripe: Stripe, sub: Stripe.Subscription, originals: OriginalDiscount[]): Promise<void> {
  const interval: BillingInterval = sub.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'
  const nextInvoice = periodEndOf(sub)
  const discounts: { coupon: string }[] = []
  for (const o of originals) {
    if (o.duration === 'once') continue
    if (o.duration === 'forever' || !o.end) { discounts.push({ coupon: o.coupon }); continue }
    const n = nextInvoice ? billingCyclesBefore(nextInvoice, o.end, interval) : 0
    if (n <= 0) continue
    const src = await stripe.coupons.retrieve(o.coupon)
    const derived = await stripe.coupons.create({
      name: src.name ?? undefined,
      ...(src.percent_off != null ? { percent_off: src.percent_off } : { amount_off: src.amount_off ?? 0, currency: src.currency ?? 'eur' }),
      duration: 'repeating',
      duration_in_months: interval === 'yearly' ? n * 12 : n,
      metadata: { ...(src.metadata ?? {}), derived_from: src.id, reason: 'restlaufzeit-nach-tarifwechsel-zurueckgezogen' },
    })
    discounts.push({ coupon: derived.id })
  }
  await stripe.subscriptions.update(sub.id, { discounts: discounts.length ? discounts : '', proration_behavior: 'none' })
  console.info('[plan-change] discounts restored:', sub.id, discounts.map(d => d.coupon))
}

/** Anzahl der Abrechnungen ab `fromSec` (inklusive), die VOR `endSec` liegen – im Takt des Intervalls (Kalendermonate/-jahre, UTC). */
export function billingCyclesBefore(fromSec: number, endSec: number, interval: BillingInterval): number {
  let n = 0
  const d = new Date(fromSec * 1000)
  while (d.getTime() / 1000 < endSec && n < 120) {
    n++
    if (interval === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1)
    else d.setUTCMonth(d.getUTCMonth() + 1)
  }
  return n
}

/** Phase-1-Discounts aus dem per `from_subscription` erzeugten Zeitplan (nur gesetzte Felder). */
function phaseDiscountsAsParams(phase: Stripe.SubscriptionSchedule.Phase): Stripe.SubscriptionScheduleUpdateParams.Phase.Discount[] {
  return (phase.discounts ?? []).flatMap((d): Stripe.SubscriptionScheduleUpdateParams.Phase.Discount[] => {
    const id = (v: unknown) => (typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as { id: string }).id) : null)
    const discount = id(d.discount)
    if (discount) return [{ discount }]
    const promo = id(d.promotion_code)
    if (promo) return [{ promotion_code: promo }]
    const coupon = id(d.coupon)
    return coupon ? [{ coupon }] : []
  })
}

async function loadUser(userId: string) {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true, email: true, plan: true, billingInterval: true, stripeCustomerId: true, stripeSubscriptionId: true,
      cancelAtPeriodEnd: true, deletionRequestedAt: true, deletedAt: true, deactivatedAt: true,
      ...PENDING_PLAN_COLUMNS, ...recoveryColumns,
    },
  })
  if (!u) throw new PlanChangeError('NOT_FOUND', 404, 'Konto nicht gefunden.')
  return u
}

async function activeSubscription(stripe: Stripe, customerId: string): Promise<Stripe.Subscription | null> {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1, expand: ['data.discounts', 'data.discounts.source.coupon', 'data.schedule'] })
  return subs.data[0] ?? null
}

/**
 * Wechsel einplanen. Liefert den gespeicherten Merker. Wirft PlanChangeError mit deutscher Meldung.
 */
export async function schedulePlanChange(userId: string, targetPlan: string, keepSiteIds: string[]): Promise<PendingPlanChange> {
  const u = await loadUser(userId)
  if (u.deletionRequestedAt || u.deletedAt || u.deactivatedAt) throw new PlanChangeError('ACCOUNT_STATE', 409, 'Für dieses Konto ist gerade kein Tarifwechsel möglich.')
  if (!u.stripeCustomerId) throw new PlanChangeError('NO_SUBSCRIPTION', 400, 'Kein aktives Abonnement gefunden.')
  if (!PLAN_ORDER.includes(targetPlan as PlanKey)) throw new PlanChangeError('BAD_PLAN', 400, 'Unbekannter Tarif.')
  const target = targetPlan as PlanKey
  const currentIdx = PLAN_ORDER.indexOf(u.plan as PlanKey)
  if (currentIdx < 0 || PLAN_ORDER.indexOf(target) >= currentIdx) throw new PlanChangeError('NOT_LOWER', 400, 'Zum Laufzeitende kannst du nur in einen kleineren Tarif wechseln. Upgrades gehen sofort.')
  if (shouldBeOffline(u) || u.paymentFailedAt) throw new PlanChangeError('PAYMENT_OPEN', 409, 'Bitte zuerst die offene Zahlung begleichen, dann kannst du den Tarif wechseln.')

  const stripe = getStripe()
  const sub = await activeSubscription(stripe, u.stripeCustomerId)
  if (!sub) throw new PlanChangeError('NO_SUBSCRIPTION', 400, 'Kein aktives Abonnement gefunden.')
  if (sub.cancel_at_period_end) throw new PlanChangeError('CANCELED', 409, 'Dein Abo ist gekündigt. Zieh die Kündigung zurück, dann kannst du den Tarif wechseln.')
  const item = sub.items.data[0]
  if (!item) throw new PlanChangeError('NO_ITEM', 400, 'Abonnement hat keine aktiven Positionen.')
  const interval: BillingInterval = item.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'
  const newPriceId = getPriceIdByPlan(target, interval)
  if (!newPriceId) throw new PlanChangeError('NO_PRICE', 500, 'Der Tarif ist gerade nicht buchbar.')
  const switchAt = periodEndOf(sub)
  if (!switchAt) throw new PlanChangeError('NO_PERIOD', 500, 'Das Laufzeitende konnte nicht ermittelt werden.')

  // Seiten: passen alle in den Zieltarif? Sonst muss die Auswahl genau das Limit füllen.
  const limit = getPlanMaxSites(target)
  const published = await paidPublishedSites(userId)
  let keep: string[] = []
  if (limit >= 0 && published.length > limit) {
    const ids = new Set(published.map(s => s.id))
    keep = Array.from(new Set(keepSiteIds)).filter(id => ids.has(id))
    if (keep.length !== limit) {
      throw new PlanChangeError('CHOOSE_SITES', 400, limit === 1
        ? 'Bitte wähle die Webseite, die online bleiben soll.'
        : `Bitte wähle ${limit} Webseiten, die online bleiben sollen.`)
    }
  }

  // Ein alter Zeitplan (z. B. früherer Wechselwunsch) wird ersetzt
  await releaseScheduleOf(stripe, sub)

  const created = await stripe.subscriptionSchedules.create({ from_subscription: sub.id })
  const p0 = created.phases[0]
  if (!p0) {
    await stripe.subscriptionSchedules.release(created.id).catch(() => {})
    throw new PlanChangeError('SCHEDULE', 500, 'Der Wechsel konnte nicht eingeplant werden.')
  }
  try {
    const carry = splitCarryOverDiscounts(sub, switchAt, interval)
    // Stripe schreibt beim Setzen der Phasen-Rabatte die Rabatte des Abos neu (Laufzeit beginnt von vorn).
    // Die Original-Rabatte wandern deshalb in die Metadaten des Zeitplans – beim Zurückziehen werden sie
    // mit ihrer Restlaufzeit wiederhergestellt (restoreOriginalDiscounts).
    const originals = JSON.stringify(originalDiscountsOf(sub)).slice(0, 500)
    const cycleUnit = interval === 'yearly' ? 'year' : 'month'
    const newItems = [{ price: newPriceId, quantity: 1 }]
    // Phase 2: neuer Preis mit allen weiterlaufenden Rabatten für die Restlaufzeit der befristeten;
    // Phase 3 (nur bei befristeten): neuer Preis, nur noch dauerhafte Rabatte, ein Zyklus; dann release.
    const laterPhases: Stripe.SubscriptionScheduleUpdateParams.Phase[] = carry.limited.cycles > 0
      ? [
          { items: newItems, duration: { interval: cycleUnit, interval_count: carry.limited.cycles }, discounts: [...carry.forever, ...carry.limited.discounts], proration_behavior: 'none' },
          { items: newItems, duration: { interval: cycleUnit, interval_count: 1 }, discounts: carry.forever, proration_behavior: 'none' },
        ]
      : [
          { items: newItems, duration: { interval: cycleUnit, interval_count: 1 }, discounts: carry.forever, proration_behavior: 'none' },
        ]
    await stripe.subscriptionSchedules.update(created.id, {
      end_behavior: 'release',
      metadata: { finestsites_user_id: userId, finestsites_plan_change: `${u.plan}->${target}`, fs_discounts: originals },
      phases: [
        {
          // laufender Zeitraum 1:1 (Preis, Menge, Rabatte), nichts wird neu berechnet
          start_date: p0.start_date,
          end_date: p0.end_date,
          items: p0.items.map(i => ({ price: typeof i.price === 'string' ? i.price : i.price.id, quantity: i.quantity ?? 1 })),
          discounts: phaseDiscountsAsParams(p0),
          proration_behavior: 'none',
        },
        ...laterPhases,
      ],
    })
  } catch (err) {
    await stripe.subscriptionSchedules.release(created.id).catch(() => {})
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[plan-change] schedule update failed:', userId, msg)
    throw new PlanChangeError('SCHEDULE', 500, 'Der Wechsel konnte nicht eingeplant werden. Es wurde nichts geändert.')
  }

  const at = new Date(switchAt * 1000)
  await db.update(users).set({
    pendingPlan: target, pendingPlanInterval: interval, pendingPlanAt: at, pendingPlanScheduleId: created.id, pendingKeepSiteIds: keep,
  }).where(eq(users.id, userId))
  console.info('[plan-change] scheduled:', userId, `${u.plan} -> ${target}`, interval, at.toISOString(), created.id)

  const offline = limit >= 0 && published.length > limit ? published.filter(s => !keep.includes(s.id)).map(s => s.title) : []
  if (u.email) {
    sendEmail({
      to: u.email,
      subject: `Dein Wechsel zu ${PLANS[target].name} ist eingeplant · FinestSites`,
      html: planChangeScheduledEmail({ plan: target, interval, date: formatDate(at), offlineSites: offline }),
      type: 'plan_change_scheduled',
    }).catch(() => {})
  }
  return { plan: target, interval, at: at.toISOString(), keep_site_ids: keep }
}

/** Geplanten Wechsel zurückziehen (Schedule lösen, Merker löschen). Ohne Merker: nichts zu tun. */
export async function cancelPlanChange(userId: string): Promise<void> {
  const u = await loadUser(userId)
  if (!u.pendingPlan && !u.pendingPlanScheduleId) return
  const stripe = getStripe()
  if (u.pendingPlanScheduleId) await releaseScheduleById(stripe, u.pendingPlanScheduleId)
  await db.update(users).set(PENDING_CLEARED).where(eq(users.id, userId))
  console.info('[plan-change] cancelled:', userId)
}

/**
 * Vor Upgrade, Kündigung oder Kontolöschung: einen geplanten Wechsel aufheben, sonst lehnt Stripe
 * Änderungen am Abo ab (Positionen/cancel_at_period_end werden vom Zeitplan verwaltet).
 */
export async function releasePendingPlanChange(stripe: Stripe, userId: string, sub?: Stripe.Subscription | null): Promise<boolean> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { ...PENDING_PLAN_COLUMNS } })
  let released = false
  if (u?.pendingPlanScheduleId) released = await releaseScheduleById(stripe, u.pendingPlanScheduleId)
  if (sub) released = (await releaseScheduleOf(stripe, sub)) || released
  if (u?.pendingPlan || u?.pendingPlanScheduleId) {
    await db.update(users).set(PENDING_CLEARED).where(eq(users.id, userId))
    console.info('[plan-change] pending change released:', userId)
  }
  return released
}

/** Zeitplan eines Abos lösen (falls vorhanden); das Abo läuft unverändert weiter. */
export async function releaseScheduleOf(stripe: Stripe, sub: Stripe.Subscription): Promise<boolean> {
  const s = sub.schedule
  const id = typeof s === 'string' ? s : s?.id
  if (!id) return false
  return releaseScheduleById(stripe, id)
}

async function releaseScheduleById(stripe: Stripe, id: string): Promise<boolean> {
  try {
    const sched = await stripe.subscriptionSchedules.retrieve(id)
    if (sched.status === 'active' || sched.status === 'not_started') {
      await stripe.subscriptionSchedules.release(id)
      // Rabatte wie vor dem Zeitplan (Restlaufzeit), falls wir sie beim Einplanen festgehalten haben
      const raw = sched.metadata?.fs_discounts
      const subId = typeof sched.subscription === 'string' ? sched.subscription : sched.subscription?.id
      if (raw && subId) {
        try {
          const originals = JSON.parse(raw) as OriginalDiscount[]
          const sub = await stripe.subscriptions.retrieve(subId, { expand: ['discounts'] })
          if (sub.status !== 'canceled') await restoreOriginalDiscounts(stripe, sub, originals)
        } catch (err) {
          console.error('[plan-change] discount restore failed:', subId, err instanceof Error ? err.message : err)
        }
      }
      return true
    }
    return false
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Schon gelöst/abgeschlossen oder unbekannt: für den Aufrufer unschädlich
    console.warn('[plan-change] schedule release skipped:', id, msg)
    return false
  }
}

/**
 * Webhook (customer.subscription.updated), NACH dem Tarif-Update in der DB: ist der geplante Tarif
 * jetzt aktiv, überzählige Seiten zu Entwürfen machen (gewählte bleiben online), Merker löschen, Mail.
 * Idempotent: ohne Merker passiert nichts.
 */
export async function applyPendingPlanIfDue(userId: string, newPlan: string): Promise<boolean> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true, plan: true, billingInterval: true, ...PENDING_PLAN_COLUMNS } })
  if (!u?.pendingPlan || u.pendingPlan !== newPlan) return false
  const limit = getPlanMaxSites(newPlan)
  const unpublished = await unpublishSitesBeyondLimit(userId, u.pendingKeepSiteIds ?? [], limit)
  await db.update(users).set(PENDING_CLEARED).where(eq(users.id, userId))
  console.info('[plan-change] applied:', userId, newPlan, 'unpublished', unpublished.length)
  if (u.email) {
    sendEmail({
      to: u.email,
      subject: `Dein Tarif ist jetzt ${PLANS[newPlan as PlanKey]?.name ?? newPlan} · FinestSites`,
      html: planChangeDoneEmail({ plan: newPlan as PlanKey, interval: u.pendingPlanInterval === 'yearly' ? 'yearly' : 'monthly', offlineSites: unpublished }),
      type: 'plan_change_done',
    }).catch(() => {})
  }
  return true
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' })
}
