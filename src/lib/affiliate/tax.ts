/**
 * Steuerliche Regeln für Partner-Auszahlungen (Gutschriften), ohne Server-Abhängigkeiten,
 * damit Dashboard (Client) und API dieselbe Prüfung und dieselbe Rechnung verwenden.
 *
 *  - Provision = 10 % vom Rechnungs-NETTO (wird beim Buchen berechnet, hier nur summiert).
 *  - regelbesteuert  → Auszahlung = Netto + 19 % USt (kaufmännisch gerundet, je Beleg).
 *  - kleinunternehmer → keine USt, Hinweis § 19 UStG.
 *  - Es gibt nur Unternehmer (keine Privatpersonen): jeder Beleg ist eine „Gutschrift“.
 *  - Rückbuchungen (negative Zeilen) mindern das Netto VOR der USt.
 */

export type TaxStatus = 'kleinunternehmer' | 'regelbesteuert'
export const TAX_STATUSES: TaxStatus[] = ['kleinunternehmer', 'regelbesteuert']

export function isTaxStatus(v: unknown): v is TaxStatus {
  return typeof v === 'string' && (TAX_STATUSES as string[]).includes(v)
}

/** USt-Satz für regelbesteuerte Partner (Inland). */
export const VAT_RATE_STANDARD = 0.19
export const VAT_RATE_PERCENT = 19

/** Version der Einwilligungstexte – bei jeder Textänderung hochzählen. */
export const TAX_CONSENT_VERSION = '2026-10-16'

export const TAX_CONSENT_TEXT =
  'Ich bin einverstanden, dass FinestSites meine Provisionen per Gutschrift abrechnet (§ 14 Abs. 2 Satz 2 UStG). Ich prüfe jede Gutschrift und melde mich sofort, wenn etwas nicht stimmt.'
export const ENTREPRENEUR_CONFIRMATION_TEXT =
  'Ich handle als Unternehmer (§ 14 BGB) im Rahmen meiner selbständigen Tätigkeit.'

/** Gespeicherter Nachweistext: beide Bestätigungen, so wie sie angezeigt wurden. */
export const TAX_CONSENT_STORED_TEXT = `${ENTREPRENEUR_CONFIRMATION_TEXT}\n${TAX_CONSENT_TEXT}`

export const TAX_STATUS_LABEL: Record<TaxStatus, string> = {
  kleinunternehmer: 'Kleinunternehmer (§ 19 UStG)',
  regelbesteuert: 'Unternehmer mit Umsatzsteuer',
}

// ─── Eingaben ─────────────────────────────────────────────────────────────────

export interface TaxProfileInput {
  taxStatus: TaxStatus | null
  fullName: string
  street: string
  zip: string
  city: string
  /** Steuernummer ODER USt-IdNr. in einem Feld (wird automatisch erkannt) */
  taxId: string
}

export const VAT_ID_RE = /^DE\d{9}$/

/** USt-IdNr. normalisieren: Leerzeichen raus, Großbuchstaben. */
export function normalizeVatId(raw: string): string {
  return raw.replace(/[\s.-]/g, '').toUpperCase()
}

/** Steuernummer: 10–13 Ziffern, Schrägstriche und Leerzeichen erlaubt. */
export function isValidTaxNumber(raw: string): boolean {
  const s = raw.trim()
  if (!/^[\d/ ]+$/.test(s)) return false
  const digits = s.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 13
}

/** Erkennt, ob im Feld eine USt-IdNr. oder eine Steuernummer steht. */
export function classifyTaxId(raw: string): { vatId: string | null; taxNumber: string | null } {
  const trimmed = raw.trim()
  if (!trimmed) return { vatId: null, taxNumber: null }
  const asVat = normalizeVatId(trimmed)
  if (/^[A-Z]{2}/.test(asVat)) return { vatId: VAT_ID_RE.test(asVat) ? asVat : null, taxNumber: null }
  return { vatId: null, taxNumber: isValidTaxNumber(trimmed) ? trimmed.replace(/\s+/g, ' ') : null }
}

/** Steuernummer oder USt-IdNr. ist immer Pflicht (nur Unternehmer). */
export function needsTaxId(status: TaxStatus | null): boolean {
  return status === 'kleinunternehmer' || status === 'regelbesteuert'
}

/** Feld → Fehlermeldung (leer = alles gut). Gleiche Prüfung im Browser und auf dem Server. */
export function validateTaxProfile(input: TaxProfileInput): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!input.taxStatus) errors.taxStatus = 'Bitte wähle aus, was auf dich zutrifft.'
  const name = input.fullName.trim()
  if (name.length < 3) errors.fullName = 'Bitte gib deinen vollständigen Namen oder Firmennamen ein.'
  else if (name.length > 120) errors.fullName = 'Der Name ist zu lang (höchstens 120 Zeichen).'
  const street = input.street.trim()
  if (street.length < 3 || !/\d/.test(street)) errors.street = 'Bitte gib Straße und Hausnummer ein.'
  else if (street.length > 120) errors.street = 'Die Straße ist zu lang.'
  if (!/^\d{5}$/.test(input.zip.trim())) errors.zip = 'Die Postleitzahl hat 5 Ziffern.'
  const city = input.city.trim()
  if (city.length < 2) errors.city = 'Bitte gib deinen Ort ein.'
  else if (city.length > 80) errors.city = 'Der Ort ist zu lang.'
  if (input.taxStatus) {
    const raw = input.taxId.trim()
    if (!raw) {
      errors.taxId = 'Bitte gib deine Steuernummer oder USt-IdNr. ein.'
    } else {
      const { vatId, taxNumber } = classifyTaxId(raw)
      if (!vatId && !taxNumber) {
        errors.taxId = /^[A-Za-z]{2}/.test(raw)
          ? 'Die USt-IdNr. sieht so aus: DE und 9 Ziffern, z. B. DE123456789.'
          : 'Die Steuernummer hat 10 bis 13 Ziffern, z. B. 123/456/78901.'
      }
    }
  }
  return errors
}

/** Profil-Daten, wie sie in der DB liegen (für die Vollständigkeitsprüfung vor einer Auszahlung). */
export interface StoredTaxProfile {
  taxStatus: string | null
  fullName: string | null
  street: string | null
  zip: string | null
  city: string | null
  country: string | null
  taxNumber: string | null
  vatId: string | null
  consentAt: Date | string | null
  consentVersion: string | null
  entrepreneurConfirmed: boolean | null
}

export function isTaxProfileComplete(p: StoredTaxProfile | null | undefined): boolean {
  if (!p || !isTaxStatus(p.taxStatus) || !p.consentAt || !p.consentVersion || !p.entrepreneurConfirmed) return false
  const errors = validateTaxProfile({
    taxStatus: p.taxStatus,
    fullName: p.fullName ?? '',
    street: p.street ?? '',
    zip: p.zip ?? '',
    city: p.city ?? '',
    taxId: p.vatId ?? p.taxNumber ?? '',
  })
  return Object.keys(errors).length === 0
}

// ─── Beträge ──────────────────────────────────────────────────────────────────

/** Kaufmännisch runden (half up) für Cent-Beträge ≥ 0: USt = round(netto × Satz). */
export function vatCents(netCents: number, ratePercent: number): number {
  if (!Number.isInteger(netCents)) throw new Error('netCents must be an integer')
  if (netCents <= 0 || ratePercent <= 0) return 0
  // Integer-Arithmetik, keine Float-Fehler: (netto × Satz + 50) / 100 abgerundet
  return Math.floor((netCents * ratePercent + 50) / 100)
}

export interface PayoutAmounts {
  netCents: number
  vatCents: number
  grossCents: number
  /** z. B. 0.19 oder 0 */
  vatRate: number
}

/** Netto = Summe aller Provisionszeilen (inkl. Rückbuchungen), dann USt je Beleg. */
export function computePayoutAmounts(commissionCents: number[], status: TaxStatus): PayoutAmounts {
  const netCents = commissionCents.reduce((s, c) => s + c, 0)
  const ratePercent = status === 'regelbesteuert' ? VAT_RATE_PERCENT : 0
  const vat = vatCents(netCents, ratePercent)
  return { netCents, vatCents: vat, grossCents: netCents + vat, vatRate: ratePercent / 100 }
}

/** 1234 → „12,34 €“ (fest, ohne Intl-Abhängigkeit, für PDF/CSV identisch). */
export function formatEuro(cents: number): string {
  const neg = cents < 0
  const abs = Math.abs(cents)
  const euros = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const rest = (abs % 100).toString().padStart(2, '0')
  return `${neg ? '-' : ''}${euros},${rest} €`
}

/** Datum → „16.10.2026“ in deutscher Zeit (Europe/Berlin). */
export function formatDateDE(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' })
}
