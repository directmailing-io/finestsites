/**
 * Admin-Sicht auf den Kündigungsprozess (03.11.2026): Zeilen aus cancellation_feedback mit Nutzer,
 * Kennzahlen, Gründe-Verteilung, laufende Kündigungen und Pausen – alles aus unserer DB, nicht aus Stripe
 * (die alte Seite las nur die ersten 100 Stripe-Abos).
 */
import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appSettings, cancellationFeedback, users } from '@/lib/db/schema'
import { CANCEL_REASON_LABELS, type CancelReason } from '@/lib/billing/cancellation-offer'

export const SEEN_KEY = 'cancellations_seen_at'

const MRR_RATE: Record<string, Record<string, number>> = {
  starter: { monthly: 17, yearly: 170 / 12 },
  pro: { monthly: 27, yearly: 270 / 12 },
  unlimited: { monthly: 37, yearly: 370 / 12 },
}
export function mrrFor(plan: string | null, interval: string | null): number {
  return MRR_RATE[plan ?? '']?.[interval ?? 'monthly'] ?? 0
}

export const OFFER_LABELS: Record<string, string> = {
  none: 'keins', discount: '10 % Rabatt', discount_followup: 'Rabatt-Anschluss', pause: 'Pause', 'pause+discount': 'Pause + Rabatt',
  downgrade: 'Kleinerer Tarif', reminder: 'Erinnerung (Jahresabo)', talk: 'Gespräch',
}
export const RESULT_LABELS: Record<string, string> = { accepted: 'angenommen', declined: 'abgelehnt', dismissed: 'weggeklickt' }
export const OUTCOME_LABELS: Record<string, string> = { started: 'offen', canceled: 'gekündigt', paused: 'pausiert', kept: 'geblieben', abandoned: 'abgebrochen' }

export function reasonLabel(reason: string): string {
  return CANCEL_REASON_LABELS[reason as CancelReason] ?? reason
}

export type FeedbackRow = {
  id: string
  createdAt: Date
  reason: string
  comment: string | null
  plan: string | null
  billingInterval: string | null
  discountAtTime: string | null
  tenureDays: number | null
  offerShown: string
  offerResult: string | null
  outcome: string
  periodEnd: Date | null
  userId: string
  email: string | null
  username: string | null
  firstName: string | null
  lastName: string | null
}

export async function loadFeedback(sinceDays: number, limit = 300): Promise<FeedbackRow[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
  const rows = await db
    .select({
      id: cancellationFeedback.id, createdAt: cancellationFeedback.createdAt, reason: cancellationFeedback.reason, comment: cancellationFeedback.comment,
      plan: cancellationFeedback.plan, billingInterval: cancellationFeedback.billingInterval, discountAtTime: cancellationFeedback.discountAtTime,
      tenureDays: cancellationFeedback.tenureDays, offerShown: cancellationFeedback.offerShown, offerResult: cancellationFeedback.offerResult,
      outcome: cancellationFeedback.outcome, periodEnd: cancellationFeedback.periodEnd, userId: cancellationFeedback.userId,
      email: users.email, username: users.username, firstName: users.firstName, lastName: users.lastName,
    })
    .from(cancellationFeedback)
    .leftJoin(users, eq(users.id, cancellationFeedback.userId))
    .where(gte(cancellationFeedback.createdAt, since))
    .orderBy(desc(cancellationFeedback.createdAt))
    .limit(limit)
  return rows
}

export async function loadFeedbackForUser(userId: string): Promise<FeedbackRow[]> {
  return db
    .select({
      id: cancellationFeedback.id, createdAt: cancellationFeedback.createdAt, reason: cancellationFeedback.reason, comment: cancellationFeedback.comment,
      plan: cancellationFeedback.plan, billingInterval: cancellationFeedback.billingInterval, discountAtTime: cancellationFeedback.discountAtTime,
      tenureDays: cancellationFeedback.tenureDays, offerShown: cancellationFeedback.offerShown, offerResult: cancellationFeedback.offerResult,
      outcome: cancellationFeedback.outcome, periodEnd: cancellationFeedback.periodEnd, userId: cancellationFeedback.userId,
      email: users.email, username: users.username, firstName: users.firstName, lastName: users.lastName,
    })
    .from(cancellationFeedback)
    .leftJoin(users, eq(users.id, cancellationFeedback.userId))
    .where(eq(cancellationFeedback.userId, userId))
    .orderBy(desc(cancellationFeedback.createdAt))
    .limit(20)
}

/** Laufende Kündigungen (cancel_at_period_end) und Pausen – aus der DB, vollständig. */
export async function loadPendingStates() {
  const [cancelling, paused] = await Promise.all([
    db.select({ id: users.id, email: users.email, username: users.username, plan: users.plan, billingInterval: users.billingInterval, currentPeriodEnd: users.currentPeriodEnd })
      .from(users).where(and(eq(users.cancelAtPeriodEnd, true), sql`${users.deletedAt} is null`)).orderBy(users.currentPeriodEnd),
    db.select({ id: users.id, email: users.email, username: users.username, plan: users.plan, billingInterval: users.billingInterval, pauseFrom: users.pauseFrom, pauseUntil: users.pauseUntil, pauseStartedAt: users.pauseStartedAt, pendingPlan: users.pendingPlan })
      .from(users).where(isNotNull(users.pauseScheduleId)).orderBy(users.pauseFrom),
  ])
  return { cancelling, paused }
}

export async function unseenCount(): Promise<number> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, SEEN_KEY))
  const seen = row?.value ? new Date(row.value) : new Date(0)
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(cancellationFeedback).where(gte(cancellationFeedback.createdAt, seen))
  return n
}

export async function markSeen(adminId: string | null): Promise<void> {
  const now = new Date()
  await db.insert(appSettings).values({ key: SEEN_KEY, value: now.toISOString(), updatedBy: adminId, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: now.toISOString(), updatedBy: adminId, updatedAt: now } })
}

export function feedbackCsv(rows: FeedbackRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Datum', 'E-Mail', 'Benutzername', 'Tarif', 'Intervall', 'Rabatt', 'Monate dabei', 'Grund', 'Kommentar', 'Angebot', 'Reaktion', 'Ergebnis', 'Laufzeitende']
  const lines = rows.map(r => [
    r.createdAt.toISOString(), r.email, r.username, r.plan, r.billingInterval, r.discountAtTime,
    r.tenureDays != null ? Math.round(r.tenureDays / 30) : '', reasonLabel(r.reason), r.comment,
    OFFER_LABELS[r.offerShown] ?? r.offerShown, r.offerResult ? RESULT_LABELS[r.offerResult] ?? r.offerResult : '',
    OUTCOME_LABELS[r.outcome] ?? r.outcome, r.periodEnd ? r.periodEnd.toISOString() : '',
  ].map(esc).join(';'))
  return '﻿' + [head.map(esc).join(';'), ...lines].join('\n')
}
