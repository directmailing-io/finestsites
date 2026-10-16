/**
 * Provisionsbasis einer Stripe-Rechnung (rein, ohne DB/Stripe-Zugriff → testbar).
 *
 * Basis = steuerfreier Nettobetrag der Rechnung (total_excluding_tax, sonst total − Steuer),
 * NACH Rabatten. Kundenguthaben (customer balance, z. B. verrechnete Partnerprovision im
 * Verrechnungsmodus) ist ein ZAHLUNGSMITTEL, kein Rabatt: Eine voll mit Guthaben (oder teils
 * Guthaben, teils Karte/SEPA) beglichene Rechnung zählt als voll bezahlt.
 *
 * Stripe-Semantik (Invoice):
 *  - starting_balance / ending_balance: Kundenguthaben vor/nach der Rechnung, in Cent;
 *    NEGATIV = Guthaben des Kunden, positiv = offene Schuld. ending_balance ist null,
 *    solange die Rechnung nicht finalisiert ist.
 *  - angewandtes Guthaben = ending_balance − starting_balance (z. B. −500 → 0 ⇒ 500 Cent).
 *  - amount_due = total − angewandtes Guthaben (+ evtl. Schuld); amount_paid enthält das
 *    Guthaben NICHT (bei voll gedeckter Rechnung: amount_due = amount_paid = 0).
 * Echte Teilzahlungen (z. B. Gutschrift vor Zahlung) skalieren die Basis anteilig.
 * Reine Ganzzahl-Rechnung (Cent).
 */

export interface InvoiceAmounts {
  amount_paid?: number | null
  total?: number | null
  total_excluding_tax?: number | null
  tax?: number | null
  total_taxes?: Array<{ amount?: number | null }> | null
  starting_balance?: number | null
  ending_balance?: number | null
}

/** Mit Kundenguthaben beglichener Betrag (Cent, ≥ 0). */
export function invoiceCreditApplied(inv: InvoiceAmounts): number {
  const start = inv.starting_balance ?? 0
  const end = inv.ending_balance
  if (start >= 0 || typeof end !== 'number') return 0
  const applied = Math.min(end, 0) - start
  return applied > 0 ? Math.min(applied, -start) : 0
}

/** Tatsächlich beglichener Betrag (Zahlung + Guthaben), höchstens der Rechnungsbetrag. */
export function invoiceSettledAmount(inv: InvoiceAmounts): number {
  const settled = (inv.amount_paid ?? 0) + invoiceCreditApplied(inv)
  const total = inv.total ?? settled
  return total > 0 ? Math.min(settled, total) : settled
}

/** Nettobasis der Provision (Cent). */
export function computeInvoiceNet(inv: InvoiceAmounts): number {
  const settled = (inv.amount_paid ?? 0) + invoiceCreditApplied(inv)
  if (settled <= 0) return 0
  const total = inv.total ?? settled
  let netTotal: number
  if (typeof inv.total_excluding_tax === 'number') {
    netTotal = inv.total_excluding_tax
  } else {
    const taxCents = typeof inv.tax === 'number'
      ? inv.tax
      : Array.isArray(inv.total_taxes)
        ? inv.total_taxes.reduce((s, t) => s + (t?.amount ?? 0), 0)
        : 0
    netTotal = total - taxCents
  }
  if (netTotal <= 0) return 0
  if (settled >= total || total === 0) return netTotal
  return Math.floor((netTotal * settled) / total)
}

/** 10 % Provision auf die Nettobasis — Ganzzahl-Division, keine Floats. */
export function commissionFromNet(netCents: number): number {
  return netCents > 0 ? Math.floor(netCents / 10) : 0
}
