/**
 * Storno-Planung für Provisionen bei Erstattung/Rückbuchung (reine Logik, ohne DB).
 *
 * Regeln:
 * - Vollständige Erstattung / Chargeback:
 *     noch nicht ausgezahlt (pending/available) → Status 'cancelled'
 *     schon ausgezahlt (paid)                   → negative Ausgleichsbuchung, die mit
 *                                                 künftigen Provisionen verrechnet wird
 * - Teilerstattung: Provision anteilig (erstatteter Anteil der Charge) kürzen –
 *     pending/available → Betrag in der Zeile kürzen
 *     paid              → negative Ausgleichsbuchung über den Differenzbetrag
 *
 * - Bestehende Ausgleichszeilen ("<inv>:…", nicht storniert) zählen immer mit – auch wenn
 *   die Zeile wieder pending/available ist (Gegenbuchung während 'processing', Auszahlung
 *   danach gescheitert). So wird nie doppelt storniert.
 * - Gewonnener Chargeback → planDisputeRestore (positive Zeile "<inv>:dispute_won").
 *
 * Idempotent: Stripe meldet bei charge.refunded den KUMULIERTEN Erstattungsbetrag.
 * Ziel-Storno = floor(Originalprovision × erstattet / gesamt); gebucht wird nur die
 * Differenz zu dem, was bereits storniert ist. Wiederholte Zustellungen ändern nichts.
 */

export type CommissionRowLite = {
  id: string
  status: string
  stripeInvoiceId: string
  commissionAmount: number
  grossAmount: number
  netAmount: number | null
  commissionRate: string | number
  reversalReason: string | null
}

export type ReversalAction =
  | { type: 'cancel'; id: string; reason: string }
  | { type: 'reduce'; id: string; commissionAmount: number; reason: string }
  | {
      type: 'book'
      key: string
      commissionAmount: number // negativ
      grossAmount: number // negativ
      netAmount: number | null // negativ
      reason: string
    }

/** Ursprüngliche Provision der Zeile (vor Teilstornos), in Cent. null = nicht rekonstruierbar. */
export function originalCommission(row: CommissionRowLite): number | null {
  const bps = Math.round(Number(row.commissionRate) * 10000)
  if (row.netAmount != null && row.netAmount > 0 && bps > 0) {
    return Math.max(Math.floor((row.netAmount * bps) / 10000), row.commissionAmount)
  }
  // Altzeilen ohne Netto: nur rekonstruierbar, solange noch nie gekürzt wurde
  return row.reversalReason ? null : row.commissionAmount
}

type ReversalRowLite = Pick<CommissionRowLite, 'commissionAmount' | 'status'>

/** Netto über Ausgleichszeilen storniert (negativ = storniert, positiv = wieder gutgeschrieben), Cent, >= 0. */
function netBookedReversals(rows: ReversalRowLite[]): number {
  const sum = rows.filter(r => r.status !== 'cancelled').reduce((s, r) => s - r.commissionAmount, 0)
  return Math.max(0, sum)
}

export function planReversal(params: {
  invoiceId: string
  base: CommissionRowLite
  /** bereits vorhandene Ausgleichsbuchungen zu dieser Rechnung (stripe_invoice_id = "<inv>:…") */
  existingReversals: ReversalRowLite[]
  /** erstatteter Betrag (kumuliert) und Gesamtbetrag der Charge, Cent; refunded >= total = voll */
  refunded: number
  total: number
  reason: string
}): ReversalAction[] {
  const { invoiceId, base, existingReversals, reason } = params
  const total = Math.max(0, Math.floor(params.total))
  const refunded = Math.max(0, Math.floor(params.refunded))
  const full = total <= 0 || refunded >= total
  if (!full && refunded <= 0) return []
  // 'waived' = Partner hat bei der Kontolöschung verzichtet → nichts mehr zu stornieren
  if (base.status === 'cancelled' || base.status === 'reversed' || base.status === 'waived' || base.commissionAmount <= 0) return []

  const orig = originalCommission(base)
  if (orig == null) {
    // Nicht rekonstruierbar → nur Vollstorno ist sicher möglich
    if (!full) return []
  }
  const original = orig ?? base.commissionAmount
  const target = full ? original : Math.floor((original * refunded) / total)
  // Netto bereits über Ausgleichszeilen storniert (Gegenbuchungen minus Wiedergutschriften,
  // z. B. ":dispute_won"). Nie negativ.
  const bookedBefore = netBookedReversals(existingReversals)

  if (base.status === 'pending' || base.status === 'available') {
    // Gab es schon eine Gegenbuchung (Erstattung während 'processing', Auszahlung danach
    // gescheitert → Zeile wieder 'available'), zählt sie mit: Zeile + Gegenbuchungen
    // sollen zusammen genau (original − target) ergeben, nicht doppelt storniert werden.
    const newAmount = original - target + bookedBefore
    if (newAmount <= 0) return [{ type: 'cancel', id: base.id, reason }]
    if (newAmount < base.commissionAmount) {
      return [{ type: 'reduce', id: base.id, commissionAmount: newAmount, reason: full ? reason : `${reason}_partial` }]
    }
    return []
  }

  // 'processing' = gerade in einer laufenden Auszahlung: wie 'paid' behandeln (Gegenbuchung).
  // Scheitert die Auszahlung, heben sich Provision und Gegenbuchung beim nächsten Lauf auf.
  if (base.status === 'paid' || base.status === 'processing') {
    const alreadyReversed = (original - base.commissionAmount) + bookedBefore
    const delta = target - alreadyReversed
    if (delta <= 0) return []
    const share = (v: number) => Math.round((v * delta) / original)
    return [{
      type: 'book',
      key: full ? `${invoiceId}:chargeback` : `${invoiceId}:refund:${refunded}`,
      commissionAmount: -delta,
      grossAmount: -share(base.grossAmount),
      netAmount: base.netAmount == null ? null : -share(base.netAmount),
      reason: `${reason}_after_payout`,
    }]
  }
  return []
}

/**
 * Gewonnener Chargeback (charge.dispute.funds_reinstated / charge.dispute.closed = won):
 * Die durch die Rückbuchung stornierte Provision wird als positive Zeile
 * "<inv>:dispute_won" wieder gutgeschrieben.
 *
 * Betrag = was die Rechnung nach dem Chargeback MEHR storniert hat, als die echten
 * Erstattungen allein rechtfertigen:
 *   soll  = original − floor(original × erstattet / gesamt)
 *   ist   = (Zeile, falls nicht storniert) + Summe der Ausgleichszeilen
 *   Gutschrift = soll − ist  (> 0)
 * Nur wenn ein Chargeback tatsächlich gebucht wurde (Grund "chargeback…" an der Zeile
 * oder Ausgleichszeile "<inv>:chargeback"). Wiederholte Zustellungen → 0 bzw. Konflikt.
 */
export function planDisputeRestore(params: {
  invoiceId: string
  base: CommissionRowLite
  /** alle Ausgleichszeilen zu dieser Rechnung inkl. Schlüssel */
  existingReversals: Array<ReversalRowLite & { stripeInvoiceId: string }>
  /** echte Erstattungen (charge.amount_refunded, ohne Dispute) und Gesamtbetrag der Charge, Cent */
  refunded: number
  total: number
}): Extract<ReversalAction, { type: 'book' }> | null {
  const { invoiceId, base, existingReversals } = params
  if (existingReversals.some(r => r.stripeInvoiceId === `${invoiceId}:dispute_won`)) return null
  const chargebackRow = existingReversals.find(r => r.stripeInvoiceId === `${invoiceId}:chargeback` && r.status !== 'cancelled')
  const chargebackOnBase = (base.reversalReason ?? '').startsWith('chargeback')
  if (!chargebackRow && !chargebackOnBase) return null

  const original = originalCommission(base) ?? base.commissionAmount
  if (original <= 0) return null
  const total = Math.max(0, Math.floor(params.total))
  const refunded = Math.max(0, Math.floor(params.refunded))
  const refundTarget = total <= 0 ? 0 : refunded >= total ? original : Math.floor((original * refunded) / total)
  const shouldRemain = original - refundTarget

  const baseEffective = base.status === 'cancelled' || base.status === 'reversed' || base.status === 'waived' ? 0 : base.commissionAmount
  const effective = baseEffective + existingReversals
    .filter(r => r.status !== 'cancelled')
    .reduce((s, r) => s + r.commissionAmount, 0)
  const restore = shouldRemain - effective
  if (restore <= 0) return null

  const share = (v: number) => Math.round((v * restore) / original)
  return {
    type: 'book',
    key: `${invoiceId}:dispute_won`,
    commissionAmount: restore,
    grossAmount: share(base.grossAmount),
    netAmount: base.netAmount == null ? null : share(base.netAmount),
    reason: 'dispute_won',
  }
}
