/**
 * Payment recovery — what happens between "a payment failed" and "the
 * account is deactivated".
 *
 * Rules (decided 07.10.2026, see docs/billing-lifecycle.html):
 *
 *  - The clock starts when WE learn about the failure (paymentFailedAt), not
 *    when Stripe submitted the debit. For SEPA that is ~1 week after checkout.
 *  - Sites stay online for GRACE_DAYS after the first failure.
 *  - While a new payment attempt is still being processed (SEPA: 1–2 weeks)
 *    the sites stay online — paymentRetryProcessingAt marks that.
 *  - One second chance: if that in-flight attempt fails too, the grace ends
 *    immediately. Card Smart Retries failing in the background do NOT shorten
 *    the grace — the customer never saw them.
 *  - Hard deadline: HARD_DEADLINE_DAYS after the first failure the sites go
 *    offline no matter what, the account is deactivated and the Stripe
 *    subscription cancelled (billing cron).
 *  - Fallback payment: when the default method fails and the customer has a
 *    card on file, we charge the open invoice to that card right away
 *    (seconds, no offline moment, no second SEPA fee). Card → SEPA fallback
 *    only when the customer opted in (paymentFallbackSepa).
 *
 * Our own DB state is authoritative for "in arrears". Stripe's subscription
 * status is NOT: for delayed-notification methods Stripe may keep a
 * subscription `active` although its first invoice never got paid.
 */

import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

export const GRACE_DAYS = 7
export const REMINDER_AFTER_DAYS = 3
export const HARD_DEADLINE_DAYS = 21

/** 19% MwSt., inclusive, DE — the tax rate every subscription invoice carries. */
export const MWST_TAX_RATE = 'txr_1TtjFpGWVCygqvfcuF1utKUc'

const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

export function hardDeadlineFor(paymentFailedAt: Date): Date {
  return addDays(paymentFailedAt, HARD_DEADLINE_DAYS)
}

// ─── Offline decision ─────────────────────────────────────────────────────────

export type RecoveryState = {
  subscriptionStatus: string | null | undefined
  paymentFailedAt: Date | null | undefined
  paymentGraceUntil: Date | null | undefined
  paymentRetryProcessingAt: Date | null | undefined
}

/**
 * The ONE rule that decides whether a user's sites must be offline for
 * billing reasons. Pure — unit-tested in scripts/test-payment-recovery.ts.
 *
 *   no failure recorded          → online (a SEPA payment merely processing
 *                                  is not a failure; Stripe says past_due then)
 *   hard deadline passed         → offline
 *   new attempt being processed  → online
 *   inside the grace period      → online
 *   otherwise                    → offline
 */
export function shouldBeOffline(u: RecoveryState, now: Date = new Date()): boolean {
  if (u.subscriptionStatus === 'unpaid') return true
  if (!u.paymentFailedAt) return false
  if (now.getTime() >= hardDeadlineFor(u.paymentFailedAt).getTime()) return true
  if (u.paymentRetryProcessingAt) return false
  if (u.paymentGraceUntil && now.getTime() < u.paymentGraceUntil.getTime()) return false
  return true
}

/** Columns every caller needs to evaluate shouldBeOffline(). */
export const recoveryColumns = {
  subscriptionStatus: true,
  paymentFailedAt: true,
  paymentGraceUntil: true,
  paymentRetryProcessingAt: true,
} as const

// ─── Recording failures / success ─────────────────────────────────────────────

export type FailureRecord =
  | { kind: 'first'; graceUntil: Date }
  | { kind: 'second_strike' }
  | { kind: 'repeat' }

/**
 * Record a failed invoice payment for the user. Idempotent.
 *
 *  first         — starts the episode: grace period, tracked invoice
 *  second_strike — the attempt we were waiting for (paymentRetryProcessingAt)
 *                  failed → grace ends now
 *  repeat        — a background retry failed; nothing changes
 */
export async function recordPaymentFailure(userId: string, invoiceId: string, now: Date = new Date()): Promise<FailureRecord> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { paymentFailedAt: true, paymentRetryProcessingAt: true, paymentFailedInvoiceId: true },
  })
  if (!user) return { kind: 'repeat' }

  if (!user.paymentFailedAt) {
    const graceUntil = addDays(now, GRACE_DAYS)
    await db.update(users).set({
      subscriptionStatus: 'past_due',
      paymentFailedAt: now,
      paymentFailedInvoiceId: invoiceId,
      paymentGraceUntil: graceUntil,
      paymentRetryProcessingAt: null,
      paymentNoticeSentAt: null,
      paymentReminderSentAt: null,
      paymentOfflineNotifiedAt: null,
    }).where(eq(users.id, userId))
    return { kind: 'first', graceUntil }
  }

  if (user.paymentRetryProcessingAt) {
    await db.update(users).set({
      subscriptionStatus: 'past_due',
      paymentRetryProcessingAt: null,
      paymentGraceUntil: now,
      // A replacement invoice may have taken over — always track the latest one
      paymentFailedInvoiceId: invoiceId,
      // The customer must hear that the second attempt failed too
      paymentOfflineNotifiedAt: null,
    }).where(eq(users.id, userId))
    return { kind: 'second_strike' }
  }

  await db.update(users).set({ subscriptionStatus: 'past_due' }).where(eq(users.id, userId))
  return { kind: 'repeat' }
}

/** A new attempt for the tracked invoice is in flight (SEPA) → sites stay/come online. */
export async function markRetryProcessing(userId: string, now: Date = new Date()): Promise<void> {
  await db.update(users).set({ paymentRetryProcessingAt: now }).where(eq(users.id, userId))
}

/** Every recovery column reset — spread into any users update that ends an episode. */
export const recoveryCleared = {
  paymentFailedAt: null,
  paymentFailedInvoiceId: null,
  paymentGraceUntil: null,
  paymentRetryProcessingAt: null,
  paymentNoticeSentAt: null,
  paymentReminderSentAt: null,
  paymentOfflineNotifiedAt: null,
} as const

/** Ends the arrears episode. Does NOT touch subscriptionStatus — the caller knows it. */
export async function clearPaymentFailure(userId: string): Promise<void> {
  await db.update(users).set(recoveryCleared).where(eq(users.id, userId))
}

/** Point the episode at a replacement invoice (the original was voided unpaid). */
export async function retrackInvoice(userId: string, invoiceId: string): Promise<void> {
  await db.update(users).set({ paymentFailedInvoiceId: invoiceId }).where(eq(users.id, userId))
}

export type TrackedInvoiceInfo = { payUrl: string | null; amountCents: number; status: string | null }

/** Pay link + amount of the invoice behind the arrears, for mails and the settings page. */
export async function trackedInvoiceInfo(invoiceId: string | null): Promise<TrackedInvoiceInfo> {
  if (!invoiceId) return { payUrl: null, amountCents: 0, status: null }
  try {
    const inv = await getStripe().invoices.retrieve(invoiceId)
    return {
      payUrl: inv.status === 'open' ? (inv.hosted_invoice_url ?? null) : null,
      amountCents: inv.amount_due ?? 0,
      status: inv.status ?? null,
    }
  } catch {
    return { payUrl: null, amountCents: 0, status: null }
  }
}

/**
 * Whether a paid invoice settles the user's arrears: it is the tracked
 * invoice itself, or the tracked invoice is no longer open (paid elsewhere).
 * A tracked invoice that is merely void does NOT settle anything — nobody paid.
 */
export async function paidInvoiceSettlesArrears(trackedInvoiceId: string | null, paidInvoiceId: string): Promise<boolean> {
  if (!trackedInvoiceId) return true
  if (trackedInvoiceId === paidInvoiceId) return true
  try {
    const tracked = await getStripe().invoices.retrieve(trackedInvoiceId)
    return tracked.status === 'paid'
  } catch {
    // Invoice gone — nothing left to collect
    return true
  }
}

// ─── Payment methods ──────────────────────────────────────────────────────────

export type PaymentMethodSummary = {
  id: string
  type: 'card' | 'sepa_debit'
  label: string
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  expired: boolean
  isDefault: boolean
  created: number
}

function isCardExpired(card: Stripe.PaymentMethod.Card, now: Date): boolean {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  return card.exp_year < y || (card.exp_year === y && card.exp_month < m)
}

function summarize(pm: Stripe.PaymentMethod, defaultId: string | null, now: Date): PaymentMethodSummary | null {
  if (pm.type === 'card' && pm.card) {
    const brand = pm.card.brand ? pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1) : 'Karte'
    return {
      id: pm.id, type: 'card',
      label: `${brand} •••• ${pm.card.last4}`,
      brand, last4: pm.card.last4,
      expMonth: pm.card.exp_month, expYear: pm.card.exp_year,
      expired: isCardExpired(pm.card, now),
      isDefault: pm.id === defaultId,
      created: pm.created,
    }
  }
  if (pm.type === 'sepa_debit' && pm.sepa_debit) {
    return {
      id: pm.id, type: 'sepa_debit',
      label: `SEPA-Lastschrift •••• ${pm.sepa_debit.last4}`,
      brand: pm.sepa_debit.bank_code ?? null, last4: pm.sepa_debit.last4 ?? null,
      expMonth: null, expYear: null, expired: false,
      isDefault: pm.id === defaultId,
      created: pm.created,
    }
  }
  return null
}

/**
 * Which payment method Stripe charges next: the subscription's default, else
 * the customer's invoice default. Mirrors Stripe's own retry priority.
 */
export async function resolveDefaultPaymentMethodId(customerId: string, subscriptionId: string | null): Promise<string | null> {
  const stripe = getStripe()
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      const pm = sub.default_payment_method
      if (pm) return typeof pm === 'string' ? pm : pm.id
    } catch { /* fall through to the customer default */ }
  }
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null
  const pm = customer.invoice_settings?.default_payment_method
  return pm ? (typeof pm === 'string' ? pm : pm.id) : null
}

export async function listPaymentMethods(customerId: string, subscriptionId: string | null, now: Date = new Date()): Promise<PaymentMethodSummary[]> {
  const stripe = getStripe()
  const [cards, sepa, defaultId] = await Promise.all([
    stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 20 }),
    stripe.paymentMethods.list({ customer: customerId, type: 'sepa_debit', limit: 20 }),
    resolveDefaultPaymentMethodId(customerId, subscriptionId),
  ])
  return [...cards.data, ...sepa.data]
    .map(pm => summarize(pm, defaultId, now))
    .filter((pm): pm is PaymentMethodSummary => pm !== null)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.created - a.created)
}

/**
 * Make `pmId` the method Stripe charges for this customer — on the
 * subscription AND the customer, so retries, upgrades and the next renewal
 * all agree. Throws if the method does not belong to the customer.
 */
export async function setDefaultPaymentMethod(customerId: string, subscriptionId: string | null, pmId: string): Promise<void> {
  const stripe = getStripe()
  const pm = await stripe.paymentMethods.retrieve(pmId)
  const owner = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id
  if (owner !== customerId) throw new Error('Zahlungsmethode gehört nicht zu diesem Kunden.')

  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pmId } })
  if (subscriptionId) {
    await stripe.subscriptions.update(subscriptionId, { default_payment_method: pmId })
  }
}

/**
 * Pick the fallback method for a failed payment: another card first
 * (instant), SEPA only when the customer opted in. Never the method that
 * just failed, never an expired card. Pure — unit-tested.
 */
export function pickFallbackPaymentMethod(
  methods: PaymentMethodSummary[],
  failedPmId: string | null,
  allowSepa: boolean,
): PaymentMethodSummary | null {
  const usable = methods.filter(m => m.id !== failedPmId && !m.expired)
  const card = usable.filter(m => m.type === 'card').sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.created - a.created)[0]
  if (card) return card
  if (!allowSepa) return null
  return usable.filter(m => m.type === 'sepa_debit').sort((a, b) => b.created - a.created)[0] ?? null
}

/** The payment method that failed on this invoice (from its PaymentIntent). */
export async function failedPaymentMethodOf(invoice: Stripe.Invoice): Promise<{ id: string | null; type: string | null }> {
  const piRef = (invoice as any).payment_intent
  const piId = typeof piRef === 'string' ? piRef : piRef?.id ?? null
  if (!piId) return { id: null, type: null }
  try {
    const pi = await getStripe().paymentIntents.retrieve(piId, { expand: ['payment_method'] })
    const pm = (pi.last_payment_error?.payment_method ?? pi.payment_method) as Stripe.PaymentMethod | string | null
    if (!pm) return { id: null, type: null }
    return typeof pm === 'string' ? { id: pm, type: null } : { id: pm.id, type: pm.type }
  } catch {
    return { id: null, type: null }
  }
}

// ─── Fallback payment ─────────────────────────────────────────────────────────

export type FallbackResult =
  | { outcome: 'paid'; method: PaymentMethodSummary }
  | { outcome: 'processing'; method: PaymentMethodSummary }
  | { outcome: 'failed'; method: PaymentMethodSummary; error: string }
  | { outcome: 'none'; reason: 'no_method' | 'already_attempted' | 'invoice_not_open' }

/**
 * Charge an open invoice to the customer's fallback method. Exactly one
 * attempt per invoice (invoice metadata `fs_fallback_pm` is the lock, so a
 * redelivered webhook cannot charge twice).
 */
export async function attemptFallbackPayment(params: {
  customerId: string
  subscriptionId: string | null
  invoice: Stripe.Invoice
  allowSepa: boolean
}): Promise<FallbackResult> {
  const stripe = getStripe()
  const invoice = await stripe.invoices.retrieve(params.invoice.id)
  if (invoice.status !== 'open') return { outcome: 'none', reason: 'invoice_not_open' }
  if (invoice.metadata?.fs_fallback_pm) return { outcome: 'none', reason: 'already_attempted' }

  const failed = await failedPaymentMethodOf(invoice)
  const methods = await listPaymentMethods(params.customerId, params.subscriptionId)
  const method = pickFallbackPaymentMethod(methods, failed.id, params.allowSepa)
  if (!method) return { outcome: 'none', reason: 'no_method' }

  // Lock first — if the pay call below times out, the retry of this webhook
  // must not charge a second time.
  await stripe.invoices.update(invoice.id, {
    metadata: { ...(invoice.metadata ?? {}), fs_fallback_pm: method.id, fs_fallback_at: new Date().toISOString() },
  })

  try {
    const paid = await stripe.invoices.pay(invoice.id, { payment_method: method.id })
    if (paid.status === 'paid') return { outcome: 'paid', method }
    // SEPA: Stripe accepted the debit, confirmation follows in ~6 business days
    return { outcome: 'processing', method }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { outcome: 'failed', method, error: message }
  }
}

// ─── Replacement invoice (Stripe voided the first SEPA invoice) ───────────────

/**
 * Stripe may void a subscription's very first invoice when its delayed
 * (SEPA) payment fails, while leaving the subscription active. The customer
 * then has nothing to pay against. This creates a payable replacement for
 * the same amount, linked to the subscription, that we collect ourselves
 * (auto_advance off — Stripe must not debit SEPA behind our back).
 */
export async function createReplacementInvoice(params: {
  customerId: string
  subscriptionId: string | null
  voided: Stripe.Invoice
}): Promise<Stripe.Invoice | null> {
  const stripe = getStripe()
  const amount = params.voided.amount_due
  if (!amount || amount <= 0) return null

  await stripe.invoiceItems.create({
    customer: params.customerId,
    amount,
    currency: params.voided.currency ?? 'eur',
    description: `Ersatz für Rechnung ${params.voided.number ?? params.voided.id} (Zahlung fehlgeschlagen)`,
    tax_rates: [MWST_TAX_RATE],
    ...(params.subscriptionId ? { subscription: params.subscriptionId } : {}),
    metadata: { fs_replaces_invoice: params.voided.id },
  })
  const draft = await stripe.invoices.create({
    customer: params.customerId,
    ...(params.subscriptionId ? { subscription: params.subscriptionId } : {}),
    collection_method: 'charge_automatically',
    auto_advance: false,
    pending_invoice_items_behavior: 'include',
    metadata: { fs_replaces_invoice: params.voided.id },
  })
  return stripe.invoices.finalizeInvoice(draft.id, { auto_advance: false })
}

// ─── Hard deadline ────────────────────────────────────────────────────────────

/**
 * Day 21: stop collecting. Voids the open invoice (so a late payment cannot
 * resurrect a cancelled account through the back door — the customer books
 * again via checkout) and cancels the Stripe subscription. The resulting
 * customer.subscription.deleted webhook sets the 90-day deletion timer.
 */
export async function cancelForNonPayment(params: {
  subscriptionId: string | null
  trackedInvoiceId: string | null
}): Promise<{ invoiceVoided: boolean; subscriptionCancelled: boolean }> {
  const stripe = getStripe()
  const result = { invoiceVoided: false, subscriptionCancelled: false }

  if (params.trackedInvoiceId) {
    try {
      const inv = await stripe.invoices.retrieve(params.trackedInvoiceId)
      if (inv.status === 'open') {
        await stripe.invoices.voidInvoice(inv.id)
        result.invoiceVoided = true
      }
    } catch (err) {
      console.error('[payment-recovery] void invoice failed:', err instanceof Error ? err.message : err)
    }
  }

  if (params.subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(params.subscriptionId)
      if (sub.status !== 'canceled') {
        await stripe.subscriptions.cancel(params.subscriptionId, { invoice_now: false, prorate: false })
        result.subscriptionCancelled = true
      }
    } catch (err) {
      console.error('[payment-recovery] cancel subscription failed:', err instanceof Error ? err.message : err)
    }
  }
  return result
}

// ─── Formatting helpers shared by mails and APIs ──────────────────────────────

export function formatDateDe(date: Date): string {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatEur(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}
