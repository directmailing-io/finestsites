/**
 * Abo pausieren – 1 bis 3 Monate ab dem Ende des bezahlten Zeitraums (Daniel, 03.11.2026;
 * docs/kuendigung/konzept.html, Abschnitt 06).
 *
 * Eine Pause ist ein Vertrag, der ruht: kein Geld, keine Premium-Seiten online, nichts geht verloren,
 * und es geht von selbst weiter. Mechanik wie beim Tarifwechsel nach unten (plan-change.ts): ein
 * Stripe Subscription Schedule mit drei Phasen –
 *   Phase 1 = laufender Zeitraum unverändert,
 *   Phase 2 = Preis „Pause“ (0 €, STRIPE_PRICE_PAUSE) für N Monate, ohne Rabatte,
 *   Phase 3 = der bisherige Preis (bzw. ein schon eingeplanter kleinerer Tarif) mit den Rabatten, die
 *             über die Pause hinaus gelten; danach `end_behavior: 'release'`.
 * Die 0-€-Rechnungen sind harmlos (kein Zahlungsversuch, Provision 0) und verwirren das Mahnwesen
 * nicht – anders als Stripes `pause_collection`, das Rechnungen storniert (`invoice.voided` ist bei uns
 * ein Mahn-Signal).
 *
 * Zustand (users): pause_from / pause_until / pause_months / pause_schedule_id beim Einplanen,
 * pause_started_at setzt der Webhook, sobald der Pause-Preis aktiv ist (Seiten → `paused`),
 * last_pause_at = Beginn der letzten Pause (eine je 12 Monate). Alles idempotent.
 *
 * Regeln: nur bei aktivem, nicht gekündigtem Abo ohne offene Zahlung; eine Pause je 12 Monate;
 * vorzeitig beenden jederzeit (neuer Abrechnungszeitraum beginnt sofort); Kündigen während der Pause
 * beendet das Abo sofort (src/lib/billing/cancellation.ts).
 */
import type Stripe from 'stripe'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'
import { PLANS, PLAN_ORDER, getPriceIdByPlan, type BillingInterval, type PlanKey } from '@/lib/plans'
import { shouldBeOffline, recoveryColumns } from '@/lib/billing/payment-recovery'
import {
  PENDING_PLAN_COLUMNS,
  activeSubscription,
  formatDate,
  originalDiscountsOf,
  phaseDiscountsAsParams,
  releaseScheduleById,
  releaseScheduleOf,
  splitCarryOverDiscounts,
} from '@/lib/billing/plan-change'
import { pauseSites, resumePausedSites } from '@/lib/billing/site-access'
import { PAUSE_COOLDOWN_DAYS, PAUSE_MONTH_OPTIONS } from '@/lib/billing/cancellation-offer'
import { sendEmail } from '@/lib/resend'
import { pauseResumedEmail, pauseScheduledEmail } from '@/lib/email/templates'

export class PauseError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message)
    this.name = 'PauseError'
  }
}

export const PAUSE_COLUMNS = {
  pauseFrom: true, pauseUntil: true, pauseMonths: true, pauseScheduleId: true, pauseStartedAt: true, lastPauseAt: true,
} as const

export type PauseRow = {
  pauseFrom: Date | null
  pauseUntil: Date | null
  pauseMonths: number | null
  pauseScheduleId: string | null
  pauseStartedAt: Date | null
  lastPauseAt: Date | null
}

export type PauseInfo = {
  /** Beginn (Laufzeitende beim Einplanen) */
  from: string
  /** Ende = automatische Fortsetzung */
  until: string
  months: number
  /** Läuft die Pause schon (Seiten offline)? */
  active: boolean
}

const PAUSE_CLEARED = {
  pauseFrom: null, pauseUntil: null, pauseMonths: null, pauseScheduleId: null, pauseStartedAt: null, pauseEndNoticeSentAt: null,
}

export function pausePriceId(): string {
  return (process.env.STRIPE_PRICE_PAUSE ?? '').trim()
}

export function isPausePrice(priceId: string | null | undefined): boolean {
  const id = pausePriceId()
  return !!id && !!priceId && priceId === id
}

export function pauseInfoOf(u: PauseRow): PauseInfo | null {
  if (!u.pauseScheduleId || !u.pauseFrom || !u.pauseUntil) return null
  return { from: u.pauseFrom.toISOString(), until: u.pauseUntil.toISOString(), months: u.pauseMonths ?? 1, active: !!u.pauseStartedAt }
}

export function isPauseMonths(v: unknown): v is (typeof PAUSE_MONTH_OPTIONS)[number] {
  return typeof v === 'number' && (PAUSE_MONTH_OPTIONS as readonly number[]).includes(v)
}

type AllowRow = PauseRow & {
  stripeCustomerId: string | null
  cancelAtPeriodEnd: boolean
  deletionRequestedAt: Date | null
  deletedAt: Date | null
  deactivatedAt: Date | null
  subscriptionStatus: string | null
  paymentFailedAt: Date | null
  paymentFailedInvoiceId?: string | null
  paymentGraceUntil: Date | null
  paymentRetryProcessingAt: Date | null
}

/** Darf dieses Konto gerade eine Pause einplanen? Mit deutscher Begründung für die Oberfläche. */
export function pauseAllowedFor(u: AllowRow, now: Date = new Date()): { ok: true } | { ok: false; code: string; message: string } {
  if (!u.stripeCustomerId || !['active', 'trialing', 'past_due'].includes(u.subscriptionStatus ?? '')) {
    return { ok: false, code: 'NO_SUBSCRIPTION', message: 'Eine Pause geht nur mit einem laufenden Abo.' }
  }
  if (u.deletionRequestedAt || u.deletedAt || u.deactivatedAt) return { ok: false, code: 'ACCOUNT_STATE', message: 'Für dieses Konto ist gerade keine Pause möglich.' }
  if (u.pauseScheduleId) return { ok: false, code: 'PAUSE_EXISTS', message: 'Eine Pause ist schon eingeplant.' }
  if (u.cancelAtPeriodEnd) return { ok: false, code: 'CANCELED', message: 'Dein Abo ist gekündigt. Zieh die Kündigung zurück, dann kannst du pausieren.' }
  if (shouldBeOffline(u, now) || u.paymentFailedAt) return { ok: false, code: 'PAYMENT_OPEN', message: 'Bitte zuerst die offene Zahlung begleichen, dann kannst du pausieren.' }
  if (u.lastPauseAt && now.getTime() - u.lastPauseAt.getTime() < PAUSE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000) {
    return { ok: false, code: 'COOLDOWN', message: 'Eine Pause ist einmal in 12 Monaten möglich.' }
  }
  return { ok: true }
}

async function loadUser(userId: string) {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true, email: true, plan: true, billingInterval: true, stripeCustomerId: true, stripeSubscriptionId: true,
      cancelAtPeriodEnd: true, deletionRequestedAt: true, deletedAt: true, deactivatedAt: true, currentPeriodEnd: true,
      ...PENDING_PLAN_COLUMNS, ...recoveryColumns, ...PAUSE_COLUMNS,
    },
  })
  if (!u) throw new PauseError('NOT_FOUND', 404, 'Konto nicht gefunden.')
  return u
}

/** Kalendermonate addieren (UTC, wie Stripe die Phasen taktet) */
export function addMonthsSec(fromSec: number, months: number): number {
  const d = new Date(fromSec * 1000)
  d.setUTCMonth(d.getUTCMonth() + months)
  return Math.floor(d.getTime() / 1000)
}

/**
 * Pause einplanen. Liefert die gespeicherte Pause. Wirft PauseError mit deutscher Meldung.
 */
export async function schedulePause(userId: string, months: number): Promise<PauseInfo> {
  if (!isPauseMonths(months)) throw new PauseError('BAD_MONTHS', 400, 'Eine Pause dauert 1, 2 oder 3 Monate.')
  const pausePrice = pausePriceId()
  if (!pausePrice) throw new PauseError('NOT_CONFIGURED', 500, 'Die Pause ist gerade nicht verfügbar.')
  const u = await loadUser(userId)
  const allowed = pauseAllowedFor(u)
  if (!allowed.ok) throw new PauseError(allowed.code, 409, allowed.message)

  const stripe = getStripe()
  let sub = await activeSubscription(stripe, u.stripeCustomerId!)
  if (!sub) throw new PauseError('NO_SUBSCRIPTION', 400, 'Kein aktives Abonnement gefunden.')
  if (sub.cancel_at_period_end) throw new PauseError('CANCELED', 409, 'Dein Abo ist gekündigt. Zieh die Kündigung zurück, dann kannst du pausieren.')
  const item = sub.items.data[0]
  if (!item) throw new PauseError('NO_ITEM', 400, 'Abonnement hat keine aktiven Positionen.')
  if (isPausePrice(item.price.id)) throw new PauseError('PAUSE_EXISTS', 409, 'Dein Abo macht gerade schon Pause.')
  const interval: BillingInterval = item.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'

  // Ein eingeplanter kleinerer Tarif wird von der Pause übernommen: nach der Pause geht es im Zieltarif weiter.
  const pendingPlan = u.pendingPlan && PLAN_ORDER.includes(u.pendingPlan as PlanKey) ? (u.pendingPlan as PlanKey) : null
  const targetPlan: PlanKey = pendingPlan ?? (PLAN_ORDER.includes(u.plan as PlanKey) ? (u.plan as PlanKey) : 'starter')
  const targetInterval: BillingInterval = pendingPlan ? (u.pendingPlanInterval === 'yearly' ? 'yearly' : 'monthly') : interval
  const targetPriceId = (pendingPlan ? getPriceIdByPlan(targetPlan, targetInterval) : '') || item.price.id

  // Alter Zeitplan (Tarifwechsel) wird ersetzt – das stellt die Rabatte des Abos wieder her, daher neu lesen
  if (await releaseScheduleOf(stripe, sub)) {
    sub = await stripe.subscriptions.retrieve(sub.id, { expand: ['discounts', 'discounts.source.coupon'] })
  }

  const created = await stripe.subscriptionSchedules.create({ from_subscription: sub.id })
  const p0 = created.phases[0]
  if (!p0) {
    await stripe.subscriptionSchedules.release(created.id).catch(() => {})
    throw new PauseError('SCHEDULE', 500, 'Die Pause konnte nicht eingeplant werden.')
  }
  let updated: Stripe.SubscriptionSchedule
  try {
    const pauseStart = p0.end_date
    const resumeAt = addMonthsSec(pauseStart, months)
    const carry = splitCarryOverDiscounts(sub, resumeAt, targetInterval)
    const originals = JSON.stringify(originalDiscountsOf(sub)).slice(0, 500)
    const cycleUnit = targetInterval === 'yearly' ? 'year' : 'month'
    const targetItems = [{ price: targetPriceId, quantity: 1 }]
    const afterPause: Stripe.SubscriptionScheduleUpdateParams.Phase[] = carry.limited.cycles > 0
      ? [
          { items: targetItems, duration: { interval: cycleUnit, interval_count: carry.limited.cycles }, discounts: [...carry.forever, ...carry.limited.discounts], proration_behavior: 'none' },
          { items: targetItems, duration: { interval: cycleUnit, interval_count: 1 }, discounts: carry.forever, proration_behavior: 'none' },
        ]
      : [
          { items: targetItems, duration: { interval: cycleUnit, interval_count: 1 }, discounts: carry.forever, proration_behavior: 'none' },
        ]
    updated = await stripe.subscriptionSchedules.update(created.id, {
      end_behavior: 'release',
      metadata: {
        finestsites_user_id: userId,
        finestsites_pause: String(months),
        fs_discounts: originals,
        ...(pendingPlan ? { finestsites_plan_change: `${u.plan}->${pendingPlan}` } : {}),
      },
      phases: [
        {
          start_date: p0.start_date,
          end_date: p0.end_date,
          items: p0.items.map(i => ({ price: typeof i.price === 'string' ? i.price : i.price.id, quantity: i.quantity ?? 1 })),
          discounts: phaseDiscountsAsParams(p0),
          proration_behavior: 'none',
        },
        // Die Pause selbst: 0 €, keine Rabatte (es gibt nichts zu rabattieren)
        { items: [{ price: pausePrice, quantity: 1 }], duration: { interval: 'month', interval_count: months }, discounts: [], proration_behavior: 'none' },
        ...afterPause,
      ],
    })
  } catch (err) {
    await stripe.subscriptionSchedules.release(created.id).catch(() => {})
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[pause] schedule update failed:', userId, msg)
    throw new PauseError('SCHEDULE', 500, 'Die Pause konnte nicht eingeplant werden. Es wurde nichts geändert.')
  }

  const fromSec = updated.phases[1]?.start_date ?? p0.end_date
  const untilSec = updated.phases[2]?.start_date ?? addMonthsSec(fromSec, months)
  const from = new Date(fromSec * 1000)
  const until = new Date(untilSec * 1000)
  await db.update(users).set({
    pauseFrom: from, pauseUntil: until, pauseMonths: months, pauseScheduleId: created.id, pauseStartedAt: null, pauseEndNoticeSentAt: null,
    ...(pendingPlan ? { pendingPlanScheduleId: created.id, pendingPlanAt: until } : {}),
  }).where(eq(users.id, userId))
  console.info('[pause] scheduled:', userId, months, from.toISOString(), until.toISOString(), created.id)

  if (u.email) {
    sendEmail({
      to: u.email,
      subject: `Deine Pause ist eingeplant · FinestSites`,
      html: pauseScheduledEmail({
        from: formatDate(from), until: formatDate(until), months,
        planName: PLANS[targetPlan].name,
        price: targetInterval === 'yearly' ? PLANS[targetPlan].yearly_eur : PLANS[targetPlan].monthly_eur,
        unit: targetInterval === 'yearly' ? 'Jahr' : 'Monat',
      }),
      type: 'pause_scheduled',
    }).catch(() => {})
  }
  return { from: from.toISOString(), until: until.toISOString(), months, active: false }
}

/**
 * Pause abbrechen (noch nicht begonnen) oder vorzeitig beenden (läuft schon).
 * Beim Beenden beginnt sofort ein neuer Abrechnungszeitraum (Rechnung heute), die Seiten gehen wieder online.
 */
export async function cancelPause(userId: string): Promise<{ ended: boolean }> {
  const u = await loadUser(userId)
  if (!u.pauseScheduleId) return { ended: false }
  const stripe = getStripe()
  const pendingAbsorbed = !!u.pendingPlan && u.pendingPlanScheduleId === u.pauseScheduleId

  if (!u.pauseStartedAt) {
    // Noch nicht begonnen: Zeitplan lösen (stellt die Rabatte wieder her), Merker weg
    await releaseScheduleById(stripe, u.pauseScheduleId)
    await db.update(users).set({
      ...PAUSE_CLEARED,
      ...(pendingAbsorbed ? { pendingPlan: null, pendingPlanInterval: null, pendingPlanAt: null, pendingPlanScheduleId: null, pendingKeepSiteIds: [] } : {}),
    }).where(eq(users.id, userId))
    console.info('[pause] cancelled before start:', userId)
    return { ended: false }
  }

  // Läuft schon: zuerst den Merker löschen, damit der Webhook die Fortsetzung nicht doppelt verarbeitet
  const pauseFrom = u.pauseFrom
  await db.update(users).set({ ...PAUSE_CLEARED, lastPauseAt: pauseFrom ?? u.pauseStartedAt }).where(eq(users.id, userId))
  try {
    await releaseScheduleById(stripe, u.pauseScheduleId)
    const sub = await stripe.subscriptions.retrieve(u.stripeSubscriptionId ?? '', { expand: ['items'] }).catch(() => null)
    const live = sub ?? (u.stripeCustomerId ? await activeSubscription(stripe, u.stripeCustomerId) : null)
    if (!live) throw new PauseError('NO_SUBSCRIPTION', 400, 'Kein aktives Abonnement gefunden.')
    const item = live.items.data[0]
    const plan: PlanKey = PLAN_ORDER.includes(u.plan as PlanKey) ? (u.plan as PlanKey) : 'starter'
    const interval: BillingInterval = u.billingInterval === 'yearly' ? 'yearly' : 'monthly'
    const priceId = getPriceIdByPlan(plan, interval)
    if (item && isPausePrice(item.price.id) && priceId) {
      // Neuer Zeitraum ab heute zum bisherigen Preis; nichts anteilig (die 0-€-Zeit ist nichts wert)
      await stripe.subscriptions.update(live.id, {
        items: [{ id: item.id, price: priceId, quantity: 1 }],
        billing_cycle_anchor: 'now',
        proration_behavior: 'none',
      })
    }
  } catch (err) {
    console.error('[pause] end now failed:', userId, err instanceof Error ? err.message : err)
    throw err instanceof PauseError ? err : new PauseError('STRIPE', 500, 'Die Pause konnte gerade nicht beendet werden. Bitte versuch es gleich noch einmal.')
  }
  const restored = await resumePausedSites(userId)
  console.info('[pause] ended early:', userId, 'sites', restored)
  if (u.email) {
    sendEmail({ to: u.email, subject: 'Willkommen zurück, alles ist wieder online · FinestSites', html: pauseResumedEmail({ nextBilling: null }), type: 'pause_resumed' }).catch(() => {})
  }
  return { ended: true }
}

/** Webhook: der Pause-Preis ist aktiv (Phase 2 hat begonnen) → Seiten pausieren, Beginn merken. Idempotent. */
export async function onPausePriceActive(userId: string): Promise<void> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { ...PAUSE_COLUMNS } })
  if (!u) return
  const now = new Date()
  const paused = await pauseSites(userId)
  if (!u.pauseStartedAt) {
    await db.update(users).set({
      pauseStartedAt: now,
      lastPauseAt: u.pauseFrom ?? now,
      // Falls die Pause nicht über uns eingeplant wurde (Stripe-Dashboard): Zeitraum grob nachtragen
      ...(u.pauseFrom ? {} : { pauseFrom: now }),
      ...(u.pauseUntil ? {} : { pauseUntil: new Date(addMonthsSec(Math.floor(now.getTime() / 1000), u.pauseMonths ?? 1) * 1000) }),
    }).where(eq(users.id, userId))
  }
  console.info('[pause] started:', userId, 'sites paused', paused)
}

/** Webhook: der normale Preis ist wieder aktiv, die Pause ist vorbei → Seiten online, Merker weg, Mail. Idempotent. */
export async function onPauseEnded(userId: string, nextBilling: Date | null): Promise<boolean> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true, ...PAUSE_COLUMNS } })
  if (!u?.pauseStartedAt) return false
  await db.update(users).set({ ...PAUSE_CLEARED, lastPauseAt: u.pauseFrom ?? u.pauseStartedAt }).where(eq(users.id, userId))
  const restored = await resumePausedSites(userId)
  console.info('[pause] ended:', userId, 'sites restored', restored)
  if (u.email) {
    sendEmail({
      to: u.email,
      subject: 'Willkommen zurück, alles ist wieder online · FinestSites',
      html: pauseResumedEmail({ nextBilling: nextBilling ? formatDate(nextBilling) : null }),
      type: 'pause_resumed',
    }).catch(() => {})
  }
  return true
}

/** Nach einer Kündigung/Löschung: Pause-Merker aufräumen (der Zeitplan ist dann schon gelöst oder das Abo beendet). */
export async function clearPauseState(userId: string): Promise<void> {
  await db.update(users).set(PAUSE_CLEARED).where(eq(users.id, userId))
}

/**
 * Cron-Sicherheitsnetz: eingeplante Pausen, deren Zeitplan es in Stripe nicht mehr gibt (z. B. im
 * Dashboard gelöst), werden in der DB aufgeräumt; begonnene Pausen, deren Abo wieder normal abrechnet,
 * werden beendet.
 */
export async function reconcilePauseState(userId: string): Promise<'cleared' | 'ended' | 'unchanged'> {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { stripeSubscriptionId: true, currentPeriodEnd: true, ...PAUSE_COLUMNS },
  })
  if (!u?.pauseScheduleId) return 'unchanged'
  const stripe = getStripe()
  const sched = await stripe.subscriptionSchedules.retrieve(u.pauseScheduleId).catch(() => null)
  const alive = sched && (sched.status === 'active' || sched.status === 'not_started')
  if (!u.pauseStartedAt) {
    if (alive) return 'unchanged'
    await clearPauseState(userId)
    return 'cleared'
  }
  const sub = u.stripeSubscriptionId ? await stripe.subscriptions.retrieve(u.stripeSubscriptionId).catch(() => null) : null
  const priceId = sub?.items.data[0]?.price.id ?? null
  if (sub && sub.status !== 'canceled' && !isPausePrice(priceId)) {
    await onPauseEnded(userId, u.currentPeriodEnd)
    return 'ended'
  }
  return 'unchanged'
}
