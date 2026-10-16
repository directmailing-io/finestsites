/**
 * Shared affiliate payout engine — single source of truth for the payout rules.
 * Used by the monthly cron, the admin trigger and the self-service payout route.
 *
 * Rules (Spec):
 *  - Minimum payout: 10 € (1000 cents) NET. Below that the balance carries over.
 *  - Max ONE payout per affiliate per calendar month (Europe/Berlin).
 *  - Payout only if the Stripe Connect account is verified AND payouts_enabled
 *    (live check against Stripe, not just our DB flag).
 *  - Payout only with a complete tax profile + consent to self-billing
 *    (affiliate_tax_profiles), otherwise skipped with reason `tax_profile_missing`.
 *  - Negative bookings (chargebacks after payout) offset the balance BEFORE VAT.
 *    No payout while the balance is negative or below the minimum.
 *  - regelbesteuert: transfer = net + 19 % USt; kleinunternehmer: transfer = net.
 *  - Platform balance (EUR available) must cover the transfer, otherwise skipped with
 *    reason `insufficient_platform_balance` (the owner may pay out the balance manually).
 *  - Every paid payout gets a gapless credit note number GS-YYYY-NNNNN and a PDF
 *    (Gutschrift) in R2 under a private key. PDF failures never undo a payout; they are
 *    retried by the cron (`credit_note_status = 'pending'`).
 *  - All amounts are integer cents.
 *
 * Concurrency / money safety:
 *  1. Transaction A (advisory lock per referrer + SELECT … FOR UPDATE on the commissions):
 *     re-check monthly limit, compute amounts, insert payout row `processing`, mark the
 *     commissions `processing` with payout_id. → nobody else can pick them up.
 *  2. Stripe transfer with idempotency key `payout-{payoutId}` and transfer_group `payout-{payoutId}`.
 *  3. Transaction B: assign credit note number (counter row, same transaction), payout `paid`,
 *     commissions `paid`.
 *  - Definitive Stripe error → payout `failed`, commissions back to `available`.
 *  - Unclear outcome (network/5xx) or crash between 2 and 3 → payout stays `processing`;
 *    `reconcileStuckPayouts` looks the transfer up by transfer_group and finalizes or fails it.
 *    Nothing is ever re-transferred automatically without that check.
 *
 * Verrechnung mit dem eigenen Abo (users.affiliate_payout_mode = 'credit', Standard seit 16.10.2026):
 *  - Gleicher Ablauf (Sperren, Monatslimit, Steuerprofil, Gutschrift-Nummer beim „paid“),
 *    aber statt Transfer eine Stripe customer balance transaction auf den EIGENEN Stripe-Kunden
 *    des Partners: amount = −Brutto (regelbesteuert: netto + 19 % USt; Kleinunternehmer: netto),
 *    idempotency key `credit-{payoutId}`, metadata.payout_id. Es fließt kein Geld ab →
 *    keine Prüfung des Plattform-Guthabens, Mindestbetrag nur 1 €.
 *  - Voraussetzung: aktives Abo (active/trialing, nicht zum Laufzeitende gekündigt) + stripe_customer_id.
 *    Ohne Abo: mit eingerichtetem Connect-Konto greifen die Überweisungsregeln (ab 10 €), sonst
 *    bleibt das Guthaben stehen (`skipped_no_subscription`, Admin-Hinweis).
 *  - Unklares Ergebnis → `processing`; der Abgleich sucht die Buchung über metadata.payout_id in
 *    den Kundenguthaben-Buchungen. Nie doppelt gutschreiben.
 */

import type Stripe from 'stripe'
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { affiliateCommissions, affiliatePayouts, affiliateTaxProfiles, users } from '@/lib/db/schema'
import { eq, and, lte, inArray, isNotNull, sql, asc } from 'drizzle-orm'
import { sendEmail } from '@/lib/resend'
import { affiliatePayoutEmail, affiliatePayoutAdminAlertEmail } from '@/lib/email/templates'
import { rateLimit } from '@/lib/security/request'
import { computePayoutAmounts, isTaxProfileComplete, isTaxStatus, formatEuro, type TaxStatus } from './tax'
import { generateCreditNotePdf, type CreditNoteLine, type CreditNoteData } from './credit-note-pdf'
import { syncConnectStatus } from './connect-status'
import { invalidateCustomerCredit, subscriptionConsumesCredit } from './customer-balance'
import {
  CREDIT_MINIMUM_CENTS, PAYOUT_METHOD_CREDIT, PAYOUT_METHOD_TRANSFER, isCreditEligible, isCreditMethod,
  type PayoutMode,
} from './payout-mode'

export const PAYOUT_MINIMUM_CENTS = 1000

/** Payouts in these states count for the "one payout per month" rule. */
const ACTIVE_PAYOUT_STATUSES = ['completed', 'paid', 'processing']
/** A `processing` payout older than this is checked against Stripe by the reconciler. */
const STUCK_AFTER_MS = 15 * 60 * 1000

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'info@daniel-kurzeja.de'

export type PayoutStatus =
  | 'paid'
  | 'skipped_no_connect'
  | 'skipped_not_verified'
  | 'skipped_tax_profile_missing'
  | 'skipped_insufficient_platform_balance'
  | 'skipped_below_minimum'
  | 'skipped_negative_balance'
  | 'skipped_already_paid_this_month'
  | 'skipped_no_commissions'
  | 'skipped_no_subscription'
  | 'failed'
  | 'unclear'
  | 'error'

export interface PayoutResult {
  referrer: string
  status: PayoutStatus
  /** machine-readable reason, e.g. 'tax_profile_missing' | 'insufficient_platform_balance' */
  reason?: string
  /** transferred amount (gross) for paid, otherwise the relevant amount */
  amount?: number
  netAmount?: number
  payoutId?: string
  creditNoteNumber?: string
  /** 'credit' = mit dem eigenen Abo verrechnet, 'transfer' = überwiesen */
  method?: 'credit' | 'transfer'
  error?: string
}

interface ReferrerProfile {
  id: string
  email: string | null
  username: string | null
  stripeConnectId: string | null
  affiliateOnboarded: boolean | null
}

/** Snapshot of the partner's tax data, frozen on each payout (immutable record). */
export interface TaxProfileSnapshot {
  taxStatus: TaxStatus
  fullName: string
  street: string
  zip: string
  city: string
  country: string
  taxNumber: string | null
  vatId: string | null
  entrepreneurConfirmed: boolean
  consentAt: string
  consentVersion: string
  consentText: string | null
  consentIp: string | null
  profileUpdatedAt: string
  username: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** „Kunde #1234“ – stabil je Kunde, ohne Rückschluss auf Name oder E-Mail. */
export function maskCustomer(refereeId: string | null, stripeCustomerId: string | null): string {
  const basis = refereeId ?? stripeCustomerId
  if (!basis) return 'Kunde (gelöscht)'
  const n = parseInt(createHash('sha256').update(`fs-customer:${basis}`).digest('hex').slice(0, 8), 16) % 10000
  return `Kunde #${n.toString().padStart(4, '0')}`
}

/** „…AbC12345“ – letzte 8 Zeichen der Stripe-Rechnungs-ID (ohne `:chargeback`-Suffix). */
export function shortInvoiceRef(stripeInvoiceId: string): string {
  const id = stripeInvoiceId.split(':')[0]
  return id.length > 8 ? `…${id.slice(-8)}` : id
}

/** ISO date (YYYY-MM-DD) in German time. */
function berlinDate(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

/** DATE/TIMESTAMPTZ column value (string or Date, depending on the legacy table shape) → YYYY-MM-DD. */
function toIsoDate(v: unknown): string {
  if (v instanceof Date) return berlinDate(v)
  return String(v ?? '').slice(0, 10)
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Stripe errors after which we know for sure that NO transfer was created. */
function isDefinitiveStripeError(err: unknown): boolean {
  const type = (err as { type?: string })?.type
  return [
    'StripeInvalidRequestError', 'StripeCardError', 'StripeAuthenticationError',
    'StripePermissionError', 'StripeRateLimitError', 'StripeIdempotencyError',
  ].includes(type ?? '')
}

function isInsufficientFundsError(err: unknown): boolean {
  const code = (err as { code?: string })?.code
  return code === 'balance_insufficient' || /insufficient (available )?funds/i.test(errorMessage(err))
}

export async function getPlatformAvailableEur(stripe: Stripe): Promise<number> {
  const balance = await stripe.balance.retrieve()
  return balance.available.find(b => b.currency === 'eur')?.amount ?? 0
}

/** Release matured commissions (pending → available once the hold has passed). */
export async function releaseMaturedCommissions(referrerId?: string): Promise<number> {
  const now = new Date()
  const conditions = [
    eq(affiliateCommissions.status, 'pending'),
    lte(affiliateCommissions.availableAt, now),
  ]
  if (referrerId) conditions.push(eq(affiliateCommissions.referrerId, referrerId))

  const released = await db.update(affiliateCommissions)
    .set({ status: 'available', updatedAt: now })
    .where(and(...conditions))
    .returning({ id: affiliateCommissions.id })
    .catch(() => [])
  return released.length
}

async function loadTaxSnapshot(referrer: ReferrerProfile): Promise<TaxProfileSnapshot | null> {
  const p = await db.query.affiliateTaxProfiles.findFirst({ where: eq(affiliateTaxProfiles.userId, referrer.id) })
  if (!p || !isTaxProfileComplete(p) || !isTaxStatus(p.taxStatus)) return null
  return {
    taxStatus: p.taxStatus,
    fullName: p.fullName,
    street: p.street,
    zip: p.zip,
    city: p.city,
    country: p.country,
    taxNumber: p.taxNumber,
    vatId: p.vatId,
    entrepreneurConfirmed: p.entrepreneurConfirmed,
    consentAt: p.consentAt!.toISOString(),
    consentVersion: p.consentVersion!,
    consentText: p.consentText,
    consentIp: p.consentIp,
    profileUpdatedAt: p.updatedAt.toISOString(),
    username: referrer.username,
  }
}

type CommissionRow = {
  id: string
  commissionAmount: number
  grossAmount: number
  netAmount: number | null
  commissionRate: string
  stripeInvoiceId: string
  stripeCustomerId: string | null
  refereeId: string | null
  createdAt: Date
}

function buildLines(rows: CommissionRow[]): CreditNoteLine[] {
  return [...rows]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(c => ({
      date: c.createdAt.toISOString(),
      invoiceRef: shortInvoiceRef(c.stripeInvoiceId),
      customerRef: maskCustomer(c.refereeId, c.stripeCustomerId),
      baseNetCents: c.netAmount,
      rate: Number(c.commissionRate) || 0.1,
      commissionCents: c.commissionAmount,
      kind: c.commissionAmount < 0 ? 'chargeback' : 'commission',
    }))
}

// ─── Finalize / fail ──────────────────────────────────────────────────────────

/**
 * Transaction B: assign the next gapless credit note number, mark payout + commissions paid.
 * Guarded by `status = 'processing'` so it can never run twice for the same payout.
 */
async function finalizePaidPayout(
  payoutId: string,
  ref: { transferId?: string; balanceTxnId?: string },
  paidAt: Date,
): Promise<string> {
  return db.transaction(async (tx) => {
    const issueDate = berlinDate(paidAt)
    const year = Number(issueDate.slice(0, 4))
    const counter = await tx.execute<{ last_number: number }>(sql`
      INSERT INTO affiliate_credit_note_counters (year, last_number) VALUES (${year}, 1)
      ON CONFLICT (year) DO UPDATE SET last_number = affiliate_credit_note_counters.last_number + 1
      RETURNING last_number`)
    const n = Number(counter[0]?.last_number)
    if (!n) throw new Error('credit note counter failed')
    const number = `GS-${year}-${String(n).padStart(5, '0')}`

    const updated = await tx.update(affiliatePayouts).set({
      status: 'paid',
      // undefined-Felder lässt Drizzle weg: jede Methode setzt nur ihre eigene Stripe-Referenz
      stripeTransferId: ref.transferId,
      stripeBalanceTxnId: ref.balanceTxnId,
      paidAt,
      creditNoteNumber: number,
      creditNoteDate: issueDate,
      creditNoteStatus: 'pending',
      failureReason: null,
      updatedAt: paidAt,
    }).where(and(eq(affiliatePayouts.id, payoutId), eq(affiliatePayouts.status, 'processing')))
      .returning({ id: affiliatePayouts.id })
    if (updated.length !== 1) throw new Error(`payout ${payoutId} is not processing anymore`)

    await tx.update(affiliateCommissions)
      .set({ status: 'paid', paidAt, updatedAt: paidAt })
      .where(and(eq(affiliateCommissions.payoutId, payoutId), eq(affiliateCommissions.status, 'processing')))
    return number
  })
}

/** Payout failed for sure (no money moved): commissions go back to `available`. */
async function failPayout(payoutId: string, reason: string): Promise<void> {
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.update(affiliatePayouts)
      .set({ status: 'failed', failureReason: reason.slice(0, 500), updatedAt: now })
      .where(and(eq(affiliatePayouts.id, payoutId), eq(affiliatePayouts.status, 'processing')))
    await tx.update(affiliateCommissions)
      .set({ status: 'available', payoutId: null, updatedAt: now })
      .where(and(eq(affiliateCommissions.payoutId, payoutId), eq(affiliateCommissions.status, 'processing')))
  })
}

// ─── Credit note PDF ──────────────────────────────────────────────────────────

export function creditNoteKey(referrerId: string | null, number: string): string {
  return `affiliate/credit-notes/${referrerId ?? 'deleted'}/${number}.pdf`
}

type PayoutRow = typeof affiliatePayouts.$inferSelect

export function creditNoteDataFromPayout(p: PayoutRow): CreditNoteData {
  const snap = p.taxProfileSnapshot as TaxProfileSnapshot | null
  if (!snap || !p.creditNoteNumber || !p.paidAt) throw new Error(`payout ${p.id} has no credit note data`)
  return {
    number: p.creditNoteNumber,
    issueDate: p.creditNoteDate ? `${toIsoDate(p.creditNoteDate)}T12:00:00Z` : p.paidAt.toISOString(),
    periodStart: toIsoDate(p.periodStart),
    periodEnd: toIsoDate(p.periodEnd),
    paidAt: p.paidAt.toISOString(),
    recipient: {
      taxStatus: snap.taxStatus,
      fullName: snap.fullName,
      street: snap.street,
      zip: snap.zip,
      city: snap.city,
      country: snap.country,
      taxNumber: snap.taxNumber,
      vatId: snap.vatId,
    },
    lines: (p.lineItems as CreditNoteLine[] | null) ?? [],
    netCents: p.netAmount ?? p.totalAmount,
    vatCents: p.vatAmount ?? 0,
    grossCents: p.grossAmount ?? p.totalAmount,
    vatRate: Number(p.vatRate ?? 0),
    stripeTransferId: p.stripeTransferId,
    paymentMethod: isCreditMethod(p.payoutMethod) ? 'credit' : 'transfer',
  }
}

/** Generate the PDF and store it in R2 (private key). Never throws. */
export async function createCreditNoteDocument(payoutId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const p = await db.query.affiliatePayouts.findFirst({ where: eq(affiliatePayouts.id, payoutId) })
    if (!p) return { ok: false, error: 'payout not found' }
    if (p.creditNoteStatus === 'created' && p.creditNoteKey) return { ok: true }
    const pdf = await generateCreditNotePdf(creditNoteDataFromPayout(p))
    const key = creditNoteKey(p.referrerId, p.creditNoteNumber!)
    const { uploadToR2 } = await import('@/lib/r2/client')
    await uploadToR2(key, Buffer.from(pdf), 'application/pdf')
    await db.update(affiliatePayouts)
      .set({ creditNoteKey: key, creditNoteStatus: 'created', creditNoteError: null, updatedAt: new Date() })
      .where(eq(affiliatePayouts.id, payoutId))
    return { ok: true }
  } catch (err) {
    const message = errorMessage(err)
    console.error(`[affiliate-payout] credit note for ${payoutId} failed:`, message)
    await db.update(affiliatePayouts)
      .set({ creditNoteStatus: 'pending', creditNoteError: message.slice(0, 500), updatedAt: new Date() })
      .where(eq(affiliatePayouts.id, payoutId))
      .catch(() => {})
    return { ok: false, error: message }
  }
}

/** Retry all paid payouts whose credit note PDF is still missing. */
export async function retryPendingCreditNotes(): Promise<{ retried: number; failed: { number: string; error: string }[] }> {
  const rows = await db.select({ id: affiliatePayouts.id, number: affiliatePayouts.creditNoteNumber })
    .from(affiliatePayouts)
    .where(and(
      eq(affiliatePayouts.status, 'paid'),
      eq(affiliatePayouts.creditNoteStatus, 'pending'),
      isNotNull(affiliatePayouts.creditNoteNumber),
    ))
    .limit(200)
  const failed: { number: string; error: string }[] = []
  for (const r of rows) {
    const res = await createCreditNoteDocument(r.id)
    if (!res.ok) failed.push({ number: r.number ?? r.id, error: res.error ?? 'unknown' })
  }
  return { retried: rows.length, failed }
}

/**
 * Look up the customer balance transaction of a credit payout via metadata.payout_id
 * (only the partner's own Stripe customer, only transactions created after the payout row).
 */
async function findCreditBalanceTxn(
  stripe: Stripe,
  customerId: string,
  payoutId: string,
  createdAt: Date,
): Promise<Stripe.CustomerBalanceTransaction | null> {
  const gte = Math.floor(createdAt.getTime() / 1000) - 300
  let startingAfter: string | undefined
  for (let page = 0; page < 20; page++) {
    const list = await stripe.customers.listBalanceTransactions(customerId, {
      limit: 100,
      created: { gte },
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    const hit = list.data.find(t => t.metadata?.payout_id === payoutId)
    if (hit) return hit
    if (!list.has_more || list.data.length === 0) return null
    startingAfter = list.data[list.data.length - 1].id
  }
  // Mehr als 2000 Buchungen seit der Auszahlung: lieber unklar lassen als falsch freigeben
  throw new Error('too many balance transactions to search')
}

/** Best effort: Gutschrift-Nummer an die Kundenguthaben-Buchung schreiben (Nummer gibt es erst beim „paid“). */
async function labelCreditBalanceTxn(stripe: Stripe, customerId: string, txnId: string, number: string): Promise<void> {
  invalidateCustomerCredit(customerId)
  try {
    await stripe.customers.updateBalanceTransaction(customerId, txnId, {
      description: `Provision Gutschrift ${number}`,
      metadata: { credit_note_number: number },
    })
  } catch (err) {
    console.error(`[affiliate-payout] could not label balance txn ${txnId} with ${number}:`, errorMessage(err))
  }
}

/**
 * Payouts stuck in `processing` (crash or unclear Stripe answer).
 *  - Transfer: look the transfer up by transfer_group.
 *  - Verrechnung: look the customer balance transaction up by metadata.payout_id.
 * Found → finalize as paid. Not found → failed, commissions released.
 */
export async function reconcileStuckPayouts(stripe: Stripe): Promise<PayoutResult[]> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS)
  const stuck = await db.select({
    id: affiliatePayouts.id,
    referrerId: affiliatePayouts.referrerId,
    createdAt: affiliatePayouts.createdAt,
    payoutMethod: affiliatePayouts.payoutMethod,
    stripeCustomerId: affiliatePayouts.stripeCustomerId,
  })
    .from(affiliatePayouts)
    .where(and(eq(affiliatePayouts.status, 'processing'), lte(affiliatePayouts.createdAt, cutoff)))
  const results: PayoutResult[] = []
  for (const p of stuck) {
    const name = p.referrerId ?? 'gelöscht'
    try {
      if (isCreditMethod(p.payoutMethod)) {
        if (!p.stripeCustomerId) {
          // Ohne Kunden-ID kann keine Buchung angelegt worden sein
          await failPayout(p.id, 'no_customer_for_credit')
          results.push({ referrer: name, status: 'failed', reason: 'no_customer_for_credit', payoutId: p.id, method: 'credit' })
          continue
        }
        const txn = await findCreditBalanceTxn(stripe, p.stripeCustomerId, p.id, p.createdAt)
        if (txn) {
          const number = await finalizePaidPayout(p.id, { balanceTxnId: txn.id }, new Date(txn.created * 1000))
          await labelCreditBalanceTxn(stripe, p.stripeCustomerId, txn.id, number)
          await createCreditNoteDocument(p.id)
          results.push({ referrer: name, status: 'paid', reason: 'reconciled', amount: -txn.amount, payoutId: p.id, creditNoteNumber: number, method: 'credit' })
        } else {
          await failPayout(p.id, 'no_balance_txn_found_after_reconcile')
          results.push({ referrer: name, status: 'failed', reason: 'no_balance_txn_found_after_reconcile', payoutId: p.id, method: 'credit' })
        }
        continue
      }
      const list = await stripe.transfers.list({ transfer_group: `payout-${p.id}`, limit: 3 })
      const transfer = list.data.find(t => !t.reversed)
      if (transfer) {
        const number = await finalizePaidPayout(p.id, { transferId: transfer.id }, new Date(transfer.created * 1000))
        await createCreditNoteDocument(p.id)
        results.push({ referrer: name, status: 'paid', reason: 'reconciled', amount: transfer.amount, payoutId: p.id, creditNoteNumber: number, method: 'transfer' })
      } else {
        await failPayout(p.id, 'no_transfer_found_after_reconcile')
        results.push({ referrer: name, status: 'failed', reason: 'no_transfer_found_after_reconcile', payoutId: p.id, method: 'transfer' })
      }
    } catch (err) {
      results.push({ referrer: name, status: 'unclear', reason: 'reconcile_error', payoutId: p.id, error: errorMessage(err) })
    }
  }
  return results
}

// ─── Main ─────────────────────────────────────────────────────────────────────

class SkipPayout extends Error {
  constructor(public result: Omit<PayoutResult, 'referrer'>) { super(result.status) }
}

interface PreparedPayout { id: string; grossCents: number; netCents: number; count: number }

/**
 * Transaction A (shared by transfer and credit): advisory lock per referrer, monthly limit,
 * lock the available commissions, compute amounts, insert payout row `processing`, mark the
 * commissions `processing`. Throws SkipPayout for every guard.
 */
async function preparePayout(
  referrer: ReferrerProfile,
  snapshot: TaxProfileSnapshot,
  opts: { method: 'credit' | 'transfer'; minimumCents: number; platformAvailable: number | null; stripeCustomerId?: string | null },
): Promise<PreparedPayout> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`affiliate-payout:${referrer.id}`}))`)

    const already = await tx.select({ id: affiliatePayouts.id }).from(affiliatePayouts)
      .where(and(
        eq(affiliatePayouts.referrerId, referrer.id),
        inArray(affiliatePayouts.status, ACTIVE_PAYOUT_STATUSES),
        sql`${affiliatePayouts.createdAt} >= (date_trunc('month', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')`,
      ))
      .limit(1)
    if (already.length > 0) throw new SkipPayout({ status: 'skipped_already_paid_this_month', method: opts.method })

    const commissions: CommissionRow[] = await tx.select({
      id: affiliateCommissions.id,
      commissionAmount: affiliateCommissions.commissionAmount,
      grossAmount: affiliateCommissions.grossAmount,
      netAmount: affiliateCommissions.netAmount,
      commissionRate: affiliateCommissions.commissionRate,
      stripeInvoiceId: affiliateCommissions.stripeInvoiceId,
      stripeCustomerId: affiliateCommissions.stripeCustomerId,
      refereeId: affiliateCommissions.refereeId,
      createdAt: affiliateCommissions.createdAt,
    })
      .from(affiliateCommissions)
      .where(and(
        eq(affiliateCommissions.referrerId, referrer.id),
        eq(affiliateCommissions.status, 'available'),
      ))
      .orderBy(asc(affiliateCommissions.createdAt))
      .for('update')

    if (commissions.length === 0) throw new SkipPayout({ status: 'skipped_no_commissions', method: opts.method })

    // Safety: a commission may never exceed the customer revenue it is based on.
    for (const c of commissions) {
      if (Math.abs(c.commissionAmount) > Math.abs(c.grossAmount)) {
        console.error(`[affiliate-payout] SANITY VIOLATION commission ${c.id}: ${c.commissionAmount} > gross ${c.grossAmount}`)
        throw new SkipPayout({ status: 'error', reason: 'sanity_check_failed', error: 'sanity_check_failed', method: opts.method })
      }
    }

    const amounts = computePayoutAmounts(commissions.map(c => c.commissionAmount), snapshot.taxStatus)
    if (amounts.netCents < 0) throw new SkipPayout({ status: 'skipped_negative_balance', amount: amounts.netCents, method: opts.method })
    if (amounts.netCents < opts.minimumCents) {
      throw new SkipPayout({ status: 'skipped_below_minimum', amount: amounts.netCents, method: opts.method })
    }
    if (opts.platformAvailable != null && amounts.grossCents > opts.platformAvailable) {
      throw new SkipPayout({
        status: 'skipped_insufficient_platform_balance', reason: 'insufficient_platform_balance', method: opts.method,
        amount: amounts.grossCents, error: `Stripe-Guthaben ${formatEuro(opts.platformAvailable)} < ${formatEuro(amounts.grossCents)}`,
      })
    }

    const dates = commissions.map(c => berlinDate(c.createdAt)).sort()
    const commissionIds = commissions.map(c => c.id)
    const now = new Date()
    const [row] = await tx.insert(affiliatePayouts).values({
      referrerId: referrer.id,
      commissionIds,
      totalAmount: amounts.grossCents,
      commissionCount: commissionIds.length,
      periodStart: dates[0],
      periodEnd: dates[dates.length - 1],
      status: 'processing',
      payoutMethod: opts.method === 'credit' ? PAYOUT_METHOD_CREDIT : PAYOUT_METHOD_TRANSFER,
      stripeCustomerId: opts.method === 'credit' ? (opts.stripeCustomerId ?? null) : null,
      netAmount: amounts.netCents,
      vatAmount: amounts.vatCents,
      grossAmount: amounts.grossCents,
      vatRate: amounts.vatRate.toFixed(4),
      taxStatus: snapshot.taxStatus,
      taxProfileSnapshot: snapshot,
      lineItems: buildLines(commissions),
      createdAt: now,
      updatedAt: now,
    }).returning({ id: affiliatePayouts.id })

    await tx.update(affiliateCommissions)
      .set({ status: 'processing', payoutId: row.id, updatedAt: now })
      .where(inArray(affiliateCommissions.id, commissionIds))

    return { id: row.id, grossCents: amounts.grossCents, netCents: amounts.netCents, count: commissionIds.length }
  })
}

/** Fresh payout preference + own subscription of the partner (read at the start of every run). */
interface PayoutContext {
  payoutMode: PayoutMode
  stripeCustomerId: string | null
  subscriptionStatus: string | null
  cancelAtPeriodEnd: boolean | null
  deactivatedAt: Date | null
}

async function loadPayoutContext(referrerId: string): Promise<PayoutContext | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, referrerId),
    columns: { affiliatePayoutMode: true, stripeCustomerId: true, subscriptionStatus: true, cancelAtPeriodEnd: true, deactivatedAt: true },
  })
  if (!row) return null
  return {
    payoutMode: row.affiliatePayoutMode === 'payout' ? 'payout' : 'credit',
    stripeCustomerId: row.stripeCustomerId,
    subscriptionStatus: row.subscriptionStatus,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    deactivatedAt: row.deactivatedAt,
  }
}

/** Net sum of the available commissions (for the "Partner ohne Abo" admin note). */
async function availableNetCents(referrerId: string): Promise<number> {
  const [r] = await db.select({ s: sql<number>`coalesce(sum(${affiliateCommissions.commissionAmount}), 0)::int` })
    .from(affiliateCommissions)
    .where(and(eq(affiliateCommissions.referrerId, referrerId), eq(affiliateCommissions.status, 'available')))
  return Number(r?.s ?? 0)
}

/** Credit-mode partner without an active subscription and without a usable Connect account. */
async function noSubscriptionResult(referrer: ReferrerProfile, name: string): Promise<PayoutResult> {
  const net = await availableNetCents(referrer.id)
  if (net < 0) return { referrer: name, status: 'skipped_negative_balance', amount: net, method: 'credit' }
  if (net === 0) return { referrer: name, status: 'skipped_no_commissions', method: 'credit' }
  return { referrer: name, status: 'skipped_no_subscription', reason: 'no_active_subscription', amount: net, method: 'credit' }
}

/**
 * Process the payout for one referrer. All guards included.
 * There is deliberately no option to bypass the monthly limit.
 *
 * Methode nach users.affiliate_payout_mode (frisch gelesen):
 *  - 'credit' + aktives Abo (nächste Rechnung > 0 €) → Verrechnung (Kundenguthaben)
 *  - 'credit' ohne Abo → Überweisung, falls Connect eingerichtet; sonst bleibt das Guthaben stehen
 *  - 'payout' → Überweisung
 */
export async function processReferrerPayout(
  stripe: Stripe,
  referrer: ReferrerProfile,
): Promise<PayoutResult> {
  const name = referrer.username ?? referrer.id
  let ctx: PayoutContext | null
  try {
    ctx = await loadPayoutContext(referrer.id)
  } catch (err) {
    return { referrer: name, status: 'error', error: errorMessage(err) }
  }
  if (!ctx) return { referrer: name, status: 'error', error: 'user not found' }

  if (ctx.payoutMode === 'credit') {
    // Abo, dessen nächste Rechnung 0 € ist (100-%-Gutschein), würde das Guthaben nie verbrauchen
    // → wie "ohne Abo". Unbekannt (Stripe-Fehler) → wie bisher verrechnen.
    if (isCreditEligible(ctx) && (await subscriptionConsumesCredit(stripe, ctx.stripeCustomerId!)) !== false) {
      return processCreditPayout(stripe, referrer, ctx.stripeCustomerId!)
    }
    if (referrer.stripeConnectId) {
      const r = await processTransferPayout(stripe, referrer)
      if (r.status === 'skipped_no_connect' || r.status === 'skipped_not_verified') {
        return { ...(await noSubscriptionResult(referrer, name)), ...(r.error ? { error: r.error } : {}) }
      }
      return r
    }
    // Ohne Steuerprofil zuerst das melden (das muss der Partner ohnehin nachholen)
    if (!(await loadTaxSnapshot(referrer))) {
      return { referrer: name, status: 'skipped_tax_profile_missing', reason: 'tax_profile_missing', method: 'credit' }
    }
    return noSubscriptionResult(referrer, name)
  }
  return processTransferPayout(stripe, referrer)
}

/** Verrechnung: Kundenguthaben auf den eigenen Stripe-Kunden des Partners. */
async function processCreditPayout(stripe: Stripe, referrer: ReferrerProfile, customerId: string): Promise<PayoutResult> {
  const name = referrer.username ?? referrer.id

  const snapshot = await loadTaxSnapshot(referrer)
  if (!snapshot) {
    return { referrer: name, status: 'skipped_tax_profile_missing', reason: 'tax_profile_missing', method: 'credit' }
  }

  let payout: PreparedPayout
  try {
    payout = await preparePayout(referrer, snapshot, {
      method: 'credit', minimumCents: CREDIT_MINIMUM_CENTS, platformAvailable: null, stripeCustomerId: customerId,
    })
  } catch (err) {
    if (err instanceof SkipPayout) return { referrer: name, ...err.result }
    console.error(`[affiliate-payout] prepare (credit) failed for ${name}:`, err)
    return { referrer: name, status: 'error', error: errorMessage(err), method: 'credit' }
  }

  let txn: Stripe.CustomerBalanceTransaction
  try {
    txn = await stripe.customers.createBalanceTransaction(customerId, {
      amount: -payout.grossCents, // negativ = Guthaben für den Kunden
      currency: 'eur',
      description: 'Provision Gutschrift (FinestSites Partnerprogramm)',
      metadata: {
        payout_id: payout.id,
        referrer_id: referrer.id,
        referrer_username: referrer.username ?? '',
        net_cents: String(payout.netCents),
        gross_cents: String(payout.grossCents),
        tax_status: snapshot.taxStatus,
      },
    }, { idempotencyKey: `credit-${payout.id}` })
  } catch (err) {
    const message = errorMessage(err)
    if (isDefinitiveStripeError(err)) {
      await failPayout(payout.id, `credit_failed: ${message}`).catch(e => console.error('[affiliate-payout] failPayout error:', e))
      console.error(`[affiliate-payout] credit failed for ${name}:`, message)
      return { referrer: name, status: 'failed', reason: 'credit_failed', amount: payout.grossCents, payoutId: payout.id, error: message, method: 'credit' }
    }
    console.error(`[affiliate-payout] credit UNCLEAR for ${name}:`, message)
    return { referrer: name, status: 'unclear', reason: 'credit_unclear', amount: payout.grossCents, payoutId: payout.id, error: message, method: 'credit' }
  }

  const paidAt = new Date()
  let number: string
  try {
    number = await finalizePaidPayout(payout.id, { balanceTxnId: txn.id }, paidAt)
  } catch (err) {
    // Guthaben ist gebucht, DB-Update fehlgeschlagen → Abgleich findet die Buchung über metadata.payout_id
    console.error(`[affiliate-payout] finalize (credit) failed for ${name} (txn ${txn.id}):`, err)
    return { referrer: name, status: 'unclear', reason: 'finalize_failed', amount: payout.grossCents, payoutId: payout.id, error: errorMessage(err), method: 'credit' }
  }

  await labelCreditBalanceTxn(stripe, customerId, txn.id, number)
  const doc = await createCreditNoteDocument(payout.id)

  if (referrer.email) {
    sendEmail({
      to: referrer.email,
      subject: 'Deine Provision wurde mit deinem Abo verrechnet – FinestSites',
      html: affiliatePayoutEmail({ amountCents: payout.grossCents, commissionCount: payout.count, method: 'credit' }),
      type: 'affiliate_payout',
    }).catch(() => {})
  }

  console.log(`[affiliate-payout] credited ${payout.grossCents} cents (net ${payout.netCents}) to customer of ${name} (${txn.id}, ${number})`)
  return {
    referrer: name, status: 'paid', amount: payout.grossCents, netAmount: payout.netCents,
    payoutId: payout.id, creditNoteNumber: number, method: 'credit',
    ...(doc.ok ? {} : { reason: 'credit_note_pending', error: doc.error }),
  }
}

/** Überweisung über Stripe Connect (ab 10 €). */
async function processTransferPayout(
  stripe: Stripe,
  referrer: ReferrerProfile,
): Promise<PayoutResult> {
  const name = referrer.username ?? referrer.id

  if (!referrer.stripeConnectId) {
    return { referrer: name, status: 'skipped_no_connect', method: 'transfer' }
  }
  // DB-Flag noch false (z. B. account.updated verpasst oder kein Connect-Webhook):
  // live mit Stripe abgleichen, statt den Partner zu überspringen.
  if (!referrer.affiliateOnboarded) {
    let account: Stripe.Account
    try {
      account = await stripe.accounts.retrieve(referrer.stripeConnectId)
    } catch (err) {
      return { referrer: name, status: 'skipped_no_connect', reason: 'connect_sync_failed', error: errorMessage(err), method: 'transfer' }
    }
    const onboarded = await syncConnectStatus(referrer.id, referrer.stripeConnectId, { current: referrer.affiliateOnboarded, account })
    if (!onboarded) return { referrer: name, status: 'skipped_no_connect', method: 'transfer' }
  }

  // Tax profile + consent are required BEFORE any transfer.
  const snapshot = await loadTaxSnapshot(referrer)
  if (!snapshot) {
    return { referrer: name, status: 'skipped_tax_profile_missing', reason: 'tax_profile_missing', method: 'transfer' }
  }

  // Live verification: account must be fully verified and payouts enabled.
  try {
    const account = await stripe.accounts.retrieve(referrer.stripeConnectId)
    const disabledReason = (account.requirements as { disabled_reason?: string | null } | null)?.disabled_reason ?? null
    if (!account.payouts_enabled || disabledReason) {
      return { referrer: name, status: 'skipped_not_verified', method: 'transfer' }
    }
  } catch (err) {
    return { referrer: name, status: 'error', error: errorMessage(err), method: 'transfer' }
  }

  // Platform balance (EUR, available) — read once before locking.
  let platformAvailable: number
  try {
    platformAvailable = await getPlatformAvailableEur(stripe)
  } catch (err) {
    return { referrer: name, status: 'error', error: `balance: ${errorMessage(err)}`, method: 'transfer' }
  }

  // ── Transaction A: lock, select, create payout row `processing` ─────────────
  let payout: PreparedPayout
  try {
    payout = await preparePayout(referrer, snapshot, { method: 'transfer', minimumCents: PAYOUT_MINIMUM_CENTS, platformAvailable })
  } catch (err) {
    if (err instanceof SkipPayout) return { referrer: name, ...err.result }
    console.error(`[affiliate-payout] prepare failed for ${name}:`, err)
    return { referrer: name, status: 'error', error: errorMessage(err), method: 'transfer' }
  }

  // ── Stripe transfer ──────────────────────────────────────────────────────────
  let transfer: Stripe.Transfer
  try {
    transfer = await stripe.transfers.create({
      amount: payout.grossCents,
      currency: 'eur',
      destination: referrer.stripeConnectId,
      transfer_group: `payout-${payout.id}`,
      description: `FinestSites Partnerprovision – ${referrer.username ?? referrer.id}`,
      metadata: {
        payout_id: payout.id,
        referrer_id: referrer.id,
        referrer_username: referrer.username ?? '',
        net_cents: String(payout.netCents),
        tax_status: snapshot.taxStatus,
      },
    }, { idempotencyKey: `payout-${payout.id}` })
  } catch (err) {
    const message = errorMessage(err)
    if (isDefinitiveStripeError(err)) {
      const reason = isInsufficientFundsError(err) ? 'insufficient_platform_balance' : 'transfer_failed'
      await failPayout(payout.id, `${reason}: ${message}`).catch(e => console.error('[affiliate-payout] failPayout error:', e))
      console.error(`[affiliate-payout] transfer failed for ${name}:`, message)
      return { referrer: name, status: 'failed', reason, amount: payout.grossCents, payoutId: payout.id, error: message, method: 'transfer' }
    }
    // Unclear (network / 5xx): money may have moved — leave `processing` for the reconciler.
    console.error(`[affiliate-payout] transfer UNCLEAR for ${name}:`, message)
    return { referrer: name, status: 'unclear', reason: 'transfer_unclear', amount: payout.grossCents, payoutId: payout.id, error: message, method: 'transfer' }
  }

  // ── Transaction B: number + paid ─────────────────────────────────────────────
  const paidAt = new Date()
  let number: string
  try {
    number = await finalizePaidPayout(payout.id, { transferId: transfer.id }, paidAt)
  } catch (err) {
    // Money is out, DB update failed → reconciler finalizes via transfer_group.
    console.error(`[affiliate-payout] finalize failed for ${name} (transfer ${transfer.id}):`, err)
    return { referrer: name, status: 'unclear', reason: 'finalize_failed', amount: payout.grossCents, payoutId: payout.id, error: errorMessage(err), method: 'transfer' }
  }

  const doc = await createCreditNoteDocument(payout.id)

  if (referrer.email) {
    sendEmail({
      to: referrer.email,
      subject: 'Deine Provision ist unterwegs – FinestSites',
      html: affiliatePayoutEmail({ amountCents: payout.grossCents, commissionCount: payout.count }),
      type: 'affiliate_payout',
    }).catch(() => {})
  }

  console.log(`[affiliate-payout] paid ${payout.grossCents} cents (net ${payout.netCents}) to ${name} (${transfer.id}, ${number})`)
  return {
    referrer: name, status: 'paid', amount: payout.grossCents, netAmount: payout.netCents,
    payoutId: payout.id, creditNoteNumber: number, method: 'transfer',
    ...(doc.ok ? {} : { reason: 'credit_note_pending', error: doc.error }),
  }
}

// ─── Admin notifications ──────────────────────────────────────────────────────

const ADMIN_LABEL: Partial<Record<PayoutStatus, string>> = {
  skipped_tax_profile_missing: 'Angaben für die Abrechnung fehlen (Provision bleibt stehen)',
  skipped_insufficient_platform_balance: 'Stripe-Guthaben reicht nicht – bitte Guthaben prüfen',
  skipped_not_verified: 'Stripe-Konto nicht verifiziert',
  skipped_no_connect: 'Kein eingerichtetes Auszahlungskonto (Stripe Connect) – Provision bleibt stehen',
  skipped_no_subscription: 'Partner ohne Abo – Guthaben offen (kein Auszahlungskonto, bitte Auszahlung klären)',
  failed: 'Überweisung fehlgeschlagen – Provisionen wieder verfügbar',
  unclear: 'Ergebnis unklar – wird automatisch mit Stripe abgeglichen',
  error: 'Fehler',
}

/** Results worth telling the admin about (no "below minimum"/"already paid" noise). */
export function adminRelevant(r: PayoutResult): boolean {
  if (r.status === 'paid') return r.reason === 'credit_note_pending' || r.reason === 'reconciled'
  return r.status in ADMIN_LABEL
}

export async function notifyAdminPayoutIssues(
  context: string,
  results: PayoutResult[],
  extra: { creditNoteFailures?: { number: string; error: string }[]; paidCount?: number } = {},
): Promise<void> {
  const done = (r: PayoutResult) => (r.method === 'credit' ? 'verrechnet' : 'ausgezahlt')
  const items = results.filter(adminRelevant).map(r => ({
    partner: r.referrer,
    problem: r.status === 'paid'
      ? (r.reason === 'reconciled' ? `Nachträglich als ${done(r)} verbucht (${r.creditNoteNumber ?? ''})` : `${done(r) === 'verrechnet' ? 'Verrechnet' : 'Ausgezahlt'}, Gutschrift-PDF folgt (${r.creditNoteNumber ?? ''})`)
      : r.status === 'failed' && r.method === 'credit'
        ? 'Verrechnung fehlgeschlagen – Provisionen wieder verfügbar'
        : (ADMIN_LABEL[r.status] ?? r.status),
    detail: [r.amount != null ? formatEuro(r.amount) : '', r.error ?? ''].filter(Boolean).join(' · '),
  }))
  for (const f of extra.creditNoteFailures ?? []) {
    items.push({ partner: f.number, problem: 'Gutschrift-PDF konnte nicht erstellt werden', detail: f.error })
  }
  if (items.length === 0) return
  try {
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Partner-Auszahlungen: ${items.length} Hinweis${items.length === 1 ? '' : 'e'} (${context})`,
      html: affiliatePayoutAdminAlertEmail({ context, paidCount: extra.paidCount ?? 0, items }),
      type: 'affiliate_payout_admin_alert',
      category: 'system',
    })
  } catch (err) {
    console.error('[affiliate-payout] admin alert failed:', err)
  }
}

/** Single-partner alert (self-service), throttled so repeated clicks don't spam. */
export async function notifyAdminSingle(result: PayoutResult): Promise<void> {
  if (!adminRelevant(result) || result.status === 'skipped_tax_profile_missing' || result.status === 'skipped_not_verified' || result.status === 'skipped_no_connect' || result.status === 'skipped_no_subscription') return
  if (!rateLimit('affiliate-payout-admin-alert', `${result.referrer}:${result.status}`, 1, 12 * 60 * 60 * 1000)) return
  await notifyAdminPayoutIssues('Auszahlung durch Partner', [result])
}

// ─── Batch ────────────────────────────────────────────────────────────────────

/** Reconcile stuck payouts + retry missing PDFs (safe to run daily). */
export async function runPayoutMaintenance(stripe: Stripe, opts: { notifyAdmin?: boolean } = {}) {
  const reconciled = await reconcileStuckPayouts(stripe).catch(err => {
    console.error('[affiliate-payout] reconcile failed:', err)
    return [] as PayoutResult[]
  })
  const creditNotes = await retryPendingCreditNotes().catch(err => {
    console.error('[affiliate-payout] credit note retry failed:', err)
    return { retried: 0, failed: [] as { number: string; error: string }[] }
  })
  if (opts.notifyAdmin !== false) {
    await notifyAdminPayoutIssues('Wartung', reconciled, { creditNoteFailures: creditNotes.failed })
  }
  return { reconciled, creditNotes }
}

/** Full payout run over all referrers with available commissions (cron/admin). */
export async function runPayoutBatch(stripe: Stripe, opts: { context?: string; notifyAdmin?: boolean } = {}): Promise<{
  results: PayoutResult[]
  released: number
  reconciled: PayoutResult[]
  creditNotes: { retried: number; failed: { number: string; error: string }[] }
}> {
  const released = await releaseMaturedCommissions()
  const { reconciled, creditNotes } = await runPayoutMaintenance(stripe, { notifyAdmin: false })

  const available = await db
    .selectDistinct({ referrerId: affiliateCommissions.referrerId })
    .from(affiliateCommissions)
    .where(and(eq(affiliateCommissions.status, 'available'), isNotNull(affiliateCommissions.referrerId)))

  const referrerIds = available.map(c => c.referrerId).filter((id): id is string => !!id)
  const results: PayoutResult[] = []
  if (referrerIds.length > 0) {
    const referrers = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        stripeConnectId: users.stripeConnectId,
        affiliateOnboarded: users.affiliateOnboarded,
      })
      .from(users)
      .where(inArray(users.id, referrerIds))

    for (const referrer of referrers) {
      results.push(await processReferrerPayout(stripe, referrer))
    }
  }

  if (opts.notifyAdmin !== false) {
    await notifyAdminPayoutIssues(opts.context ?? 'Monatslauf', [...reconciled, ...results], {
      creditNoteFailures: creditNotes.failed,
      paidCount: results.filter(r => r.status === 'paid').length,
    })
  }
  return { results, released, reconciled, creditNotes }
}
