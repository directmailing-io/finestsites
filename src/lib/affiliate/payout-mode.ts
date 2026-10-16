/**
 * Wie bekommt der Partner seine Provision? (ohne Server-Abhängigkeiten, auch im Browser nutzbar)
 *
 *  - 'credit' (Standard): monatlich als Kundenguthaben (Stripe customer balance) auf das eigene
 *    FinestSites-Abo; wird automatisch mit den nächsten Rechnungen verrechnet. Kein Geldabfluss,
 *    keine Bankverbindung nötig. Mindestbetrag 1 €, kleinere Beträge sammeln sich an.
 *  - 'payout': Überweisung über Stripe Connect, ab 10 € einmal im Monat.
 *
 * Gutschrift (§ 14 Abs. 2 Satz 2 UStG) gibt es in beiden Fällen, Steuerprofil ist Pflicht.
 */

export type PayoutMode = 'credit' | 'payout'
export const PAYOUT_MODES: PayoutMode[] = ['credit', 'payout']
export const DEFAULT_PAYOUT_MODE: PayoutMode = 'credit'

export function isPayoutMode(v: unknown): v is PayoutMode {
  return typeof v === 'string' && (PAYOUT_MODES as string[]).includes(v)
}

/** Unter 1 € wird nicht verrechnet (der Betrag bleibt stehen und sammelt sich an). */
export const CREDIT_MINIMUM_CENTS = 100

/** Wert in affiliate_payouts.payout_method */
export const PAYOUT_METHOD_CREDIT = 'credit'
export const PAYOUT_METHOD_TRANSFER = 'stripe_connect'

export function isCreditMethod(method: string | null | undefined): boolean {
  return method === PAYOUT_METHOD_CREDIT
}

/** Kurzlabel für Partner („Verrechnet“ / „Ausgezahlt“) und Admin („Verrechnung“ / „Überweisung“). */
export function methodLabelPartner(method: string | null | undefined): string {
  return isCreditMethod(method) ? 'Verrechnet' : 'Ausgezahlt'
}
export function methodLabelAdmin(method: string | null | undefined): string {
  return isCreditMethod(method) ? 'Verrechnung' : 'Überweisung'
}

/** Abo-Status, unter dem eine Verrechnung sicher bei der nächsten Rechnung ankommt. */
const CREDIT_SUBSCRIPTION_STATUSES = ['active', 'trialing']

export interface CreditEligibilityInput {
  stripeCustomerId: string | null
  subscriptionStatus: string | null
  cancelAtPeriodEnd: boolean | null
  deactivatedAt: Date | string | null
}

/**
 * Verrechnen nur, wenn wirklich noch Rechnungen kommen: aktives Abo, Stripe-Kunde vorhanden,
 * nicht zum Laufzeitende gekündigt und Konto nicht pausiert. Sonst bliebe das Guthaben
 * bei Stripe liegen, ohne dass der Partner etwas davon hat.
 */
export function isCreditEligible(u: CreditEligibilityInput): boolean {
  return !!u.stripeCustomerId
    && CREDIT_SUBSCRIPTION_STATUSES.includes(u.subscriptionStatus ?? '')
    && !u.cancelAtPeriodEnd
    && !u.deactivatedAt
}
