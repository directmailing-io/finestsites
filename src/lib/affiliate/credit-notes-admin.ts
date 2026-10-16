/**
 * Admin-Sicht auf Gutschriften (Liste, CSV für die Steuerberatung, reservierte Beträge).
 * Nur aus admin-geschützten Routen/Seiten aufrufen.
 */

import { db } from '@/lib/db'
import { affiliateCommissions, affiliatePayouts, affiliateTaxProfiles, users } from '@/lib/db/schema'
import { desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { vatCents, VAT_RATE_PERCENT, TAX_STATUS_LABEL, isTaxStatus } from './tax'
import type { TaxProfileSnapshot } from './payout'

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
      pdfReady: r.pdfStatus === 'created',
      pdfError: r.pdfError,
    }
  })
}

/** Offene Partner-Provisionen (pending + available + processing), plus USt-Schätzung. */
export async function reservedForPartners(): Promise<{ netCents: number; vatEstimateCents: number; totalCents: number; partners: number }> {
  const sums = await db.select({
    referrerId: affiliateCommissions.referrerId,
    amount: sql<number>`coalesce(sum(${affiliateCommissions.commissionAmount}), 0)::int`,
  })
    .from(affiliateCommissions)
    .where(inArray(affiliateCommissions.status, ['pending', 'available', 'processing']))
    .groupBy(affiliateCommissions.referrerId)

  const ids = sums.map(s => s.referrerId).filter((id): id is string => !!id)
  const profiles = ids.length
    ? await db.select({ userId: affiliateTaxProfiles.userId, taxStatus: affiliateTaxProfiles.taxStatus })
      .from(affiliateTaxProfiles).where(inArray(affiliateTaxProfiles.userId, ids))
    : []
  const regel = new Set(profiles.filter(p => p.taxStatus === 'regelbesteuert').map(p => p.userId))

  let net = 0, vat = 0, partners = 0
  for (const s of sums) {
    const amount = Number(s.amount)
    if (amount <= 0) continue // negative Salden werden nicht ausgezahlt
    net += amount
    partners += 1
    if (s.referrerId && regel.has(s.referrerId)) vat += vatCents(amount, VAT_RATE_PERCENT)
  }
  return { netCents: net, vatEstimateCents: vat, totalCents: net + vat, partners }
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
  const header = ['Gutschrift-Nr.', 'Datum', 'Partner', 'Benutzername', 'Steuerstatus', 'Netto', 'USt', 'Brutto', 'Stripe-Transfer']
  const lines = [...rows].sort((a, b) => a.number.localeCompare(b.number)).map(r => [
    r.number,
    r.date,
    r.partnerName,
    r.username ?? '',
    isTaxStatus(r.taxStatus) ? TAX_STATUS_LABEL[r.taxStatus] : (r.taxStatus ?? ''),
    centsDE(r.netCents),
    centsDE(r.vatCents),
    centsDE(r.grossCents),
    r.transferId ?? '',
  ].map(csvCell).join(';'))
  return '﻿' + [header.join(';'), ...lines].join('\r\n') + '\r\n'
}
