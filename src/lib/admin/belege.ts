import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { listCreditNotes } from '@/lib/affiliate/credit-notes-admin'

/**
 * Belege je Monat für die Buchhaltung (Admin, Daniel 01.11.2026).
 *
 * - Ausgangsrechnungen: bezahlte Stripe-Rechnungen, einsortiert nach Zahlungseingang
 *   (status_transitions.paid_at, deutsche Zeit). Das PDF erzeugt Stripe selbst.
 * - Gutschriften: Partner-Gutschriften GS-JJJJ-NNNNN (Datum der Gutschrift).
 * - Stripe-Auszahlungen aufs Bankkonto (arrival_date) inkl. Aufschlüsselung jeder Sammelüberweisung
 *   in die einzelnen Zahlungen, Gebühren und Erstattungen – die Brücke vom Kontoauszug zu den Belegen.
 * Alles live aus Stripe bzw. der DB; nichts wird zusätzlich gespeichert.
 */

const TZ = 'Europe/Berlin'

/** 'YYYY-MM' in deutscher Zeit */
export function monthKey(unixOrDate: number | Date): string {
  const d = typeof unixOrDate === 'number' ? new Date(unixOrDate * 1000) : unixOrDate
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).formatToParts(d)
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`
}

export const isMonthKey = (m: string | null): m is string => !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m)

/** Grenzen des Monats in Unix-Sekunden (großzügig ±1 Tag, genau gefiltert wird über monthKey) */
function monthRange(month: string): { gte: number; lt: number } {
  const [y, m] = month.split('-').map(Number)
  return {
    gte: Math.floor(Date.UTC(y, m - 1, 1) / 1000) - 86_400,
    lt: Math.floor(Date.UTC(y, m, 1) / 1000) + 86_400,
  }
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export interface InvoiceDoc {
  id: string
  number: string
  paidAt: string
  customerName: string | null
  customerEmail: string | null
  grossCents: number
  /** Steuer laut Stripe-Rechnung; ohne Stripe-Steuersätze aus 19 % herausgerechnet (wie /admin/transactions) */
  taxCents: number
  netCents: number
  pdfUrl: string | null
  hostedUrl: string | null
}

export interface CreditNoteDoc {
  id: string
  number: string
  date: string
  partner: string
  netCents: number
  vatCents: number
  grossCents: number
  method: string
  pdfReady: boolean
}

export interface PayoutLine {
  type: string
  description: string | null
  source: string | null
  invoiceNumber: string | null
  grossCents: number
  feeCents: number
  netCents: number
  createdAt: string
}

export interface PayoutDoc {
  id: string
  arrivalDate: string
  amountCents: number
  status: string
  lines: PayoutLine[]
}

export interface MonthDocs {
  month: string
  invoices: InvoiceDoc[]
  creditNotes: CreditNoteDoc[]
  payouts: PayoutDoc[]
  totals: {
    invoiceGross: number
    invoiceTax: number
    invoiceNet: number
    creditGross: number
    creditVat: number
    stripeFees: number
    payoutTotal: number
  }
}

async function listAll<T>(fetchPage: (startingAfter?: string) => Promise<Stripe.ApiList<T & { id: string }>>): Promise<(T & { id: string })[]> {
  const out: (T & { id: string })[] = []
  let after: string | undefined
  for (let i = 0; i < 50; i++) {
    const page = await fetchPage(after)
    out.push(...page.data)
    if (!page.has_more || page.data.length === 0) break
    after = page.data[page.data.length - 1].id
  }
  return out
}

function invoiceTax(inv: Stripe.Invoice, gross: number): number {
  const anyInv = inv as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const fromStripe: number | null =
    Array.isArray(anyInv.total_taxes) ? anyInv.total_taxes.reduce((s: number, t: { amount: number }) => s + (t.amount ?? 0), 0)
    : typeof anyInv.tax === 'number' ? anyInv.tax : null
  if (fromStripe && fromStripe > 0) return fromStripe
  return gross > 0 ? Math.round(gross * 19 / 119) : 0
}

const iso = (unix: number) => new Date(unix * 1000).toISOString()

export async function getMonthDocs(month: string, opts: { withPayoutLines?: boolean } = {}): Promise<MonthDocs> {
  const stripe = getStripe()
  const { gte, lt } = monthRange(month)

  // Rechnungen: bezahlt im Monat. Erstellt bis zu 40 Tage vorher (SEPA, Wiederholungsversuche).
  const invoicesRaw = await listAll<Stripe.Invoice>(after => stripe.invoices.list({
    status: 'paid', limit: 100, created: { gte: gte - 40 * 86_400, lt }, ...(after ? { starting_after: after } : {}),
  }) as Promise<Stripe.ApiList<Stripe.Invoice & { id: string }>>)

  const invoices: InvoiceDoc[] = invoicesRaw
    .filter(inv => (inv.amount_paid ?? 0) > 0)
    .map(inv => ({ inv, paidAt: inv.status_transitions?.paid_at ?? inv.created }))
    .filter(({ paidAt }) => monthKey(paidAt) === month)
    .map(({ inv, paidAt }) => {
      const gross = inv.amount_paid
      const tax = invoiceTax(inv, gross)
      return {
        id: inv.id,
        number: inv.number ?? inv.id,
        paidAt: iso(paidAt),
        customerName: inv.customer_name ?? null,
        customerEmail: inv.customer_email ?? null,
        grossCents: gross,
        taxCents: tax,
        netCents: gross - tax,
        pdfUrl: inv.invoice_pdf ?? null,
        hostedUrl: inv.hosted_invoice_url ?? null,
      }
    })
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt))

  const creditNotes: CreditNoteDoc[] = (await listCreditNotes(100_000))
    .filter(r => r.date && r.date.slice(0, 7) === month)
    .map(r => ({
      id: r.id,
      number: r.number,
      date: r.date,
      partner: r.partnerName || r.username || '–',
      netCents: r.netCents,
      vatCents: r.vatCents,
      grossCents: r.grossCents,
      method: r.method,
      pdfReady: r.pdfReady,
    }))
    .sort((a, b) => a.number.localeCompare(b.number))

  const payoutsRaw = await listAll<Stripe.Payout>(after => stripe.payouts.list({
    limit: 100, arrival_date: { gte, lt }, ...(after ? { starting_after: after } : {}),
  }) as Promise<Stripe.ApiList<Stripe.Payout & { id: string }>>)

  const payouts: PayoutDoc[] = []
  for (const po of payoutsRaw.filter(p => monthKey(p.arrival_date) === month && p.status !== 'canceled' && p.status !== 'failed')) {
    let lines: PayoutLine[] = []
    if (opts.withPayoutLines) {
      const txns = await listAll<Stripe.BalanceTransaction>(after => stripe.balanceTransactions.list({
        payout: po.id, limit: 100, expand: ['data.source'], ...(after ? { starting_after: after } : {}),
      }) as Promise<Stripe.ApiList<Stripe.BalanceTransaction & { id: string }>>)
      lines = txns.filter(t => t.type !== 'payout').map(t => {
        const src = t.source as any // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
          type: t.type,
          description: t.description ?? null,
          source: typeof src === 'string' ? src : src?.id ?? null,
          invoiceNumber: null,
          grossCents: t.amount,
          feeCents: t.fee,
          netCents: t.net,
          createdAt: iso(t.created),
        }
      })
    }
    payouts.push({ id: po.id, arrivalDate: iso(po.arrival_date), amountCents: po.amount, status: po.status, lines })
  }
  payouts.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate))

  // Stripe-Gebühren des Monats (alle Buchungen im Monat, unabhängig von der Auszahlung)
  const feeTxns = await listAll<Stripe.BalanceTransaction>(after => stripe.balanceTransactions.list({
    limit: 100, created: { gte, lt }, ...(after ? { starting_after: after } : {}),
  }) as Promise<Stripe.ApiList<Stripe.BalanceTransaction & { id: string }>>)
  const stripeFees = feeTxns.filter(t => monthKey(t.created) === month).reduce((s, t) => s + t.fee, 0)
    + feeTxns.filter(t => monthKey(t.created) === month && t.type === 'stripe_fee').reduce((s, t) => s - t.amount, 0)

  const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0)
  return {
    month,
    invoices,
    creditNotes,
    payouts,
    totals: {
      invoiceGross: sum(invoices, i => i.grossCents),
      invoiceTax: sum(invoices, i => i.taxCents),
      invoiceNet: sum(invoices, i => i.netCents),
      creditGross: sum(creditNotes, c => c.grossCents),
      creditVat: sum(creditNotes, c => c.vatCents),
      stripeFees,
      payoutTotal: sum(payouts, p => p.amountCents),
    },
  }
}

/** Monate von heute rückwärts bis zum Start (erste Stripe-Rechnung 2026) */
export function monthsSince(first: string, now = new Date()): string[] {
  const out: string[] = []
  let cur = monthKey(now)
  while (cur >= first) {
    out.push(cur)
    const [y, m] = cur.split('-').map(Number)
    cur = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  }
  return out
}

const eur = (c: number) => (c / 100).toFixed(2).replace('.', ',')
const csvCell = (v: string | number | null) => {
  const t = v == null ? '' : String(v)
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}
const csv = (rows: (string | number | null)[][]) => '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n')
const deDate = (isoStr: string) => new Date(isoStr).toLocaleDateString('de-DE', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })

export function invoicesCsv(d: MonthDocs): string {
  return csv([
    ['Zahlungsdatum', 'Rechnungsnummer', 'Kunde', 'E-Mail', 'Netto (€)', 'USt (€)', 'Brutto (€)', 'Datei'],
    ...d.invoices.map(i => [deDate(i.paidAt), i.number, i.customerName, i.customerEmail, eur(i.netCents), eur(i.taxCents), eur(i.grossCents), `Rechnungen/${fileSafe(i.number)}.pdf`]),
  ])
}

export function creditNotesMonthCsv(d: MonthDocs): string {
  return csv([
    ['Datum', 'Gutschrift-Nr.', 'Partner', 'Netto (€)', 'USt (€)', 'Brutto (€)', 'Weg', 'Datei'],
    ...d.creditNotes.map(c => [c.date.split('-').reverse().join('.'), c.number, c.partner, eur(c.netCents), eur(c.vatCents), eur(c.grossCents),
      c.method === 'credit' ? 'Verrechnung mit Abo' : 'Überweisung', `Gutschriften/${c.number}.pdf`]),
  ])
}

export function payoutsCsv(d: MonthDocs): string {
  const rows: (string | number | null)[][] = [['Auszahlung', 'Auf dem Konto am', 'Auszahlungsbetrag (€)', 'Art', 'Beschreibung', 'Referenz', 'Betrag (€)', 'Stripe-Gebühr (€)', 'Netto (€)', 'Gebucht am']]
  for (const p of d.payouts) {
    if (p.lines.length === 0) rows.push([p.id, deDate(p.arrivalDate), eur(p.amountCents), '', '', '', '', '', '', ''])
    for (const l of p.lines) {
      rows.push([p.id, deDate(p.arrivalDate), eur(p.amountCents), TYPE_LABEL[l.type] ?? l.type, l.description, l.source, eur(l.grossCents), eur(l.feeCents), eur(l.netCents), deDate(l.createdAt)])
    }
  }
  return csv(rows)
}

const TYPE_LABEL: Record<string, string> = {
  charge: 'Zahlung', payment: 'Zahlung', refund: 'Erstattung', payment_refund: 'Erstattung',
  adjustment: 'Korrektur', stripe_fee: 'Stripe-Gebühr', transfer: 'Partner-Überweisung (Connect)',
  dispute: 'Rückbuchung', application_fee: 'Gebühr',
}

export const fileSafe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, '-')

export function summaryText(d: MonthDocs): string {
  const t = d.totals
  return [
    `Belege ${monthLabel(d.month)} – FinestSites`,
    '',
    `Ausgangsrechnungen (nach Zahlungseingang): ${d.invoices.length}`,
    `  Brutto ${eur(t.invoiceGross)} €  ·  Netto ${eur(t.invoiceNet)} €  ·  USt ${eur(t.invoiceTax)} €`,
    `Partner-Gutschriften: ${d.creditNotes.length}`,
    `  Brutto ${eur(t.creditGross)} €  ·  davon USt (Vorsteuer) ${eur(t.creditVat)} €`,
    `Stripe-Gebühren im Monat: ${eur(t.stripeFees)} €  (Gebührenrechnung von Stripe: Dashboard → Einstellungen → Dokumente)`,
    `Stripe-Auszahlungen aufs Bankkonto: ${d.payouts.length}, zusammen ${eur(t.payoutTotal)} €  (Aufschlüsselung: Auszahlungen.csv)`,
    '',
    'Hinweis: Die Auszahlungen sind Geldtransit (Stripe → Bank), keine zusätzlichen Einnahmen.',
  ].join('\r\n')
}
