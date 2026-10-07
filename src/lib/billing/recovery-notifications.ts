/**
 * Customer mails during an arrears episode. One place, state-driven, so the
 * webhook, the cron and the admin panel can call it any number of times and
 * every mail goes out exactly once:
 *
 *   notice   — day 0: "Zahlung hat nicht geklappt, Seite bleibt bis X online"
 *              (or straight the offline mail when the grace is already over)
 *   reminder — day REMINDER_AFTER_DAYS while still online
 *   offline  — the moment the sites are offline (grace over / second strike)
 *
 * The notice is deliberately NOT sent from inside invoice.payment_failed for
 * a subscription's first invoice: Stripe may void that invoice seconds later
 * and the pay link in the mail would be dead. The cron picks it up within
 * 15 minutes with the replacement invoice's link.
 */

import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { sendEmail } from '@/lib/resend'
import { paymentFailedEmail, paymentReminderEmail, sitesOfflineEmail } from '@/lib/email/templates'
import {
  REMINDER_AFTER_DAYS,
  addDays,
  formatDateDe,
  formatEur,
  hardDeadlineFor,
  shouldBeOffline,
  trackedInvoiceInfo,
} from '@/lib/billing/payment-recovery'

const DAY_MS = 24 * 60 * 60 * 1000

export type NotificationStats = { notice: number; reminder: number; offline: number; errors: number }

export async function runRecoveryNotificationsFor(userId: string, now: Date = new Date()): Promise<keyof NotificationStats | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      email: true,
      subscriptionStatus: true,
      paymentFailedAt: true,
      paymentFailedInvoiceId: true,
      paymentGraceUntil: true,
      paymentRetryProcessingAt: true,
      paymentNoticeSentAt: true,
      paymentReminderSentAt: true,
      paymentOfflineNotifiedAt: true,
      deactivatedAt: true,
    },
  })
  if (!user || !user.paymentFailedAt || user.deactivatedAt || !user.email) return null

  const offline = shouldBeOffline(user, now)
  const graceUntil = user.paymentGraceUntil ?? addDays(user.paymentFailedAt, 0)
  const deadline = hardDeadlineFor(user.paymentFailedAt)

  // Decide first, fetch Stripe only when a mail is actually due
  let due: 'notice' | 'reminder' | 'offline' | null = null
  if (!user.paymentNoticeSentAt) {
    due = 'notice'
  } else if (offline && !user.paymentOfflineNotifiedAt) {
    due = 'offline'
  } else if (
    !offline &&
    !user.paymentReminderSentAt &&
    !user.paymentRetryProcessingAt &&
    now.getTime() >= user.paymentFailedAt.getTime() + REMINDER_AFTER_DAYS * DAY_MS &&
    now.getTime() < graceUntil.getTime()
  ) {
    due = 'reminder'
  }
  if (!due) return null

  const info = await trackedInvoiceInfo(user.paymentFailedInvoiceId)
  const amount = formatEur(info.amountCents)
  const params = { payUrl: info.payUrl, graceUntil: formatDateDe(graceUntil), amount }

  if (due === 'notice' && offline) {
    // Grace already over when the first mail goes out (e.g. second strike
    // before any notice) — tell them the truth, not "stays online until X"
    await sendEmail({ to: user.email, subject: 'Deine Seite ist jetzt offline', html: sitesOfflineEmail({ payUrl: info.payUrl, amount, deadline: formatDateDe(deadline) }), type: 'sites_offline' })
    await db.update(users).set({ paymentNoticeSentAt: now, paymentOfflineNotifiedAt: now }).where(eq(users.id, userId))
    return 'offline'
  }
  if (due === 'notice') {
    await sendEmail({ to: user.email, subject: 'Deine Zahlung hat nicht geklappt', html: paymentFailedEmail(params), type: 'payment_failed' })
    await db.update(users).set({ paymentNoticeSentAt: now }).where(eq(users.id, userId))
    return 'notice'
  }
  if (due === 'offline') {
    await sendEmail({ to: user.email, subject: 'Deine Seite ist jetzt offline', html: sitesOfflineEmail({ payUrl: info.payUrl, amount, deadline: formatDateDe(deadline) }), type: 'sites_offline' })
    await db.update(users).set({ paymentOfflineNotifiedAt: now }).where(eq(users.id, userId))
    return 'offline'
  }
  const daysLeft = Math.max(1, Math.ceil((graceUntil.getTime() - now.getTime()) / DAY_MS))
  await sendEmail({ to: user.email, subject: `Noch ${daysLeft === 1 ? '1 Tag' : `${daysLeft} Tage`}, dann geht deine Seite offline`, html: paymentReminderEmail({ ...params, daysLeft }), type: 'payment_reminder' })
  await db.update(users).set({ paymentReminderSentAt: now }).where(eq(users.id, userId))
  return 'reminder'
}

/** Cron entry point: every user with an open arrears episode. */
export async function runRecoveryNotifications(now: Date = new Date()): Promise<NotificationStats> {
  const stats: NotificationStats = { notice: 0, reminder: 0, offline: 0, errors: 0 }
  const candidates = await db.query.users.findMany({
    where: and(isNotNull(users.paymentFailedAt), isNull(users.deactivatedAt)),
    columns: { id: true },
  })
  for (const { id } of candidates) {
    try {
      const sent = await runRecoveryNotificationsFor(id, now)
      if (sent) stats[sent]++
    } catch (err) {
      stats.errors++
      console.error(`[recovery-notifications] ${id}:`, err instanceof Error ? err.message : err)
    }
  }
  return stats
}
