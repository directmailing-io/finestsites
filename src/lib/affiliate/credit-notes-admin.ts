/**
 * Admin-Sicht auf Gutschriften (Liste, CSV für die Steuerberatung, reservierte Beträge).
 * Nur aus admin-geschützten Routen/Seiten aufrufen.
 */

import { db } from '@/lib/db'
import { affiliateCommissions, affiliatePayouts, affiliateTaxProfiles, users } from '@/lib/db/schema'
import { desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { vatCents, VAT_RATE_PERCENT, TAX_STATUS_LABEL, isTaxStatus } from './tax'
import type { TaxProfileSnapshot } from './payout'
import { isCreditEligible, isCreditMethod, methodLabelAdmin } from './payout-mode'

export interface AdminCreditNoteRow {
  id: string
  number: string
  date: string
  partnerName: string
  username: string | null
  taxStatus: string | null
  netCents: number
  vatCents: number
  grossCents: number
  transferId: string | null
  /** 'credit' = mit dem Abo des Partners verrechnet, 'transfer' = überwiesen */
  method: 'credit' | 'transfer'
  /** Stripe-Referenz: Transfer (tr_…) bzw. Kundenguthaben-Buchung (cbtxn_…) */
  stripeRef: string | null
  pdfReady: boolean
  pdfError: string | null
}

export async function listCreditNotes(limit = 2000): Promise<AdminCreditNoteRow[]> {
  const rows = await db.select({
    id: affiliatePayouts.id,
    number: affiliatePayouts.creditNoteNumber,
    date: affiliatePayouts.creditNoteDate,
    paidAt: affiliatePayouts.paidAt,
    snapshot: affiliatePayouts.taxProfileSnapshot,
    taxStatus: affiliatePayouts.taxStatus,
    net: affiliatePayouts.netAmount,
    vat: affiliatePayouts.vatAmount,
    gross: affiliatePayouts.grossAmount,
    total: affiliatePayouts.totalAmount,
    transferId: affiliatePayouts.stripeTransferId,
    balanceTxnId: affiliatePayouts.stripeBalanceTxnId,
    payoutMethod: affiliatePayouts.payoutMethod,
    pdfStatus: affiliatePayouts.creditNoteStatus,
    pdfError: affiliatePayouts.creditNoteError,
    username: users.username,
  })
    .from(affiliatePayouts)
    .leftJoin(users, eq(users.id, affiliatePayouts.referrerId))
    .where(isNotNull(affiliatePayouts.creditNoteNumber))
    .orderBy(desc(affiliatePayouts.creditNoteNumber))
    .limit(limit)

  return rows.map(r => {
    const snap = r.snapshot as TaxProfileSnapshot | null
    return {
      id: r.id,
      number: r.number!,
      date: String(r.date ?? r.paidAt?.toISOString().slice(0, 10) ?? ''),
      partnerName: snap?.fullName ?? '',
      username: r.username ?? snap?.username ?? null,
      taxStatus: r.taxStatus,
      netCents: r.net ?? r.total,
      vatCents: r.vat ?? 0,
      grossCents: r.gross ?? r.total,
      transferId: r.transferId,
      method: isCreditMethod(r.payoutMethod) ? 'credit' : 'transfer',
      stripeRef: isCreditMethod(r.payoutMethod) ? r.balanceTxnId : r.transferId,
      pdfReady: r.pdfStatus === 'created',
      pdfError: r.pdfError,
    }
  })
}

export interface ReservedSummary {
  /** Geld, das Stripe noch verlassen wird bzw. kann (Überweisung, Partner ohne Abo) */
  netCents: number
  vatEstimateCents: number
  totalCents: number
  partners: number
  /** Wird mit dem Abo des Partners verrechnet – kein Geldabfluss */
  credit: { netCents: number; vatEstimateCents: number; totalCents: number; partners: number }
}

interface PartnerState {
  id: string
  username: string | null
  email: string | null
  payoutMode: string
  stripeConnectId: string | null
  affiliateOnboarded: boolean | null
  stripeCustomerId: string | null
  subscriptionStatus: string | null
  cancelAtPeriodEnd: boolean | null
  deactivatedAt: Date | null
}

/** Offene Provisionen je Partner (pending + available + processing) mit Steuerstatus und Abo-Lage. */
async function openBalances(): Promise<{ referrerId: string | null; net: number; regel: boolean; partner: PartnerState | null }[]> {
  const sums = await db.select({
    referrerId: affiliateCommissions.referrerId,
    amount: sql<number>`coalesce(sum(${affiliateCommissions.commissionAmount}), 0)::int`,
  })
    .from(affiliateCommissions)
    .where(inArray(affiliateCommissions.status, ['pending', 'available', 'processing']))
    .groupBy(affiliateCommissions.referrerId)

  const ids = sums.map(s => s.referrerId).filter((id): id is string => !!id)
  const [profiles, partners] = ids.length
    ? await Promise.all([
      db.select({ userId: affiliateTaxProfiles.userId, taxStatus: affiliateTaxProfiles.taxStatus })
        .from(affiliateTaxProfiles).where(inArray(affiliateTaxProfiles.userId, ids)),
      db.select({
        id: users.id, username: users.username, email: users.email, payoutMode: users.affiliatePayoutMode,
        stripeConnectId: users.stripeConnectId, affiliateOnboarded: users.affiliateOnboarded,
        stripeCustomerId: users.stripeCustomerId, subscriptionStatus: users.subscriptionStatus,
        cancelAtPeriodEnd: users.cancelAtPeriodEnd, deactivatedAt: users.deactivatedAt,
      }).from(users).where(inArray(users.id, ids)),
    ])
    : [[], []]
  const regel = new Set(profiles.filter(p => p.taxStatus === 'regelbesteuert').map(p => p.userId))
  const byId = new Map(partners.map(p => [p.id, p]))
  return sums.map(s => ({
    referrerId: s.referrerId,
    net: Number(s.amount),
    regel: !!s.referrerId && regel.has(s.referrerId),
    partner: s.referrerId ? byId.get(s.referrerId) ?? null : null,
  }))
}

/** Wie der nächste Lauf diesen Partner abrechnet: verrechnen, überweisen oder offen lassen. */
function settlementOf(p: PartnerState | null): 'credit' | 'transfer' | 'open' {
  if (!p) return 'open'
  if (p.payoutMode === 'payout') return 'transfer'
  if (isCreditEligible(p)) return 'credit'
  return p.stripeConnectId ? 'transfer' : 'open'
}

/**
 * Reservierung = Geld, das Stripe verlassen wird: Überweisungs-Partner und Partner ohne Abo
 * (deren Guthaben auf Wunsch ausgezahlt wird). Verrechnung mit dem Abo separat (kein Geldabfluss).
 */
export async function reservedForPartners(): Promise<ReservedSummary> {
  const rows = await openBalances()
  const out: ReservedSummary = { netCents: 0, vatEstimateCents: 0, totalCents: 0, partners: 0, credit: { netCents: 0, vatEstimateCents: 0, totalCents: 0, partners: 0 } }
  for (const r of rows) {
    if (r.net <= 0) continue // negative Salden werden nicht ausgezahlt
    const vat = r.regel ? vatCents(r.net, VAT_RATE_PERCENT) : 0
    const bucket = settlementOf(r.partner) === 'credit' ? out.credit : out
    bucket.netCents += r.net
    bucket.vatEstimateCents += vat
    bucket.partners += 1
  }
  out.totalCents = out.netCents + out.vatEstimateCents
  out.credit.totalCents = out.credit.netCents + out.credit.vatEstimateCents
  return out
}

export interface PartnerWithoutSubscription {
  id: string
  username: string | null
  email: string | null
  openNetCents: number
  subscriptionStatus: string | null
  hasConnect: boolean
}

/** Partner, die verrechnen wollen, aber kein aktives Abo (mehr) haben – Guthaben bleibt offen. */
export async function partnersWithoutSubscription(): Promise<PartnerWithoutSubscription[]> {
  const rows = await openBalances()
  return rows
    .filter(r => r.net > 0 && r.partner && r.partner.payoutMode !== 'payout' && !isCreditEligible(r.partner))
    .map(r => ({
      id: r.partner!.id,
      username: r.partner!.username,
      email: r.partner!.email,
      openNetCents: r.net,
      subscriptionStatus: r.partner!.subscriptionStatus,
      hasConnect: !!r.partner!.stripeConnectId && !!r.partner!.affiliateOnboarded,
    }))
    .sort((a, b) => b.openNetCents - a.openNetCents)
}

/**
 * users.referral_discount_flag (Kundenseite, eigene Migration) – nur anzeigen, wenn die Spalte
 * existiert. Liefert null, wenn es die Spalte (noch) nicht gibt.
 */
export async function referralDiscountFlags(limit = 100): Promise<{ id: string; username: string | null; flag: string }[] | null> {
  try {
    const exists = await db.execute<{ ok: number }>(sql`
      SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'referral_discount_flag'`)
    if (exists.length === 0) return null
    const rows = await db.execute<{ id: string; username: string | null; flag: string | null }>(sql`
      SELECT id, username, referral_discount_flag::text AS flag FROM public.users
      WHERE referral_discount_flag IS NOT NULL AND referral_discount_flag::text NOT IN ('', 'false', 'f')
      ORDER BY updated_at DESC NULLS LAST LIMIT ${limit}`)
    return rows.map(r => ({ id: r.id, username: r.username, flag: r.flag ?? '' }))
  } catch (err) {
    console.error('[credit-notes-admin] referral_discount_flag lookup failed:', err)
    return null
  }
}

function csvCell(v: string | number | null): string {
  const s = v == null ? '' : String(v)
  // Formel-Injection in Excel verhindern + Quotes escapen
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(,\d+)?$/.test(s) ? `'${s}` : s
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

const centsDE = (c: number) => (c / 100).toFixed(2).replace('.', ',')

/** CSV (Semikolon, deutsches Zahlenformat, UTF-8 mit BOM) für Excel/DATEV-Import. */
export function creditNotesCsv(rows: AdminCreditNoteRow[]): string {
  const header = ['Gutschrift-Nr.', 'Datum', 'Partner', 'Benutzername', 'Steuerstatus', 'Netto', 'USt', 'Brutto', 'Methode', 'Stripe-Referenz']
  const lines = [...rows].sort((a, b) => a.number.localeCompare(b.number)).map(r => [
    r.number,
    r.date,
    r.partnerName,
    r.username ?? '',
    isTaxStatus(r.taxStatus) ? TAX_STATUS_LABEL[r.taxStatus] : (r.taxStatus ?? ''),
    centsDE(r.netCents),
    centsDE(r.vatCents),
    centsDE(r.grossCents),
    methodLabelAdmin(r.method),
    r.stripeRef ?? '',
  ].map(csvCell).join(';'))
  return '﻿' + [header.join(';'), ...lines].join('\r\n') + '\r\n'
}
