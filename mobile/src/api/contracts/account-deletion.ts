// GENERIERT von mobile/scripts/sync-contracts.mjs aus src/lib/contracts/app-v1/ – NICHT BEARBEITEN.
// Änderungen immer im Server-Vertrag machen und danach `npm run sync:contracts` ausführen.
/**
 * Konto löschen (Apple 5.1.1(v)) – /api/app/v1/account/deletion; das Web-Gegenstück
 * /api/account/deletion liefert dieselben Formen.
 *
 *   GET    → DeletionStatusResponse (Bedenkzeit, Partner-Guthaben, ob gelöscht werden darf)
 *   POST   → DeletionRequestBody → DeletionRequestResponse (Passwort nötig; alle Sitzungen enden)
 *   DELETE → DeletionCancelResponse (Löschung abbrechen, nur während der Bedenkzeit)
 *
 * Fehlercodes: INVALID_PASSWORD (400), BALANCE_CHOICE_REQUIRED (400), VALIDATION_FAILED (400),
 * DELETION_NOT_ALLOWED (403), DELETION_ALREADY_REQUESTED (409), NO_DELETION_PENDING (409).
 * Nur zod – keine Next-/Drizzle-Importe, die App kann diese Datei 1:1 nutzen.
 */
import { z } from 'zod'
import { Cents, IsoDateTime } from './common'

export const DELETION_GRACE_DAYS = 14

/** Was mit offenem Partner-Guthaben passieren soll: Schlussauszahlung oder ausdrücklicher Verzicht. */
export const BalanceChoice = z.enum(['payout', 'waive'])
export type BalanceChoice = z.infer<typeof BalanceChoice>

export const DeletionStatusResponse = z.object({
  /** 'none' = keine Anfrage, 'scheduled' = Bedenkzeit läuft */
  status: z.enum(['none', 'scheduled']),
  requestedAt: IsoDateTime.nullable(),
  scheduledFor: IsoDateTime.nullable(),
  graceDays: z.number().int().positive(),
  /** false z. B. beim Admin-Konto; die App zeigt dann nur einen Hinweis */
  canDelete: z.boolean(),
  /** disabled = Selbst-Löschung noch nicht freigeschaltet (app_settings account_deletion_enabled) → Hinweis auf info@ */
  blockedReason: z.enum(['admin', 'disabled']).nullable(),
  partnerBalance: z.object({
    currency: z.literal('EUR'),
    /** sofort auszahlbar (Haltefrist vorbei) */
    availableCents: Cents,
    /** noch in der Haltefrist – wird nach Ablauf genauso behandelt */
    pendingCents: Cents,
    /** schon gutgeschriebenes, noch nicht verrechnetes Kundenguthaben (Verrechnung mit dem eigenen Abo) */
    customerCreditCents: Cents,
    /** available + pending + customerCredit (nie negativ); > 0 → balanceChoice ist Pflicht */
    totalCents: Cents,
    /** Auszahlungskonto (Stripe Connect) eingerichtet */
    hasPayoutAccount: z.boolean(),
    /** Angaben für die Abrechnung vollständig (ohne sie keine Auszahlung) */
    taxProfileComplete: z.boolean(),
    /** gewählte Option der laufenden Anfrage */
    choice: BalanceChoice.nullable(),
    /** genauer Wortlaut der Verzichtserklärung für den aktuellen Betrag */
    waiverText: z.string(),
  }),
})
export type DeletionStatusResponse = z.infer<typeof DeletionStatusResponse>

export const DeletionRequestBody = z.object({
  password: z.string().min(1).max(512),
  /** Pflicht, sobald partnerBalance.totalCents > 0 */
  balanceChoice: BalanceChoice.nullable().optional(),
  /** Bei 'waive' Pflicht: der Nutzer hat den Verzicht ausdrücklich bestätigt (Wortlaut kommt vom Server) */
  waiverConfirmed: z.boolean().optional(),
})
export type DeletionRequestBody = z.infer<typeof DeletionRequestBody>

export const DeletionRequestResponse = z.object({
  status: z.literal('scheduled'),
  scheduledFor: IsoDateTime,
  /** Alle Sitzungen sind beendet – die App meldet sich lokal ab. */
  signedOut: z.literal(true),
})
export type DeletionRequestResponse = z.infer<typeof DeletionRequestResponse>

export const DeletionCancelResponse = z.object({
  status: z.literal('none'),
  /** Seiten bleiben offline, bis sie neu veröffentlicht werden; ein beendetes Abo kommt nicht von selbst zurück. */
  sitesOffline: z.boolean(),
})
export type DeletionCancelResponse = z.infer<typeof DeletionCancelResponse>

/** Wortlaut der Verzichtserklärung (wird genau so in account_deletion_requests gespeichert). */
export function waiverText(totalCents: number): string {
  const eur = (Math.max(0, totalCents) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
  return `Ich verzichte auf mein Guthaben von ${eur} aus dem FinestSites-Partnerprogramm, einschließlich noch nicht verfügbarer Provisionen und eines bereits gutgeschriebenen, noch nicht verrechneten Guthabens. Mir ist klar, dass dieser Verzicht nach der Löschung meines Kontos nicht rückgängig gemacht werden kann.`
}
