/**
 * Kündigungsflow – Server-Seite (Daniel, 03.11.2026; docs/kuendigung/konzept.html).
 *
 *   startCancellation  → Grund + Kommentar speichern, Lage einsammeln, Angebot entscheiden (cancellation-offer.ts)
 *   acceptOffer        → Treue-Rabatt, Pause, kleinerer Tarif, Jahr → Monat, Erinnerung, Gespräch, „Abo behalten“
 *   confirmCancellation→ wie bisher cancel_at_period_end (während einer Pause: sofort), Grund an Stripe, Ergebnis in die Tabelle
 *   dismissCancellation→ Fenster geschlossen, nichts passiert (Ergebnis „abgebrochen“)
 *
 * Keine Mail an Daniel (Admin-Dashboard), kein Angebot zweimal (retention_offer_shown_at beim Anzeigen).
 */
import { createHmac, timingSafeEqual } from 'crypto'
import type Stripe from 'stripe'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { cancellationFeedback, supportConversations, supportMessages, users } from '@/lib/db/schema'
import { getStripe } from '@/lib/stripe/client'
import { PLAN_ORDER, type BillingInterval, type PlanKey } from '@/lib/plans'
import { recoveryColumns } from '@/lib/billing/payment-recovery'
import {
  PENDING_PLAN_COLUMNS,
  PlanChangeError,
  activeSubscription,
  paidPublishedSites,
  periodEndOf,
  releasePendingPlanChange,
  schedulePlanChange,
} from '@/lib/billing/plan-change'
import { PAUSE_COLUMNS, PauseError, clearPauseState, pauseAllowedFor, schedulePause } from '@/lib/billing/pause'
import { RETENTION_COLUMNS, RetentionError, activeDiscountsOf, applyRetentionDiscount, hasPaidInvoice } from '@/lib/billing/retention'
import {
  CANCEL_REASON_LABELS,
  STRIPE_FEEDBACK,
  decideOffer,
  isCancelReason,
  offerShownLabel,
  type CancelReason,
  type Offer,
  type OfferContext,
} from '@/lib/billing/cancellation-offer'

export class CancellationError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message)
    this.name = 'CancellationError'
  }
}

export const OFFER_ACTIONS = ['discount', 'pause', 'downgrade', 'yearly_to_monthly', 'reminder', 'talk', 'keep'] as const
export type OfferAction = typeof OFFER_ACTIONS[number]
export function isOfferAction(v: unknown): v is OfferAction {
  return typeof v === 'string' && (OFFER_ACTIONS as readonly string[]).includes(v)
}

const DAY_MS = 24 * 60 * 60 * 1000
const COMMENT_MAX = 2000

async function loadUser(userId: string) {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true, email: true, plan: true, billingInterval: true, stripeCustomerId: true, stripeSubscriptionId: true,
      cancelAtPeriodEnd: true, createdAt: true, isAdmin: true, isInternal: true, renewalReminderOptIn: true,
      deletionRequestedAt: true, deletedAt: true, deactivatedAt: true, currentPeriodEnd: true,
      ...PENDING_PLAN_COLUMNS, ...PAUSE_COLUMNS, ...RETENTION_COLUMNS, ...recoveryColumns,
    },
  })
  if (!u) throw new CancellationError('NOT_FOUND', 404, 'Konto nicht gefunden.')
  return u
}

function toError(err: unknown): CancellationError {
  if (err instanceof CancellationError) return err
  if (err instanceof PlanChangeError || err instanceof PauseError || err instanceof RetentionError) return new CancellationError(err.code, err.status, err.message)
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[cancellation]', msg)
  return new CancellationError('STRIPE', 500, 'Der Zahlungsdienst ist gerade nicht erreichbar. Bitte versuch es gleich noch einmal.')
}

export type StartResult = { id: string; offer: Offer }

/** Schritt 1 abgeschickt: Grund (+ Kommentar) speichern und das passende Angebot liefern. */
export async function startCancellation(userId: string, reasonRaw: unknown, commentRaw: unknown): Promise<StartResult> {
  if (!isCancelReason(reasonRaw)) throw new CancellationError('BAD_REASON', 400, 'Bitte wähle einen Grund.')
  const reason: CancelReason = reasonRaw
  const comment = typeof commentRaw === 'string' ? commentRaw.trim().slice(0, COMMENT_MAX) || null : null
  const u = await loadUser(userId)
  if (u.deletionRequestedAt || u.deletedAt) throw new CancellationError('ACCOUNT_STATE', 409, 'Für dieses Konto ist bereits eine Löschung vorgemerkt.')
  if (!u.stripeCustomerId) throw new CancellationError('NO_SUBSCRIPTION', 400, 'Kein aktives Abonnement gefunden.')
  const stripe = getStripe()
  let sub: Stripe.Subscription | null
  try { sub = await activeSubscription(stripe, u.stripeCustomerId) } catch (err) { throw toError(err) }
  if (!sub) throw new CancellationError('NO_SUBSCRIPTION', 400, 'Kein aktives Abonnement gefunden.')
  if (sub.cancel_at_period_end) throw new CancellationError('ALREADY_CANCELED', 409, 'Dein Abo ist schon gekündigt.')

  const now = new Date()
  const endSec = periodEndOf(sub)
  const periodEnd = endSec ? new Date(endSec * 1000) : (u.currentPeriodEnd ?? new Date(now.getTime() + 30 * DAY_MS))
  const item = sub.items.data[0]
  const interval: BillingInterval = item?.price.recurring?.interval === 'year' ? 'yearly' : (u.billingInterval === 'yearly' ? 'yearly' : 'monthly')
  const plan: PlanKey = PLAN_ORDER.includes(u.plan as PlanKey) ? (u.plan as PlanKey) : 'starter'
  const discounts = activeDiscountsOf(sub, now)
  // Bei mehreren Rabatten zählt der, der am längsten läuft (dauerhaft vor befristet)
  const discount = discounts.length
    ? discounts.slice().sort((a, b) => (a.forever ? 1 : 0) - (b.forever ? 1 : 0) || (b.end?.getTime() ?? 0) - (a.end?.getTime() ?? 0))[0]
    : null
  let paidSites = 0
  let paid = false
  try {
    ;[paidSites, paid] = await Promise.all([
      paidPublishedSites(userId).then(r => r.length),
      hasPaidInvoice(stripe, u.stripeCustomerId),
    ])
  } catch (err) { throw toError(err) }

  const ctx: OfferContext = {
    now,
    plan,
    interval,
    periodEnd,
    discount: discount ? { percent: discount.percent, end: discount.end, forever: discount.forever } : null,
    retentionUsed: !!u.retentionOfferShownAt || !!u.retentionCouponAppliedAt || u.retentionCouponPending,
    hasPaidInvoice: paid,
    isInternal: !!u.isAdmin || !!u.isInternal || discounts.some(d => d.percent >= 100),
    pauseAllowed: pauseAllowedFor(u, now).ok,
    pendingPlanChange: !!u.pendingPlan || !!sub.schedule,
    paidPublishedSites: paidSites,
    renewalReminderOptIn: !!u.renewalReminderOptIn,
  }
  const offer = decideOffer(reason, ctx)
  const tenureDays = Math.max(0, Math.floor((now.getTime() - new Date(u.createdAt).getTime()) / DAY_MS))
  const discountAtTime = discount
    ? `${discount.percent} %${discount.forever || !discount.end ? ' dauerhaft' : ` bis ${discount.end.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}`}`
    : null
  const [row] = await db.insert(cancellationFeedback).values({
    userId,
    reason,
    comment,
    plan,
    billingInterval: interval,
    discountAtTime,
    tenureDays,
    offerShown: offerShownLabel(offer),
    outcome: 'started',
    stripeSubscriptionId: sub.id,
    periodEnd,
  }).returning({ id: cancellationFeedback.id })
  // Der Treue-Rabatt gilt als „gemacht“, sobald er angezeigt wurde (Missbrauch: Flow nur starten, um ihn zu sehen)
  if (offer.discount && !u.retentionOfferShownAt) {
    await db.update(users).set({ retentionOfferShownAt: now }).where(eq(users.id, userId))
  }
  console.info('[cancellation] started:', userId, reason, offer.kind)
  return { id: row.id, offer }
}

async function feedbackRow(userId: string, feedbackId: string | null) {
  if (!feedbackId) return null
  return db.query.cancellationFeedback.findFirst({
    where: and(eq(cancellationFeedback.id, feedbackId), eq(cancellationFeedback.userId, userId)),
  }) ?? null
}

async function setResult(feedbackId: string | null, patch: { offerResult?: string | null; outcome?: string }) {
  if (!feedbackId) return
  await db.update(cancellationFeedback).set({ ...patch, updatedAt: new Date() }).where(eq(cancellationFeedback.id, feedbackId))
}

/**
 * Kündigen – zum Laufzeitende (wie bisher) oder sofort, wenn das Abo gerade pausiert (es läuft nichts, was man
 * verlieren könnte). Der Grund wandert als `cancellation_details` zu Stripe.
 */
export async function confirmCancellation(userId: string, feedbackId: string | null): Promise<{ cancel_at_period_end: boolean; current_period_end: number | null; immediate: boolean }> {
  const u = await loadUser(userId)
  if (!u.stripeCustomerId) throw new CancellationError('NO_SUBSCRIPTION', 400, 'Kein aktives Abonnement.')
  const row = await feedbackRow(userId, feedbackId)
  const stripe = getStripe()
  try {
    const subs = await stripe.subscriptions.list({ customer: u.stripeCustomerId, status: 'active', limit: 1, expand: ['data.items', 'data.schedule'] })
    const sub = subs.data[0]
    if (!sub) throw new CancellationError('NO_SUBSCRIPTION', 400, 'Kein aktives Abonnement gefunden.')
    const details: Stripe.SubscriptionUpdateParams.CancellationDetails = row
      ? { feedback: STRIPE_FEEDBACK[row.reason as CancelReason] ?? 'other', ...(row.comment ? { comment: row.comment.slice(0, 500) } : {}) }
      : {}
    // Ein geplanter Tarifwechsel oder eine eingeplante Pause (Zeitplan) würde die Kündigung blockieren – Kündigung geht vor
    await releasePendingPlanChange(stripe, userId, sub)

    if (u.pauseStartedAt) {
      // Mitten in der Pause: sofort beenden – es gibt nichts zu erstatten und nichts, was weiterlaufen müsste
      await stripe.subscriptions.cancel(sub.id, { cancellation_details: details })
      await clearPauseState(userId)
      await setResult(row?.id ?? null, { outcome: 'canceled', ...(row?.offerResult ? {} : { offerResult: row && row.offerShown !== 'none' ? 'declined' : null }) })
      console.info('[cancellation] immediate (paused):', userId)
      return { cancel_at_period_end: false, current_period_end: null, immediate: true }
    }

    const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true, cancellation_details: details })
    const itemEnd = periodEndOf(updated)
    await db.update(users).set({ cancelAtPeriodEnd: true, cancelEndNoticeSentAt: null, renewalReminderOptIn: false }).where(eq(users.id, userId))
    await setResult(row?.id ?? null, { outcome: 'canceled', ...(row?.offerResult ? {} : { offerResult: row && row.offerShown !== 'none' ? 'declined' : null }) })
    console.info('[cancellation] scheduled at period end:', userId)
    return { cancel_at_period_end: updated.cancel_at_period_end, current_period_end: itemEnd, immediate: false }
  } catch (err) {
    throw toError(err)
  }
}

/** Fenster geschlossen, ohne etwas zu entscheiden. */
export async function dismissCancellation(userId: string, feedbackId: string | null): Promise<void> {
  const row = await feedbackRow(userId, feedbackId)
  if (!row || row.outcome !== 'started') return
  await setResult(row.id, { offerResult: row.offerShown === 'none' ? null : 'dismissed', outcome: 'abandoned' })
}

/** Nachricht in den Support-Chat (bestehende offene Unterhaltung oder neue). */
async function postSupportMessage(userId: string, content: string): Promise<void> {
  const now = new Date()
  let conv = await db.query.supportConversations.findFirst({
    where: and(eq(supportConversations.userId, userId), eq(supportConversations.deletedByUser, false)),
    orderBy: [desc(supportConversations.lastMessageAt)],
  })
  if (!conv || conv.status === 'closed') {
    ;[conv] = await db.insert(supportConversations).values({ userId, status: 'open', subject: 'Kündigung', lastMessageAt: now }).returning()
  }
  await db.insert(supportMessages).values({ conversationId: conv.id, senderType: 'user', senderId: userId, content, contentType: 'text' })
  await db.update(supportConversations)
    .set({ lastMessageAt: now, unreadByAdmin: (conv.unreadByAdmin ?? 0) + 1, status: 'open', updatedAt: now })
    .where(eq(supportConversations.id, conv.id))
}

export type AcceptResult = { outcome: 'kept' | 'paused' | 'canceled'; detail?: Record<string, unknown> }

/** Schritt 2: der Nutzer nimmt ein Angebot an (oder behält das Abo einfach). */
export async function acceptOffer(
  userId: string,
  feedbackId: string | null,
  action: OfferAction,
  params: { months?: unknown; plan?: unknown; message?: unknown; alsoCancel?: unknown } = {},
): Promise<AcceptResult> {
  const row = await feedbackRow(userId, feedbackId)
  const u = await loadUser(userId)
  try {
    switch (action) {
      case 'discount': {
        const r = await applyRetentionDiscount(userId)
        await setResult(row?.id ?? null, { offerResult: 'accepted', outcome: 'kept' })
        return { outcome: 'kept', detail: { mode: r.mode, startsAfter: r.startsAfter?.toISOString() ?? null } }
      }
      case 'pause': {
        const months = typeof params.months === 'number' ? params.months : Number(params.months)
        const info = await schedulePause(userId, months)
        await setResult(row?.id ?? null, { offerResult: 'accepted', outcome: 'paused' })
        return { outcome: 'paused', detail: { pause: info } }
      }
      case 'downgrade': {
        const plan = typeof params.plan === 'string' ? params.plan : ''
        const pending = await schedulePlanChange(userId, plan, [])
        await setResult(row?.id ?? null, { offerResult: 'accepted', outcome: 'kept' })
        return { outcome: 'kept', detail: { pending_change: pending } }
      }
      case 'yearly_to_monthly': {
        const pending = await schedulePlanChange(userId, u.plan, [], { targetInterval: 'monthly' })
        await setResult(row?.id ?? null, { offerResult: 'accepted', outcome: 'kept' })
        return { outcome: 'kept', detail: { pending_change: pending } }
      }
      case 'reminder': {
        if (u.billingInterval !== 'yearly') throw new CancellationError('NOT_YEARLY', 400, 'Die Erinnerung gibt es nur beim Jahresabo.')
        await db.update(users).set({ renewalReminderOptIn: true, renewalReminderSentAt: null }).where(eq(users.id, userId))
        await setResult(row?.id ?? null, { offerResult: 'accepted', outcome: 'kept' })
        return { outcome: 'kept', detail: { reminder: true } }
      }
      case 'talk': {
        const message = typeof params.message === 'string' ? params.message.trim().slice(0, COMMENT_MAX) : ''
        if (message.length < 3) throw new CancellationError('MESSAGE_REQUIRED', 400, 'Schreib uns kurz, worum es geht.')
        const reasonLabel = row ? CANCEL_REASON_LABELS[row.reason as CancelReason] ?? row.reason : 'Kündigung'
        await postSupportMessage(userId, `Aus dem Kündigungsfenster (${reasonLabel}):\n\n${message}`)
        if (params.alsoCancel === true) {
          await setResult(row?.id ?? null, { offerResult: 'accepted' })
          await confirmCancellation(userId, row?.id ?? null)
          return { outcome: 'canceled', detail: { message: true } }
        }
        await setResult(row?.id ?? null, { offerResult: 'accepted', outcome: 'kept' })
        return { outcome: 'kept', detail: { message: true } }
      }
      case 'keep':
      default: {
        await setResult(row?.id ?? null, { offerResult: row && row.offerShown !== 'none' ? 'declined' : null, outcome: 'kept' })
        return { outcome: 'kept' }
      }
    }
  } catch (err) {
    throw toError(err)
  }
}

// ─── Jahresabo: Ein-Klick-Kündigung aus der bestellten Erinnerungsmail ───────────────────────────────

function tokenSecret(): string {
  return process.env.BETTER_AUTH_SECRET ?? process.env.CRON_SECRET ?? ''
}

/** Signierter Link: nur dieses Konto, nur bis einen Tag nach der Verlängerung. */
export function renewalCancelToken(userId: string, periodEnd: Date): string {
  const exp = Math.floor(periodEnd.getTime() / 1000) + 24 * 60 * 60
  const payload = Buffer.from(JSON.stringify({ u: userId, e: exp }), 'utf8').toString('base64url')
  const sig = createHmac('sha256', tokenSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyRenewalCancelToken(token: string): { userId: string; exp: number } | null {
  const [payload, sig] = token.split('.')
  if (!payload || !sig || !tokenSecret()) return null
  const expected = createHmac('sha256', tokenSecret()).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { u?: string; e?: number }
    if (!data.u || !data.e || data.e * 1000 < Date.now()) return null
    return { userId: data.u, exp: data.e }
  } catch {
    return null
  }
}

/** Kündigung per Token (Erinnerungsmail): kein Angebot, kein Grund – der Nutzer hat sich schon entschieden. */
export async function cancelByRenewalToken(token: string): Promise<{ periodEnd: Date | null; email: string | null }> {
  const data = verifyRenewalCancelToken(token)
  if (!data) throw new CancellationError('BAD_TOKEN', 400, 'Der Link ist abgelaufen oder ungültig.')
  const u = await loadUser(data.userId)
  if (u.cancelAtPeriodEnd) return { periodEnd: u.currentPeriodEnd, email: u.email }
  const [row] = await db.insert(cancellationFeedback).values({
    userId: u.id, reason: 'other', comment: 'Kündigung über die bestellte Erinnerungsmail (Jahresabo)', plan: u.plan,
    billingInterval: u.billingInterval, offerShown: 'none', outcome: 'started', stripeSubscriptionId: u.stripeSubscriptionId, periodEnd: u.currentPeriodEnd,
  }).returning({ id: cancellationFeedback.id })
  const r = await confirmCancellation(u.id, row.id)
  return { periodEnd: r.current_period_end ? new Date(r.current_period_end * 1000) : u.currentPeriodEnd, email: u.email }
}
