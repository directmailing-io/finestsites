/**
 * Lifecycle-Mails rund um Kündigung und Pause (03.11.2026, docs/kuendigung/konzept.html, Abschnitt 12).
 * Läuft im täglichen Cron (billing-enforcement). Jede Mail genau einmal: Marker-Spalten auf dem Nutzer,
 * gleiches Muster wie beim Mahnwesen (recovery-notifications.ts).
 *
 *   cancelEnding   – 3 Tage vor dem Laufzeitende nach einer Kündigung (nur an Gekündigte)
 *   deletionWarn   – 14 Tage vor der endgültigen Löschung (90 Tage nach dem Abo-Ende)
 *   pauseEnding    – 7 Tage vor dem Pausenende (Datum, Preis, Zahlungsmethode)
 *   renewalRemind  – Jahresabo, 14 Tage vor der Verlängerung, NUR wenn im Kündigungsflow bestellt (Opt-in)
 *   retention      – Sicherheitsnetz: vorgemerkten Treue-Rabatt anwenden, falls der Webhook es verpasst hat
 *   pauseState     – Sicherheitsnetz: Pausen-Merker mit Stripe abgleichen
 *
 * Bewusst KEINE „Dein Rabatt endet“-Mail und KEINE Mail an Daniel (seine Entscheidung).
 */
import { and, eq, gt, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, userSites } from '@/lib/db/schema'
import { sendEmail } from '@/lib/resend'
import { getStripe } from '@/lib/stripe/client'
import { PLANS, PLAN_ORDER, type PlanKey } from '@/lib/plans'
import { formatDate } from '@/lib/billing/plan-change'
import { resolveDefaultPaymentMethodId } from '@/lib/billing/payment-recovery'
import { applyPendingRetentionIfDue } from '@/lib/billing/retention'
import { pauseAllowedFor, reconcilePauseState, PAUSE_COLUMNS } from '@/lib/billing/pause'
import { renewalCancelToken } from '@/lib/billing/cancellation'
import { cancelEndingSoonEmail, deletionWarningEmail, pauseEndingSoonEmail, renewalReminderEmail } from '@/lib/email/templates'

const DAY_MS = 24 * 60 * 60 * 1000
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')

export type LifecycleStats = { cancelEnding: number; deletionWarn: number; pauseEnding: number; renewalRemind: number; retention: number; pauseState: number; errors: number }

function planOf(plan: string): PlanKey {
  return PLAN_ORDER.includes(plan as PlanKey) ? (plan as PlanKey) : 'starter'
}

/** „Visa ••4242“ / „SEPA-Lastschrift ••1234“ für Mails; null, wenn unbekannt */
export async function paymentMethodLabel(customerId: string | null, subscriptionId: string | null): Promise<string | null> {
  if (!customerId) return null
  try {
    const stripe = getStripe()
    const pmId = await resolveDefaultPaymentMethodId(customerId, subscriptionId)
    if (!pmId) return null
    const pm = await stripe.paymentMethods.retrieve(pmId)
    if (pm.type === 'card' && pm.card) return `${pm.card.brand === 'visa' ? 'Visa' : pm.card.brand === 'mastercard' ? 'Mastercard' : pm.card.brand === 'amex' ? 'American Express' : 'Karte'} ••${pm.card.last4}`
    if (pm.type === 'sepa_debit' && pm.sepa_debit) return `SEPA-Lastschrift ••${pm.sepa_debit.last4}`
    return null
  } catch {
    return null
  }
}

export async function runLifecycleNotifications(now: Date = new Date()): Promise<LifecycleStats> {
  const stats: LifecycleStats = { cancelEnding: 0, deletionWarn: 0, pauseEnding: 0, renewalRemind: 0, retention: 0, pauseState: 0, errors: 0 }

  // ── 3 Tage vor dem Laufzeitende nach Kündigung ──────────────────────────────
  try {
    const rows = await db.query.users.findMany({
      where: and(
        eq(users.cancelAtPeriodEnd, true),
        isNotNull(users.currentPeriodEnd),
        gt(users.currentPeriodEnd, now),
        lte(users.currentPeriodEnd, new Date(now.getTime() + 3 * DAY_MS)),
        isNull(users.cancelEndNoticeSentAt),
        isNull(users.deletionRequestedAt),
        isNull(users.deletedAt),
      ),
      columns: { id: true, email: true, currentPeriodEnd: true, stripeCustomerId: true, cancelAtPeriodEnd: true, deletionRequestedAt: true, deletedAt: true, deactivatedAt: true, subscriptionStatus: true, paymentFailedAt: true, paymentFailedInvoiceId: true, paymentGraceUntil: true, paymentRetryProcessingAt: true, ...PAUSE_COLUMNS },
    })
    for (const u of rows) {
      try {
        await db.update(users).set({ cancelEndNoticeSentAt: now }).where(eq(users.id, u.id))
        // Pause nur anbieten, wenn sie nach Rücknahme der Kündigung möglich wäre
        const pauseAvailable = pauseAllowedFor({ ...u, cancelAtPeriodEnd: false }, now).ok
        const r = await sendEmail({ to: u.email, subject: 'In 3 Tagen gehen deine Seiten offline · FinestSites', html: cancelEndingSoonEmail({ periodEnd: formatDate(u.currentPeriodEnd!), pauseAvailable }), type: 'cancel_ending_soon' })
        if (r.status === 'sent') stats.cancelEnding++
      } catch (err) { stats.errors++; console.error('[lifecycle] cancelEnding', u.id, err) }
    }
  } catch (err) { stats.errors++; console.error('[lifecycle] cancelEnding query', err) }

  // ── 14 Tage vor der endgültigen Löschung ────────────────────────────────────
  try {
    const rows = await db.execute(sql`
      select u.id, u.email, min(s.scheduled_deletion_at) as delete_at
      from users u
      join user_sites s on s.user_id = u.id and s.status = 'deactivated' and s.scheduled_deletion_at is not null
      where u.deactivated_at is not null and u.deletion_requested_at is null and u.deleted_at is null
        and s.scheduled_deletion_at > ${now} and s.scheduled_deletion_at <= ${new Date(now.getTime() + 14 * DAY_MS)}
        and (u.deletion_notice_sent_at is null or u.deletion_notice_sent_at < u.deactivated_at)
      group by u.id, u.email`)
    const list = ((rows as { rows?: unknown[] }).rows ?? (rows as unknown[])) as { id: string; email: string; delete_at: string | Date }[]
    for (const u of list) {
      try {
        await db.update(users).set({ deletionNoticeSentAt: now }).where(eq(users.id, u.id))
        const r = await sendEmail({ to: u.email, subject: 'Deine Inhalte werden in 14 Tagen gelöscht · FinestSites', html: deletionWarningEmail({ deleteDate: formatDate(new Date(u.delete_at)) }), type: 'deletion_warning' })
        if (r.status === 'sent') stats.deletionWarn++
      } catch (err) { stats.errors++; console.error('[lifecycle] deletionWarn', u.id, err) }
    }
  } catch (err) { stats.errors++; console.error('[lifecycle] deletionWarn query', err) }

  // ── 7 Tage vor dem Pausenende ───────────────────────────────────────────────
  try {
    const rows = await db.query.users.findMany({
      where: and(
        isNotNull(users.pauseStartedAt),
        isNotNull(users.pauseUntil),
        gt(users.pauseUntil, now),
        lte(users.pauseUntil, new Date(now.getTime() + 7 * DAY_MS)),
        isNull(users.pauseEndNoticeSentAt),
      ),
      columns: { id: true, email: true, pauseUntil: true, plan: true, billingInterval: true, stripeCustomerId: true, stripeSubscriptionId: true, pendingPlan: true, pendingPlanInterval: true },
    })
    for (const u of rows) {
      try {
        await db.update(users).set({ pauseEndNoticeSentAt: now }).where(eq(users.id, u.id))
        const plan = planOf(u.pendingPlan ?? u.plan)
        const yearly = (u.pendingPlan ? u.pendingPlanInterval : u.billingInterval) === 'yearly'
        const pm = await paymentMethodLabel(u.stripeCustomerId, u.stripeSubscriptionId)
        const r = await sendEmail({
          to: u.email, subject: 'Deine Pause endet in 7 Tagen · FinestSites', type: 'pause_ending_soon',
          html: pauseEndingSoonEmail({ until: formatDate(u.pauseUntil!), planName: PLANS[plan].name, price: yearly ? PLANS[plan].yearly_eur : PLANS[plan].monthly_eur, unit: yearly ? 'Jahr' : 'Monat', paymentMethod: pm }),
        })
        if (r.status === 'sent') stats.pauseEnding++
      } catch (err) { stats.errors++; console.error('[lifecycle] pauseEnding', u.id, err) }
    }
  } catch (err) { stats.errors++; console.error('[lifecycle] pauseEnding query', err) }

  // ── Jahresabo: bestellte Erinnerung 14 Tage vor der Verlängerung ────────────
  try {
    const rows = await db.query.users.findMany({
      where: and(
        eq(users.renewalReminderOptIn, true),
        eq(users.billingInterval, 'yearly'),
        eq(users.cancelAtPeriodEnd, false),
        eq(users.subscriptionStatus, 'active'),
        isNotNull(users.currentPeriodEnd),
        gt(users.currentPeriodEnd, now),
        lte(users.currentPeriodEnd, new Date(now.getTime() + 14 * DAY_MS)),
        or(isNull(users.renewalReminderSentAt), lte(users.renewalReminderSentAt, new Date(now.getTime() - 30 * DAY_MS))),
        isNull(users.deletionRequestedAt),
        isNull(users.deletedAt),
      ),
      columns: { id: true, email: true, currentPeriodEnd: true, plan: true, stripeCustomerId: true, stripeSubscriptionId: true },
    })
    for (const u of rows) {
      try {
        await db.update(users).set({ renewalReminderSentAt: now }).where(eq(users.id, u.id))
        const plan = planOf(u.plan)
        let amount = PLANS[plan].yearly_eur
        try {
          if (u.stripeSubscriptionId) {
            const preview = await getStripe().invoices.createPreview({ subscription: u.stripeSubscriptionId })
            if (typeof preview.amount_due === 'number' && preview.amount_due > 0) amount = preview.amount_due / 100
          }
        } catch { /* Listenpreis */ }
        const pm = await paymentMethodLabel(u.stripeCustomerId, u.stripeSubscriptionId)
        const cancelUrl = `${APP_URL}/abo/kuendigen?token=${encodeURIComponent(renewalCancelToken(u.id, u.currentPeriodEnd!))}`
        const r = await sendEmail({
          to: u.email, subject: `Deine Verlängerung am ${formatDate(u.currentPeriodEnd!)} · FinestSites`, type: 'renewal_reminder',
          html: renewalReminderEmail({ date: formatDate(u.currentPeriodEnd!), amount, planName: PLANS[plan].name, paymentMethod: pm, cancelUrl }),
        })
        if (r.status === 'sent') stats.renewalRemind++
      } catch (err) { stats.errors++; console.error('[lifecycle] renewalRemind', u.id, err) }
    }
  } catch (err) { stats.errors++; console.error('[lifecycle] renewalRemind query', err) }

  // ── Sicherheitsnetze ───────────────────────────────────────────────────────
  try {
    const pending = await db.query.users.findMany({ where: and(eq(users.retentionCouponPending, true), isNull(users.deletedAt)), columns: { id: true } })
    for (const u of pending) {
      try { if (await applyPendingRetentionIfDue(u.id)) stats.retention++ } catch (err) { stats.errors++; console.error('[lifecycle] retention', u.id, err) }
    }
  } catch (err) { stats.errors++; console.error('[lifecycle] retention query', err) }
  try {
    const paused = await db.query.users.findMany({ where: isNotNull(users.pauseScheduleId), columns: { id: true } })
    for (const u of paused) {
      try { if ((await reconcilePauseState(u.id)) !== 'unchanged') stats.pauseState++ } catch (err) { stats.errors++; console.error('[lifecycle] pauseState', u.id, err) }
    }
  } catch (err) { stats.errors++; console.error('[lifecycle] pauseState query', err) }

  return stats
}

export { userSites }
