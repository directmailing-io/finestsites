/**
 * Konto löschen – der EINE Ablauf für Web (/api/account/deletion), App (/api/app/v1/account/deletion)
 * und Cron (/api/cron/account-deletion).
 *
 * 1. Anfrage (requestDeletion): Passwort prüfen, Admin-Konten sperren, Partner-Guthaben → ausdrückliche
 *    Wahl (Auszahlung oder Verzicht). Zwei Wege (timing), in beiden wird NICHTS erstattet:
 *    a) 'now': Seiten sofort offline (published → deactivated, KV-Offline-Marker, Custom-Domain-Zuordnung
 *       raus), Stripe-Abo sofort beenden (ohne Erstattung, ohne Schlussrechnung), alle Sitzungen beendet,
 *       Push-Geräte entfernt, Löschung nach 14 Tagen.
 *    b) 'period_end' (nur mit laufendem, bezahltem Abo ohne Zahlungsstörung): Stripe cancel_at_period_end,
 *       Seiten bleiben online, Konto bleibt nutzbar (nur Tarifkauf gesperrt, guard.ts), Sitzungen bleiben,
 *       Löschung zum Ende des bezahlten Zeitraums (frühestens nach 14 Tagen). Läuft das Abo aus, nimmt der
 *       Stripe-Webhook (customer.subscription.deleted) die Seiten offline.
 *    Bestätigungsmail (Kategorie system) in beiden Fällen.
 * 2. Bedenkzeit: Anmelden geht. Bei 'now' zeigen Dashboard/App nur „Konto wird gelöscht am … – Löschung
 *    abbrechen“; Veröffentlichen, neue Seiten und Kauf sind gesperrt. Bei 'period_end' ein Banner.
 *    Abbrechen (cancelDeletion): 'now' → Konto wie vorher, Seiten bleiben offline (→ Entwurf, neu
 *    veröffentlichen), das beendete Abo kommt nicht zurück. 'period_end' → Kündigung bei Stripe zurück-
 *    genommen, Abo läuft weiter, Seiten unverändert (waren sie schon offline, weil die Laufzeit vorbei
 *    ist: → Entwurf wie bei 'now').
 * 3. Cron nach Ablauf (runAccountDeletionCron → executeDeletion): persönliche Daten, Seiten, Anfragen,
 *    Support, Bilder (R2), Tracking, eigene Domains (CF Custom Hostname), Sitzungen/Logins gelöscht.
 *    Die users-Zeile bleibt als Grabstein (id, Benutzername reserviert, E-Mail deleted-<id>@deleted.invalid).
 *    Aufbewahrungspflichtige Buchungen bleiben (Gutschriften, Provisionen, Auszahlungen) mit retention_until.
 * 4. Schlussabrechnung (settleDeletedPartnerBalances): Guthaben bei Wahl „Auszahlung“ (oder ohne Wahl,
 *    wenn erst in der Bedenkzeit Guthaben entstand – nie stiller Verfall) per Überweisung ohne
 *    Mindestbetrag, sobald verfügbar. Ohne Auszahlungskonto: auf Anfrage auszahlbar bis zur Verjährung.
 */
import { and, eq, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import { verifyPassword } from 'better-auth/crypto'
import { db } from '@/lib/db'
import {
  users, accounts, sessions, verifications, userSites, siteImages, supportConversations, impersonationRequests,
  userNotifications, pushDevices, pushOutbox, notificationPreferences, trackingConfigs, templateAccess,
  affiliateClicks, affiliateCommissions, affiliatePayouts, affiliateTaxProfiles, subscriptionEvents, emailLogs,
  appSettings, supportAiSuggestions, accountDeletionRequests,
} from '@/lib/db/schema'
import { recoveryCleared } from '@/lib/billing/payment-recovery'
import { isTaxProfileComplete } from '@/lib/affiliate/tax'
import { releaseMaturedCommissions, processFinalPayout, notifyAdminSingle } from '@/lib/affiliate/payout'
import { getCustomerCreditCents } from '@/lib/affiliate/customer-balance'
import { getStripe } from '@/lib/stripe/client'
import { assertStripeKeyAllowed } from '@/lib/security/stripe-key-guard'
import { sendEmail } from '@/lib/resend'
import {
  accountDeletionRequestedEmail, accountDeletionCancelledEmail, accountDeletionCompletedEmail, accountDeletionAdminEmail,
} from '@/lib/email/templates'
import { waiverText, type BalanceChoice, type DeletionStatusResponse, type DeletionTiming } from '@/lib/contracts/app-v1/account-deletion'
import { effects, cancelStripeSubscriptions, setCancelAtPeriodEnd, userR2Prefixes } from './effects'
import {
  DELETION_GRACE_DAYS, tombstoneEmail, graceEnd, endOfYearPlus, formatDateLongDe, formatEurDe,
  RETENTION_YEARS_BOOKINGS, LIMITATION_YEARS,
} from './rules'

const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL ?? process.env.ADMIN_EMAIL ?? 'info@daniel-kurzeja.de'

// ─── Fehler ──────────────────────────────────────────────────────────────────

export type DeletionErrorCode =
  | 'NOT_FOUND' | 'INVALID_PASSWORD' | 'BALANCE_CHOICE_REQUIRED' | 'PERIOD_END_NOT_AVAILABLE' | 'DELETION_NOT_ALLOWED'
  | 'DELETION_ALREADY_REQUESTED' | 'NO_DELETION_PENDING'

/**
 * Selbst-Löschung ist erst aktiv, wenn app_settings.account_deletion_enabled = 'true' (nach AGB-Änderung
 * mit Vorlauf für Bestandskunden). Bis dahin: Hinweis auf info@finestsites.io (wie bisher in den AGB).
 */
export async function isSelfDeletionEnabled(): Promise<boolean> {
  try {
    const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, 'account_deletion_enabled') })
    return row?.value.trim() === 'true'
  } catch {
    return false
  }
}

export class DeletionError extends Error {
  constructor(public code: DeletionErrorCode) { super(code) }
}

// ─── Status / Guthaben ───────────────────────────────────────────────────────

export interface PartnerBalance {
  availableCents: number
  pendingCents: number
  /** bereits gutgeschriebenes, noch nicht verrechnetes Stripe-Kundenguthaben (AGB § 16 Abs. 3) */
  customerCreditCents: number
  totalCents: number
  hasPayoutAccount: boolean
  taxProfileComplete: boolean
}

/** Offenes Partner-Guthaben (gleiche Einteilung wie /api/app/v1/affiliate). */
export async function partnerBalance(userId: string, now: Date = new Date()): Promise<PartnerBalance> {
  const [rows, u, tax] = await Promise.all([
    db.select({ amount: affiliateCommissions.commissionAmount, status: affiliateCommissions.status, availableAt: affiliateCommissions.availableAt })
      .from(affiliateCommissions)
      .where(and(eq(affiliateCommissions.referrerId, userId), inArray(affiliateCommissions.status, ['pending', 'available', 'processing']))),
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { stripeConnectId: true, affiliateOnboarded: true, stripeCustomerId: true } }),
    db.query.affiliateTaxProfiles.findFirst({ where: eq(affiliateTaxProfiles.userId, userId) }),
  ])
  let availableCents = 0, pendingCents = 0
  for (const r of rows) {
    if (r.status === 'pending' && r.availableAt.getTime() > now.getTime()) pendingCents += r.amount
    else availableCents += r.amount
  }
  const customerCreditCents = u?.stripeCustomerId ? await customerCredit(u.stripeCustomerId) : 0
  return {
    availableCents,
    pendingCents,
    customerCreditCents,
    totalCents: Math.max(0, availableCents + pendingCents) + customerCreditCents,
    hasPayoutAccount: !!u?.stripeConnectId && !!u?.affiliateOnboarded,
    taxProfileComplete: isTaxProfileComplete(tax ?? null),
  }
}

/** Stripe-Kundenguthaben (frisch); Stripe nicht erreichbar → 0 (nie den Ablauf blockieren). */
async function customerCredit(customerId: string): Promise<number> {
  try {
    assertStripeKeyAllowed()
    return (await getCustomerCreditCents(getStripe(), customerId, { fresh: true })) ?? 0
  } catch {
    return 0
  }
}

async function openRequest(userId: string) {
  return db.query.accountDeletionRequests.findFirst({
    where: and(eq(accountDeletionRequests.userId, userId), eq(accountDeletionRequests.status, 'scheduled')),
  })
}

type PeriodEndUser = {
  stripeSubscriptionId: string | null
  subscriptionStatus: string | null
  currentPeriodEnd: Date | null
  paymentFailedAt: Date | null
}

/**
 * Option „zum Laufzeitende“ nur mit laufendem, bezahltem Abo ohne Zahlungsstörung und mit bekanntem
 * Periodenende in der Zukunft. Der Löschtermin ist das Periodenende, mindestens aber die Bedenkzeit.
 */
export function periodEndOption(u: PeriodEndUser, now: Date = new Date()): { available: boolean; at: Date | null } {
  const active = !!u.stripeSubscriptionId && (u.subscriptionStatus === 'active' || u.subscriptionStatus === 'trialing') && !u.paymentFailedAt
  if (!active || !u.currentPeriodEnd || u.currentPeriodEnd.getTime() <= now.getTime()) return { available: false, at: null }
  const at = new Date(Math.max(u.currentPeriodEnd.getTime(), graceEnd(now).getTime()))
  return { available: true, at }
}

export async function getDeletionStatus(userId: string): Promise<DeletionStatusResponse> {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      isAdmin: true, deletionRequestedAt: true, deletionScheduledFor: true, deletionMode: true, deletedAt: true,
      stripeSubscriptionId: true, subscriptionStatus: true, currentPeriodEnd: true, paymentFailedAt: true,
    },
  })
  if (!u || u.deletedAt) throw new DeletionError('NOT_FOUND')
  const [balance, req, enabled] = await Promise.all([
    partnerBalance(userId), u.deletionRequestedAt ? openRequest(userId) : Promise.resolve(undefined), isSelfDeletionEnabled(),
  ])
  const scheduled = !!u.deletionRequestedAt
  const pe = periodEndOption(u)
  return {
    status: scheduled ? 'scheduled' : 'none',
    requestedAt: u.deletionRequestedAt?.toISOString() ?? null,
    scheduledFor: u.deletionScheduledFor?.toISOString() ?? null,
    mode: scheduled ? (u.deletionMode === 'period_end' ? 'period_end' : 'now') : null,
    graceDays: DELETION_GRACE_DAYS,
    canDelete: !u.isAdmin && enabled,
    blockedReason: u.isAdmin ? 'admin' : enabled ? null : 'disabled',
    periodEnd: { available: pe.available, at: pe.at?.toISOString() ?? null },
    partnerBalance: {
      currency: 'EUR',
      availableCents: balance.availableCents,
      pendingCents: balance.pendingCents,
      customerCreditCents: balance.customerCreditCents,
      totalCents: balance.totalCents,
      hasPayoutAccount: balance.hasPayoutAccount,
      taxProfileComplete: balance.taxProfileComplete,
      choice: req && (req.balanceChoice === 'payout' || req.balanceChoice === 'waive') ? req.balanceChoice : null,
      waiverText: waiverText(balance.totalCents),
    },
  }
}

// ─── Anfrage ─────────────────────────────────────────────────────────────────

async function passwordMatches(userId: string, password: string): Promise<boolean> {
  const rows = await db.select({ password: accounts.password }).from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential'), isNotNull(accounts.password)))
  for (const r of rows) {
    if (r.password && await verifyPassword({ hash: r.password, password }).catch(() => false)) return true
  }
  return false
}

function balanceNoteForRequest(choice: 'none' | BalanceChoice, b: PartnerBalance): string | null {
  if (b.totalCents <= 0) return null
  if (choice === 'waive') {
    return `Du hast auf dein Partner-Guthaben von ${formatEurDe(b.totalCents)} verzichtet. Brichst du die Löschung ab, gilt der Verzicht nicht.`
  }
  const credit = b.customerCreditCents > 0
    ? ` Dein schon gutgeschriebenes Guthaben von ${formatEurDe(b.customerCreditCents)} zahlen wir dir auf Anfrage an info@finestsites.io aus.`
    : ''
  if (b.totalCents - b.customerCreditCents <= 0) return credit.trim()
  return (b.hasPayoutAccount && b.taxProfileComplete
    ? `Dein Partner-Guthaben von ${formatEurDe(b.totalCents - b.customerCreditCents)} überweisen wir nach der Löschung auf dein Auszahlungskonto, auch unter 10 €. Noch nicht verfügbare Provisionen folgen, sobald ihre Haltefrist vorbei ist.`
    : `Für dein Partner-Guthaben von ${formatEurDe(b.totalCents - b.customerCreditCents)} fehlt noch ein Auszahlungskonto oder die Angaben für die Abrechnung. Richte beides bis zur Löschung im Partnerprogramm ein. Sonst zahlen wir das Guthaben auf Anfrage an info@finestsites.io aus (bis zur Verjährung nach 3 Jahren).`) + credit
}

export async function requestDeletion(params: {
  userId: string
  password: string
  timing?: DeletionTiming | null
  balanceChoice?: BalanceChoice | null
  waiverConfirmed?: boolean
  source: 'web' | 'app'
  now?: Date
}): Promise<{ scheduledFor: Date; mode: DeletionTiming; signedOut: boolean }> {
  const now = params.now ?? new Date()
  const u = await db.query.users.findFirst({
    where: eq(users.id, params.userId),
    columns: {
      id: true, email: true, isAdmin: true, deletionRequestedAt: true, deletedAt: true,
      stripeCustomerId: true, stripeSubscriptionId: true, paymentFailedInvoiceId: true, subscriptionStatus: true,
      currentPeriodEnd: true, paymentFailedAt: true,
    },
  })
  if (!u || u.deletedAt) throw new DeletionError('NOT_FOUND')
  if (u.isAdmin) throw new DeletionError('DELETION_NOT_ALLOWED')
  if (!(await isSelfDeletionEnabled())) throw new DeletionError('DELETION_NOT_ALLOWED')
  if (u.deletionRequestedAt) throw new DeletionError('DELETION_ALREADY_REQUESTED')
  if (!(await passwordMatches(u.id, params.password))) throw new DeletionError('INVALID_PASSWORD')

  const balance = await partnerBalance(u.id, now)
  let choice: 'none' | BalanceChoice = 'none'
  if (balance.totalCents > 0) {
    if (params.balanceChoice !== 'payout' && params.balanceChoice !== 'waive') throw new DeletionError('BALANCE_CHOICE_REQUIRED')
    if (params.balanceChoice === 'waive' && params.waiverConfirmed !== true) throw new DeletionError('BALANCE_CHOICE_REQUIRED')
    choice = params.balanceChoice
  }

  const mode: DeletionTiming = params.timing === 'period_end' ? 'period_end' : 'now'
  const pe = periodEndOption(u, now)
  if (mode === 'period_end' && !pe.available) throw new DeletionError('PERIOD_END_NOT_AVAILABLE')
  if (mode === 'period_end') return requestDeletionAtPeriodEnd({ u, now, balance, choice, source: params.source, periodEndAt: pe.at! })

  const scheduledFor = graceEnd(now)

  // 1) Vormerken (eindeutiger Index „eine offene Anfrage je Nutzer“ schützt vor Doppelklick)
  try {
    await db.transaction(async (tx) => {
      const updated = await tx.update(users)
        .set({ deletionRequestedAt: now, deletionScheduledFor: scheduledFor, deletionMode: 'now', updatedAt: now })
        .where(and(eq(users.id, u.id), isNull(users.deletionRequestedAt), isNull(users.deletedAt)))
        .returning({ id: users.id })
      if (updated.length !== 1) throw new DeletionError('DELETION_ALREADY_REQUESTED')
      await tx.insert(accountDeletionRequests).values({
        userId: u.id,
        source: params.source,
        mode: 'now',
        requestedAt: now,
        scheduledFor,
        balanceAvailableCents: balance.availableCents,
        balancePendingCents: balance.pendingCents,
        balanceCustomerCreditCents: balance.customerCreditCents,
        balanceChoice: choice,
        ...(choice === 'waive' ? { waiverText: waiverText(balance.totalCents), waiverAcceptedAt: now } : {}),
      })
    })
  } catch (err) {
    if (err instanceof DeletionError) throw err
    if (String((err as { code?: string })?.code) === '23505') throw new DeletionError('DELETION_ALREADY_REQUESTED')
    throw err
  }

  // 2) Seiten sofort offline
  await takeSitesOffline(u.id, now)

  // 3) Abo sofort beenden (keine Erstattung, keine Schlussrechnung). Webhooks kennen die Anfrage
  //    (deletionRequestedAt) und schicken keine Kündigungs-/Pausiert-Mails.
  const stripeResult = await cancelStripeSubscriptions({
    customerId: u.stripeCustomerId, subscriptionId: u.stripeSubscriptionId, trackedInvoiceId: u.paymentFailedInvoiceId,
  })
  if (stripeResult.ok) {
    await db.update(users).set({
      plan: 'starter',
      subscriptionStatus: u.subscriptionStatus ? 'canceled' : null,
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
      ...recoveryCleared,
    }).where(eq(users.id, u.id))
  } else {
    await notifyAdmin('Kontolöschung: Stripe-Abo konnte nicht beendet werden',
      `Nutzer ${u.id}: ${stripeResult.error ?? 'unbekannter Fehler'}. Bitte im Stripe-Dashboard prüfen und das Abo sofort beenden.`)
  }

  // 4) Überall abmelden, Push-Geräte und offene Mitteilungen weg, Admin-Zugriffe beenden
  await revokeAccess(u.id)

  // 5) Bestätigung (Kategorie system)
  await sendEmail({
    to: u.email,
    subject: `Dein Konto wird am ${formatDateLongDe(scheduledFor)} gelöscht – FinestSites`,
    html: accountDeletionRequestedEmail({ scheduledFor: formatDateLongDe(scheduledFor), balanceNote: balanceNoteForRequest(choice, balance), mode: 'now' }),
    type: 'account_deletion_requested',
    category: 'system',
  }).catch(() => {})

  return { scheduledFor, mode: 'now', signedOut: true }
}

/**
 * Weg „zum Laufzeitende“: Abo bei Stripe zum Periodenende kündigen (keine Erstattung), Seiten und
 * Sitzungen bleiben, Löschtermin = Periodenende (mindestens Bedenkzeit). Schlägt die Stripe-Kündigung
 * fehl, wird NICHT vorgemerkt (der Nutzer bekommt einen Fehler und kann „sofort“ wählen).
 */
async function requestDeletionAtPeriodEnd(p: {
  u: { id: string; email: string; stripeSubscriptionId: string | null }
  now: Date
  balance: PartnerBalance
  choice: 'none' | BalanceChoice
  source: 'web' | 'app'
  periodEndAt: Date
}): Promise<{ scheduledFor: Date; mode: DeletionTiming; signedOut: boolean }> {
  const { u, now, balance, choice } = p
  const stripeResult = await setCancelAtPeriodEnd(u.stripeSubscriptionId, true)
  if (!stripeResult.ok) {
    await notifyAdmin('Kontolöschung zum Laufzeitende: Stripe-Kündigung fehlgeschlagen',
      `Nutzer ${u.id}: ${stripeResult.error ?? 'unbekannter Fehler'}. Die Anfrage wurde nicht vorgemerkt.`)
    throw new DeletionError('PERIOD_END_NOT_AVAILABLE')
  }
  // Stripe kennt das Periodenende am genauesten; nie vor Ablauf der Bedenkzeit
  const scheduledFor = new Date(Math.max((stripeResult.periodEnd ?? p.periodEndAt).getTime(), graceEnd(now).getTime()))

  try {
    await db.transaction(async (tx) => {
      const updated = await tx.update(users)
        .set({ deletionRequestedAt: now, deletionScheduledFor: scheduledFor, deletionMode: 'period_end', cancelAtPeriodEnd: true, updatedAt: now })
        .where(and(eq(users.id, u.id), isNull(users.deletionRequestedAt), isNull(users.deletedAt)))
        .returning({ id: users.id })
      if (updated.length !== 1) throw new DeletionError('DELETION_ALREADY_REQUESTED')
      await tx.insert(accountDeletionRequests).values({
        userId: u.id,
        source: p.source,
        mode: 'period_end',
        requestedAt: now,
        scheduledFor,
        balanceAvailableCents: balance.availableCents,
        balancePendingCents: balance.pendingCents,
        balanceCustomerCreditCents: balance.customerCreditCents,
        balanceChoice: choice,
        ...(choice === 'waive' ? { waiverText: waiverText(balance.totalCents), waiverAcceptedAt: now } : {}),
      })
    })
  } catch (err) {
    // Vormerken fehlgeschlagen → Kündigung bei Stripe wieder zurücknehmen, damit nichts hängen bleibt
    await setCancelAtPeriodEnd(u.stripeSubscriptionId, false)
    if (err instanceof DeletionError) throw err
    if (String((err as { code?: string })?.code) === '23505') throw new DeletionError('DELETION_ALREADY_REQUESTED')
    throw err
  }

  await sendEmail({
    to: u.email,
    subject: `Dein Konto wird am ${formatDateLongDe(scheduledFor)} gelöscht – FinestSites`,
    html: accountDeletionRequestedEmail({ scheduledFor: formatDateLongDe(scheduledFor), balanceNote: balanceNoteForRequest(choice, balance), mode: 'period_end' }),
    type: 'account_deletion_requested',
    category: 'system',
  }).catch(() => {})

  return { scheduledFor, mode: 'period_end', signedOut: false }
}

/** published → deactivated, Offline-Marker in KV, Custom-Domain-Zuordnung entfernen (CF-Hostname bleibt bis zur Löschung). */
async function takeSitesOffline(userId: string, now: Date): Promise<number> {
  const live = await db.query.userSites.findMany({
    where: and(eq(userSites.userId, userId), eq(userSites.status, 'published')),
    columns: { id: true, customDomain: true },
    with: { template: { columns: { domain: true } }, user: { columns: { username: true } } },
  })
  if (live.length === 0) return 0
  await db.update(userSites)
    .set({ status: 'deactivated', deactivatedAt: now })
    .where(inArray(userSites.id, live.map(s => s.id)))
  for (const s of live) {
    if (s.user?.username && s.template?.domain) await effects.siteOffline(s.user.username, s.template.domain)
    if (s.customDomain) await effects.customDomainKvDelete(s.customDomain)
  }
  return live.length
}

async function revokeAccess(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.userId, userId))
    await tx.delete(pushDevices).where(eq(pushDevices.userId, userId))
    await tx.delete(pushOutbox).where(and(eq(pushOutbox.userId, userId), inArray(pushOutbox.status, ['pending', 'processing'])))
    await tx.delete(impersonationRequests).where(eq(impersonationRequests.userId, userId))
  })
}

// ─── Abbrechen ───────────────────────────────────────────────────────────────

export async function cancelDeletion(userId: string, now: Date = new Date()): Promise<{ sitesOffline: boolean; subscriptionContinues: boolean }> {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, deletionRequestedAt: true, deletionMode: true, deletedAt: true, stripeSubscriptionId: true },
  })
  if (!u || u.deletedAt) throw new DeletionError('NOT_FOUND')
  if (!u.deletionRequestedAt) throw new DeletionError('NO_DELETION_PENDING')

  // Weg „zum Laufzeitende“: Kündigung bei Stripe zurücknehmen – das Abo läuft weiter wie vorher.
  // Ist die Laufzeit schon vorbei (Abo bei Stripe beendet), gibt es nichts zurückzunehmen.
  let subscriptionContinues = false
  if (u.deletionMode === 'period_end') {
    const res = await setCancelAtPeriodEnd(u.stripeSubscriptionId, false)
    subscriptionContinues = res.ok
  }

  let offline = 0
  await db.transaction(async (tx) => {
    const updated = await tx.update(users)
      .set({
        deletionRequestedAt: null, deletionScheduledFor: null, deletionMode: null, updatedAt: now,
        ...(subscriptionContinues ? { cancelAtPeriodEnd: false } : {}),
      })
      .where(and(eq(users.id, userId), isNotNull(users.deletionRequestedAt), isNull(users.deletedAt)))
      .returning({ id: users.id })
    if (updated.length !== 1) throw new DeletionError('NO_DELETION_PENDING')
    await tx.update(accountDeletionRequests)
      .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
      .where(and(eq(accountDeletionRequests.userId, userId), eq(accountDeletionRequests.status, 'scheduled')))
    // Offline genommene Seiten bleiben offline: als Entwurf zurück (frisches updatedAt, damit die
    // Entwurfs-Aufräumung sie nicht sofort erfasst); der Nutzer veröffentlicht neu. Beim Weg
    // „zum Laufzeitende“ mit laufendem Abo sind die Seiten noch online – dann passiert hier nichts.
    if (!subscriptionContinues) {
      const rows = await tx.update(userSites)
        .set({ status: 'draft', deactivatedAt: null, scheduledDeletionAt: null, updatedAt: now })
        .where(and(eq(userSites.userId, userId), eq(userSites.status, 'deactivated')))
        .returning({ id: userSites.id })
      offline = rows.length
    }
  })

  await sendEmail({
    to: u.email,
    subject: 'Dein Konto bleibt bestehen – FinestSites',
    html: accountDeletionCancelledEmail({ subscriptionContinues, sitesOffline: offline > 0 }),
    type: 'account_deletion_cancelled',
    category: 'system',
  }).catch(() => {})
  return { sitesOffline: offline > 0, subscriptionContinues }
}

// ─── Ausführen (Cron) ────────────────────────────────────────────────────────

export interface DeletionRunResult {
  deleted: string[]
  skipped: { userId: string; reason: string }[]
  errors: { userId: string; error: string }[]
  settlements: { userId: string; status: string; detail?: string }[]
}

export async function runAccountDeletionCron(now: Date = new Date()): Promise<DeletionRunResult> {
  const result: DeletionRunResult = { deleted: [], skipped: [], errors: [], settlements: [] }
  const due = await db.select({ id: users.id, isAdmin: users.isAdmin, isInternal: users.isInternal })
    .from(users)
    .where(and(isNotNull(users.deletionRequestedAt), isNull(users.deletedAt), lte(users.deletionScheduledFor, now)))
    .limit(50)
  for (const u of due) {
    // Admin-Konten werden nie über diesen Weg gelöscht; interne Konten (Apple-Demo) bleiben stehen,
    // damit eine Löschung im Review das Demokonto nicht zerstört – der Admin bricht sie ab.
    if (u.isAdmin) { result.skipped.push({ userId: u.id, reason: 'admin' }); continue }
    if (u.isInternal) { result.skipped.push({ userId: u.id, reason: 'internal' }); continue }
    try {
      if (await executeDeletion(u.id, now)) result.deleted.push(u.id)
      else result.skipped.push({ userId: u.id, reason: 'not_due' })
    } catch (err) {
      console.error(`[account-deletion] Löschung ${u.id} fehlgeschlagen:`, err)
      result.errors.push({ userId: u.id, error: err instanceof Error ? err.message : String(err) })
    }
  }
  result.settlements = await settleDeletedPartnerBalances(now)
  if (result.errors.length > 0) {
    await notifyAdmin('Kontolöschung: Fehler im Cron', result.errors.map(e => `${e.userId}: ${e.error}`).join('\n'))
  }
  return result
}

/** Führt die Löschung eines fälligen Kontos aus. false = (nicht mehr) fällig. Idempotent. */
export async function executeDeletion(userId: string, now: Date = new Date()): Promise<boolean> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!u || u.deletedAt || !u.deletionRequestedAt || !u.deletionScheduledFor || u.deletionScheduledFor > now) return false
  if (u.isAdmin) return false
  const req = await openRequest(userId)

  // 1) Abo (nochmals, idempotent) beenden
  await cancelStripeSubscriptions({ customerId: u.stripeCustomerId, subscriptionId: u.stripeSubscriptionId, trackedInvoiceId: u.paymentFailedInvoiceId })

  // 2) Externe Dateien und Domains
  const sites = await db.query.userSites.findMany({
    where: eq(userSites.userId, userId),
    columns: { id: true, customDomain: true, cfCustomHostnameId: true, r2PublishedPath: true },
    with: { template: { columns: { domain: true } }, siteImages: { columns: { r2Path: true } } },
  })
  for (const s of sites) {
    if (u.username && s.template?.domain) await effects.siteOffline(u.username, s.template.domain)
    if (s.customDomain) {
      await effects.customDomainKvDelete(s.customDomain)
      if (s.cfCustomHostnameId) await effects.customHostnameDelete(s.cfCustomHostnameId, s.customDomain)
    }
    for (const img of s.siteImages ?? []) if (img.r2Path) await effects.r2Delete(img.r2Path)
    if (s.r2PublishedPath) await effects.r2Delete(s.r2PublishedPath)
  }
  for (const prefix of userR2Prefixes(userId)) await effects.r2DeletePrefix(prefix)
  if (u.username) await effects.purgeUsername(u.username)

  // 3) Partner-Guthaben: Verzicht jetzt wirksam; sonst Schlussabrechnung (nie stiller Verfall)
  const balance = await partnerBalance(userId, now)
  const openCommissions = await db.select({ id: affiliateCommissions.id }).from(affiliateCommissions)
    .where(and(eq(affiliateCommissions.referrerId, userId), inArray(affiliateCommissions.status, ['pending', 'available', 'processing'])))
  const choice = req?.balanceChoice ?? 'none'
  let settlementStatus: 'not_needed' | 'pending' | 'waived' = 'not_needed'
  if (openCommissions.length > 0 || balance.customerCreditCents > 0) settlementStatus = choice === 'waive' ? 'waived' : 'pending'

  // 4) Letzte Mail an die alte Adresse (danach gibt es sie bei uns nicht mehr)
  const tomb = tombstoneEmail(userId)
  const balanceNote = settlementStatus === 'pending' && balance.totalCents > 0
    ? (balance.hasPayoutAccount && balance.taxProfileComplete
      ? `Dein Partner-Guthaben von ${formatEurDe(balance.totalCents)} überweisen wir auf dein Auszahlungskonto, sobald es verfügbar ist.`
      : `Dein Partner-Guthaben von ${formatEurDe(balance.totalCents)} zahlen wir dir auf Anfrage an info@finestsites.io aus, bis zur Verjährung nach 3 Jahren. Dafür brauchen wir dann deine Bankverbindung und die Angaben für die Abrechnung.`)
    : null
  const hadPartnerRecords = (await db.select({ n: sql<number>`count(*)::int` }).from(affiliatePayouts).where(eq(affiliatePayouts.referrerId, userId)))[0]?.n ?? 0
  await sendEmail({
    to: u.email,
    logTo: tomb,
    subject: 'Dein Konto ist gelöscht – FinestSites',
    html: accountDeletionCompletedEmail({
      keptNote: hadPartnerRecords > 0 || openCommissions.length > 0
        ? 'Aufbewahren müssen wir nur, was das Gesetz verlangt: Gutschriften und Provisionsbuchungen aus dem Partnerprogramm (8 bzw. 10 Jahre). Rechnungen für dein Abo bewahrt unser Zahlungsdienstleister Stripe auf.'
        : 'Aufbewahren müssen wir nur, was das Gesetz verlangt: Rechnungen für dein Abo bewahrt unser Zahlungsdienstleister Stripe auf.',
      balanceNote,
    }),
    type: 'account_deletion_completed',
    category: 'system',
  }).catch(() => {})

  // 5) Datenbank in einer Transaktion
  const siteIds = sites.map(s => s.id)
  const keepTaxProfile = settlementStatus === 'pending'
  await db.transaction(async (tx) => {
    // Seiten (CASCADE: site_data, site_images, form_submissions); Statistik-Ereignisse ohne FK anonymisieren
    if (siteIds.length > 0) {
      await tx.execute(sql`
        UPDATE site_events SET host = 'deleted.invalid', path = '/', visitor_hash = NULL, referrer_host = NULL,
               utm_source = NULL, utm_medium = NULL, utm_campaign = NULL, meta = NULL
        WHERE site_id IN (${sql.join(siteIds.map(id => sql`${id}::uuid`), sql`, `)})`)
      await tx.delete(siteImages).where(inArray(siteImages.userSiteId, siteIds))
      await tx.delete(userSites).where(inArray(userSites.id, siteIds))
    }
    // Support (CASCADE: support_messages, support_ai_suggestions)
    await tx.delete(supportConversations).where(eq(supportConversations.userId, userId))
    await tx.delete(impersonationRequests).where(or(eq(impersonationRequests.userId, userId), eq(impersonationRequests.adminId, userId)))
    await tx.delete(userNotifications).where(eq(userNotifications.userId, userId))
    await tx.delete(pushOutbox).where(eq(pushOutbox.userId, userId))
    await tx.delete(pushDevices).where(eq(pushDevices.userId, userId))
    await tx.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId))
    await tx.delete(trackingConfigs).where(eq(trackingConfigs.userId, userId))
    await tx.delete(templateAccess).where(eq(templateAccess.userId, userId))
    await tx.update(templateAccess).set({ grantedBy: null }).where(eq(templateAccess.grantedBy, userId))
    await tx.update(appSettings).set({ updatedBy: null }).where(eq(appSettings.updatedBy, userId))
    await tx.update(supportAiSuggestions).set({ adminId: null }).where(eq(supportAiSuggestions.adminId, userId))
    // Anmeldung
    await tx.delete(sessions).where(eq(sessions.userId, userId))
    await tx.delete(accounts).where(eq(accounts.userId, userId))
    await tx.delete(verifications).where(or(eq(verifications.identifier, u.email), eq(verifications.value, userId)))
    // Empfehlungs-Klicks: eigene Klickstatistik als Partner weg; fremde Statistik behält die Zählung
    if (u.username) await tx.delete(affiliateClicks).where(eq(affiliateClicks.referrerUsername, u.username))
    await tx.update(affiliateClicks).set({ convertedUserId: null }).where(eq(affiliateClicks.convertedUserId, userId))
    // Abo-Verlauf: Buchungsbezug bleibt (Beträge, Stripe-IDs), Zusatzangaben (z. B. Kartenendziffern) weg
    await tx.update(subscriptionEvents).set({ metadata: {} }).where(eq(subscriptionEvents.userId, userId))
    // Partner-Buchungen bleiben (Aufbewahrungspflicht), Frist eintragen
    await tx.execute(sql`
      UPDATE affiliate_commissions
         SET retention_until = GREATEST(COALESCE(retention_until, DATE '1970-01-01'),
               make_date(EXTRACT(YEAR FROM (created_at AT TIME ZONE 'Europe/Berlin'))::int + ${RETENTION_YEARS_BOOKINGS}, 12, 31))
       WHERE referrer_id = ${userId}::uuid OR referee_id = ${userId}::uuid`)
    await tx.execute(sql`
      UPDATE affiliate_payouts
         SET retention_until = GREATEST(COALESCE(retention_until, DATE '1970-01-01'),
               make_date(EXTRACT(YEAR FROM COALESCE(credit_note_date::timestamptz, created_at) AT TIME ZONE 'Europe/Berlin')::int + ${RETENTION_YEARS_BOOKINGS}, 12, 31))
       WHERE referrer_id = ${userId}::uuid`)
    if (settlementStatus === 'waived') {
      await tx.update(affiliateCommissions)
        .set({ status: 'waived', reversalReason: 'waived_on_account_deletion', updatedAt: now })
        .where(and(eq(affiliateCommissions.referrerId, userId), inArray(affiliateCommissions.status, ['pending', 'available'])))
    }
    if (!keepTaxProfile) await tx.delete(affiliateTaxProfiles).where(eq(affiliateTaxProfiles.userId, userId))
    // Mail-Protokoll mit der alten Adresse; Rundmail-Listen bereinigen; Warteliste
    await tx.delete(emailLogs).where(eq(emailLogs.to, u.email))
    await tx.execute(sql`
      UPDATE newsletter_sends
         SET specific_emails = (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(specific_emails) e
                                 WHERE e <> to_jsonb(${u.email}::text))
       WHERE jsonb_typeof(specific_emails) = 'array' AND specific_emails @> to_jsonb(ARRAY[${u.email}::text])`)
    await tx.execute(sql`
      UPDATE waitlist_broadcasts
         SET recipients = (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(recipients) e
                            WHERE e <> to_jsonb(${u.email}::text) AND (jsonb_typeof(e) <> 'object' OR e->>'email' IS DISTINCT FROM ${u.email}::text))
       WHERE jsonb_typeof(recipients) = 'array' AND recipients::text LIKE ${'%' + u.email.replace(/[%_\\]/g, '\\$&') + '%'}`)
    await tx.execute(sql`DELETE FROM waitlist WHERE lower(email) = lower(${u.email})`)

    // Grabstein: nur id, Benutzername (reserviert), Stripe-Kundennummer (Zuordnung später eintreffender
    // Erstattungen/Rückbuchungen zu aufbewahrten Buchungen) und Zeitstempel bleiben
    await tx.update(users).set({
      email: tomb,
      name: '',
      emailVerified: false,
      image: null,
      firstName: null, lastName: null, companyName: null, phone: null, websiteUrl: null,
      instagram: null, facebook: null, linkedin: null, tiktok: null, youtube: null, profileImageUrl: null,
      brandColor: null, teamPartnerNumber: null, referredByUsername: null, referralTerms: null, referralDiscountFlag: null,
      paymentFingerprints: [],
      emailOptOut: ['updates', 'tips', 'offers'], emailOptOutUpdatedAt: now,
      affiliatePayoutEmail: null,
      // Auszahlungskonto bleibt nur, solange die Schlussabrechnung läuft
      ...(keepTaxProfile ? {} : { stripeConnectId: null, affiliateOnboarded: false }),
      contentConsentIp: null, contentConsentUa: null,
      plan: 'starter', subscriptionStatus: null, stripeSubscriptionId: null, cancelAtPeriodEnd: false,
      currentPeriodEnd: null, paymentFallbackSepa: false,
      ...recoveryCleared,
      isAdmin: false,
      deactivatedAt: u.deactivatedAt ?? now,
      deletedAt: now,
      updatedAt: now,
    }).where(eq(users.id, userId))

    await tx.update(accountDeletionRequests).set({
      status: 'completed',
      completedAt: now,
      settlementStatus,
      balanceCustomerCreditCents: balance.customerCreditCents,
      ...(settlementStatus === 'waived' ? { settledAt: now } : {}),
      contactEmail: settlementStatus === 'pending' ? u.email : null,
      updatedAt: now,
    }).where(and(eq(accountDeletionRequests.userId, userId), eq(accountDeletionRequests.status, 'scheduled')))
  })

  console.log(`[account-deletion] Konto ${userId} gelöscht (Seiten ${siteIds.length}, Abrechnung ${settlementStatus})`)
  return true
}

// ─── Schlussabrechnung gelöschter Partner ────────────────────────────────────

export async function settleDeletedPartnerBalances(now: Date = new Date()): Promise<DeletionRunResult['settlements']> {
  const out: DeletionRunResult['settlements'] = []
  const open = await db.select().from(accountDeletionRequests)
    .where(and(eq(accountDeletionRequests.status, 'completed'), inArray(accountDeletionRequests.settlementStatus, ['pending', 'payable_on_request'])))
    .limit(100)
  for (const r of open) {
    try {
      if (r.settlementStatus === 'payable_on_request') {
        if (r.limitationUntil && r.limitationUntil < now.toISOString().slice(0, 10)) {
          await finishSettlement(r.id, r.userId, 'time_barred', now)
          out.push({ userId: r.userId, status: 'time_barred' })
        }
        continue
      }
      await releaseMaturedCommissions(r.userId)
      const rows = await db.select({ amount: affiliateCommissions.commissionAmount, status: affiliateCommissions.status, availableAt: affiliateCommissions.availableAt })
        .from(affiliateCommissions)
        .where(and(eq(affiliateCommissions.referrerId, r.userId), inArray(affiliateCommissions.status, ['pending', 'available', 'processing'])))
      const available = rows.filter(x => x.status === 'available').reduce((s, x) => s + x.amount, 0)
      const waiting = rows.some(x => x.status === 'pending' || x.status === 'processing')

      if (rows.length === 0) {
        out.push({ userId: r.userId, status: await settleOrPayableOnRequest(r, 0, now) })
        continue
      }
      if (available > 0) {
        const u = await db.query.users.findFirst({
          where: eq(users.id, r.userId),
          columns: { id: true, email: true, username: true, stripeConnectId: true, affiliateOnboarded: true },
        })
        if (u?.stripeConnectId) {
          assertStripeKeyAllowed()
          const res = await processFinalPayout(getStripe(), u)
          out.push({ userId: r.userId, status: `payout_${res.status}`, detail: res.creditNoteNumber ?? res.reason })
          if (res.status !== 'paid') await notifyAdminSingle(res).catch(() => {})
          else await notifyAdmin('Kontolöschung: Schlussauszahlung erfolgt',
            `Gelöschtes Konto ${r.userId}: ${formatEurDe(res.amount ?? 0)} überwiesen, Gutschrift ${res.creditNoteNumber ?? '–'}. ` +
            `Bitte die Gutschrift an ${r.contactEmail ?? '(keine Adresse)'} übermitteln.`)
          continue
        }
        if (!waiting) {
          // Kein Auszahlungskonto: Guthaben bleibt auf Anfrage auszahlbar bis zur Verjährung
          out.push({ userId: r.userId, status: await settleOrPayableOnRequest(r, available, now) })
          continue
        }
      } else if (!waiting) {
        // Nur negative/ausgeglichene Provisionszeilen übrig → höchstens noch Kundenguthaben offen
        out.push({ userId: r.userId, status: await settleOrPayableOnRequest(r, 0, now) })
        continue
      }
      out.push({ userId: r.userId, status: 'waiting' })
    } catch (err) {
      out.push({ userId: r.userId, status: 'error', detail: err instanceof Error ? err.message : String(err) })
    }
  }
  return out
}

/**
 * Nichts mehr automatisch auszuzahlen: offene Provisionen (ohne Auszahlungskonto) und/oder
 * Kundenguthaben → „auf Anfrage auszahlbar“ bis zur Verjährung (Admin wird informiert); sonst erledigt.
 */
async function settleOrPayableOnRequest(
  r: typeof accountDeletionRequests.$inferSelect,
  openCommissionCents: number,
  now: Date,
): Promise<'settled' | 'payable_on_request'> {
  const open = Math.max(0, openCommissionCents) + Math.max(0, r.balanceCustomerCreditCents)
  if (open <= 0) {
    await finishSettlement(r.id, r.userId, 'settled', now)
    return 'settled'
  }
  const until = endOfYearPlus(now, LIMITATION_YEARS)
  await db.update(accountDeletionRequests).set({ settlementStatus: 'payable_on_request', limitationUntil: until, updatedAt: now })
    .where(eq(accountDeletionRequests.id, r.id))
  await notifyAdmin('Kontolöschung: Guthaben auf Anfrage auszahlbar',
    `Gelöschtes Konto ${r.userId}: ${formatEurDe(open)} offen` +
    (r.balanceCustomerCreditCents > 0 ? ` (davon ${formatEurDe(r.balanceCustomerCreditCents)} Kundenguthaben bei Stripe)` : '') +
    `, keine automatische Auszahlung möglich. Auszahlbar auf Anfrage bis ${until} (Kontakt: ${r.contactEmail ?? '–'}).`)
  return 'payable_on_request'
}

/** Abrechnung erledigt: Steuerprofil (Angaben stecken als Schnappschuss in den Gutschriften), Auszahlungskonto und Kontaktadresse entfernen. */
async function finishSettlement(requestId: string, userId: string, status: 'settled' | 'time_barred', now: Date) {
  await db.transaction(async (tx) => {
    await tx.delete(affiliateTaxProfiles).where(eq(affiliateTaxProfiles.userId, userId))
    await tx.update(users).set({ stripeConnectId: null, affiliateOnboarded: false, updatedAt: now })
      .where(and(eq(users.id, userId), isNotNull(users.deletedAt)))
    await tx.update(accountDeletionRequests)
      .set({ settlementStatus: status, settledAt: now, contactEmail: null, updatedAt: now })
      .where(eq(accountDeletionRequests.id, requestId))
  })
}

async function notifyAdmin(subject: string, text: string): Promise<void> {
  await sendEmail({ to: ADMIN_EMAIL, subject, html: accountDeletionAdminEmail({ title: subject, text }), type: 'account_deletion_admin', category: 'system' }).catch(() => {})
}
