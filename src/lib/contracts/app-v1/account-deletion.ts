/**
 * Konto löschen (Apple 5.1.1(v), Google Play „Konto löschen“) – /api/app/v1/account/deletion; das
 * Web-Gegenstück /api/account/deletion liefert dieselben Formen.
 *
 *   GET    → DeletionStatusResponse (Bedenkzeit, Partner-Guthaben, ob gelöscht werden darf, Laufzeit-Option)
 *   POST   → DeletionRequestBody → DeletionRequestResponse (Passwort nötig)
 *   DELETE → DeletionCancelResponse (Löschung abbrechen, nur solange sie vorgemerkt ist)
 *
 * Zwei Wege (timing):
 *   'now'        Seiten sofort offline, Abo sofort beendet – bereits bezahlte Zeit wird NICHT erstattet –,
 *                überall abgemeldet, Löschung nach DELETION_GRACE_DAYS Tagen.
 *   'period_end' Nur mit laufendem bezahltem Abo (periodEnd.available): Abo zum Ende des bezahlten Zeitraums
 *                gekündigt, Seiten bleiben bis dahin online, Konto bleibt voll nutzbar (nur Tarifkauf gesperrt),
 *                Löschung zum Laufzeitende (frühestens nach DELETION_GRACE_DAYS Tagen). Abbruch stellt das Abo
 *                wieder her. Keine Erstattung in beiden Fällen.
 *
 * Fehlercodes: INVALID_PASSWORD (400), BALANCE_CHOICE_REQUIRED (400), PERIOD_END_NOT_AVAILABLE (400),
 * VALIDATION_FAILED (400), DELETION_NOT_ALLOWED (403), DELETION_ALREADY_REQUESTED (409), NO_DELETION_PENDING (409).
 * Nur zod – keine Next-/Drizzle-Importe, die App kann diese Datei 1:1 nutzen.
 */
import { z } from 'zod'
import { Cents, IsoDateTime } from './common'

export const DELETION_GRACE_DAYS = 14

/** Was mit offenem Partner-Guthaben passieren soll: Schlussauszahlung oder ausdrücklicher Verzicht. */
export const BalanceChoice = z.enum(['payout', 'waive'])
export type BalanceChoice = z.infer<typeof BalanceChoice>

/** Zeitpunkt der Löschung: sofort oder zum Ende des bezahlten Abrechnungszeitraums. */
export const DeletionTiming = z.enum(['now', 'period_end'])
export type DeletionTiming = z.infer<typeof DeletionTiming>

export const DeletionStatusResponse = z.object({
  /** 'none' = keine Anfrage, 'scheduled' = Löschung vorgemerkt */
  status: z.enum(['none', 'scheduled']),
  requestedAt: IsoDateTime.nullable(),
  scheduledFor: IsoDateTime.nullable(),
  /** Weg der laufenden Anfrage; null ohne Anfrage. 'now' sperrt Dashboard/App bis auf „Löschung abbrechen“. */
  mode: DeletionTiming.nullable(),
  graceDays: z.number().int().positive(),
  /** false z. B. beim Admin-Konto; die App zeigt dann nur einen Hinweis */
  canDelete: z.boolean(),
  /** disabled = Selbst-Löschung noch nicht freigeschaltet (app_settings account_deletion_enabled) → Hinweis auf info@ */
  blockedReason: z.enum(['admin', 'disabled']).nullable(),
  /** Option „zum Laufzeitende“: nur mit laufendem, bezahltem Abo ohne Zahlungsstörung. */
  periodEnd: z.object({
    available: z.boolean(),
    /** Ende des bezahlten Zeitraums = frühester Löschtermin dieser Option (mindestens graceDays ab heute) */
    at: IsoDateTime.nullable(),
  }),
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
  /** Standard 'now'. 'period_end' nur, wenn periodEnd.available – sonst PERIOD_END_NOT_AVAILABLE. */
  timing: DeletionTiming.optional(),
  /** Pflicht, sobald partnerBalance.totalCents > 0 */
  balanceChoice: BalanceChoice.nullable().optional(),
  /** Bei 'waive' Pflicht: der Nutzer hat den Verzicht ausdrücklich bestätigt (Wortlaut kommt vom Server) */
  waiverConfirmed: z.boolean().optional(),
})
export type DeletionRequestBody = z.infer<typeof DeletionRequestBody>

export const DeletionRequestResponse = z.object({
  status: z.literal('scheduled'),
  mode: DeletionTiming,
  scheduledFor: IsoDateTime,
  /** true nur bei 'now': alle Sitzungen sind beendet – die App meldet sich lokal ab. */
  signedOut: z.boolean(),
})
export type DeletionRequestResponse = z.infer<typeof DeletionRequestResponse>

export const DeletionCancelResponse = z.object({
  status: z.literal('none'),
  /** Seiten sind offline (Weg 'now' oder Laufzeit schon abgelaufen) und müssen neu veröffentlicht werden. */
  sitesOffline: z.boolean(),
  /** Das Abo läuft wie vorher weiter (Weg 'period_end', Laufzeit noch nicht vorbei). */
  subscriptionContinues: z.boolean(),
})
export type DeletionCancelResponse = z.infer<typeof DeletionCancelResponse>

/** Wortlaut der Verzichtserklärung (wird genau so in account_deletion_requests gespeichert). */
export function waiverText(totalCents: number): string {
  const eur = (Math.max(0, totalCents) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
  return `Ich verzichte auf mein Guthaben von ${eur} aus dem FinestSites-Partnerprogramm, einschließlich noch nicht verfügbarer Provisionen und eines bereits gutgeschriebenen, noch nicht verrechneten Guthabens. Mir ist klar, dass dieser Verzicht nach der Löschung meines Kontos nicht rückgängig gemacht werden kann.`
}
