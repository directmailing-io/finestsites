/**
 * Feste Regeln der Kontolöschung (rein, ohne Abhängigkeiten – auch im Test-Skript nutzbar).
 *
 * Aufbewahrung (deutsches Recht, Fristbeginn jeweils mit Ende des Kalenderjahres, § 147 Abs. 4 AO):
 *   - Gutschriften (Provisionsabrechnungen) als Buchungsbelege: 8 Jahre (§ 147 Abs. 1 Nr. 4, Abs. 3 AO;
 *     § 14b Abs. 1 UStG)
 *   - Provisions- und Auszahlungsbuchungen als Aufzeichnungen: 10 Jahre (§ 147 Abs. 1 Nr. 1, Abs. 3 AO)
 *   - Rechnungen an Kunden liegen in Stripe (dort aufbewahrt), nicht in unserer Datenbank.
 * Offenes Partner-Guthaben ohne Auszahlungskonto: auf Anfrage auszahlbar bis zur Verjährung
 *   (3 Jahre, § 195 BGB, Beginn mit Jahresende, § 199 Abs. 1 BGB).
 */
import { DELETION_GRACE_DAYS } from '@/lib/contracts/app-v1/account-deletion'

export { DELETION_GRACE_DAYS }

export const RETENTION_YEARS_CREDIT_NOTE = 8
export const RETENTION_YEARS_BOOKINGS = 10
export const LIMITATION_YEARS = 3

/** Grabstein-Adresse eines gelöschten Kontos (eindeutig, nie zustellbar – .invalid ist reserviert, RFC 2606). */
export function tombstoneEmail(userId: string): string {
  return `deleted-${userId}@deleted.invalid`
}

export function isTombstoneEmail(email: string | null | undefined): boolean {
  return !!email && /@deleted\.invalid$/i.test(email)
}

export function graceEnd(from: Date, days: number = DELETION_GRACE_DAYS): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
}

/** 31.12. des Jahres (Jahr von `d`, deutsche Zeit) + `years` als YYYY-MM-DD. */
export function endOfYearPlus(d: Date | string, years: number): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const year = Number(date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 4))
  return `${year + years}-12-31`
}

export function formatDateLongDe(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' })
}

export function formatEurDe(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}
