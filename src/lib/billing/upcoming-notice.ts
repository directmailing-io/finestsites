/**
 * Ankündigung vor einer Abo-Verlängerung (Konzept docs/billing/vorabankuendigung-konzept.html, 05.11.2026).
 *
 * Grundsatz: Wie im Fitnessstudio – gleichbleibende Monatsbeiträge werden ohne eigene Mail
 * abgebucht. Die gesetzlich nötige SEPA-Vorabankündigung jeder einzelnen Lastschrift verschickt
 * Stripe selbst (Stripe-Gläubiger-ID, nicht abschaltbar). Eine eigene, nüchterne Mail gibt es nur
 * dort, wo die Kartenregeln von Visa/Mastercard sie verlangen bzw. eine Rücklastschrift teuer wird:
 *  - Jahresabo-Verlängerung (Visa Europa: > 6 Monate seit der letzten Belastung; Mastercard ≥ 180 Tage)
 *  - höherer Betrag als bei der letzten Verlängerung (Rabatt endet, Tarif höher, Preisänderung)
 * Niedrigere Beträge (z. B. Partner-Gutschrift über das Stripe-Guthaben, kleinerer Tarif) lösen
 * nichts aus. Verglichen wird `total` (nach Rabatten, vor Guthaben), damit Gutschriften nie zählen.
 */
export type UpcomingNoticeReason = 'yearly' | 'increase'

export function upcomingNoticeReason(input: {
  interval: 'monthly' | 'yearly'
  /** total der kommenden Rechnung in Cent (nach Rabatten, vor Guthaben) */
  upcomingTotal: number
  /** total der letzten bezahlten Verlängerungs-/Startrechnung in Cent; null = unbekannt */
  lastCycleTotal: number | null
  /** Jahresabo mit bestellter 14-Tage-Erinnerung (lifecycle-notifications) – die reicht */
  renewalReminderOptIn: boolean
}): UpcomingNoticeReason | null {
  if (input.upcomingTotal <= 0) return null
  if (input.interval === 'yearly') return input.renewalReminderOptIn ? null : 'yearly'
  // Unbekannt oder 0 € (Pause: dafür gibt es die Mail „Deine Pause endet“) → keine eigene Mail
  if (input.lastCycleTotal == null || input.lastCycleTotal <= 0) return null
  return input.upcomingTotal > input.lastCycleTotal ? 'increase' : null
}

/** Rechnungsgründe, die einen regulären Abo-Betrag tragen (keine anteiligen Tarifwechsel-Rechnungen) */
export const CYCLE_BILLING_REASONS = new Set(['subscription_cycle', 'subscription_create'])
