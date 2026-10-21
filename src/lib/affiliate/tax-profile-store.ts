/**
 * Steuerprofil speichern – gemeinsame Logik für Web (/api/affiliate/tax-profile) und App
 * (/api/app/v1/affiliate/tax-profile). Gleiche Prüfung, gleiche Normalisierung, gleicher Nachweis.
 */
import { db } from '@/lib/db'
import { affiliateTaxProfiles } from '@/lib/db/schema'
import {
  validateTaxProfile, classifyTaxId, isTaxStatus,
  TAX_CONSENT_VERSION, TAX_CONSENT_STORED_TEXT, type TaxProfileInput,
} from '@/lib/affiliate/tax'

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Rohwerte (z. B. aus dem JSON-Body) in die Eingabe übernehmen, Längen begrenzen. */
export function taxProfileInput(raw: {
  taxStatus: unknown; fullName: unknown; street: unknown; zip: unknown; city: unknown; taxId: unknown
}): TaxProfileInput {
  return {
    taxStatus: isTaxStatus(raw.taxStatus) ? raw.taxStatus : null,
    fullName: str(raw.fullName),
    street: str(raw.street),
    zip: str(raw.zip, 10),
    city: str(raw.city),
    taxId: str(raw.taxId, 40),
  }
}

/** Feld → Fehlermeldung inkl. der beiden Bestätigungen (leer = alles gut). */
export function taxProfileErrors(input: TaxProfileInput, entrepreneurConfirmed: unknown, consent: unknown): Record<string, string> {
  const errors = validateTaxProfile(input)
  if (entrepreneurConfirmed !== true) errors.entrepreneurConfirmed = 'Bitte bestätige, dass du als Unternehmer handelst.'
  if (consent !== true) errors.consent = 'Bitte setze den Haken beim Einverständnis.'
  return errors
}

/** Geprüftes Profil speichern (Einverständnis mit Zeit, Version, Text und IP). */
export async function upsertTaxProfile(userId: string, input: TaxProfileInput, ip: string | null) {
  const { vatId, taxNumber } = classifyTaxId(input.taxId)
  const now = new Date()
  const values = {
    taxStatus: input.taxStatus!,
    fullName: input.fullName.trim().replace(/\s+/g, ' '),
    street: input.street.trim().replace(/\s+/g, ' '),
    zip: input.zip.trim(),
    city: input.city.trim().replace(/\s+/g, ' '),
    country: 'DE',
    vatId,
    taxNumber,
    entrepreneurConfirmed: true,
    consentAt: now,
    consentVersion: TAX_CONSENT_VERSION,
    consentText: TAX_CONSENT_STORED_TEXT,
    consentIp: ip?.slice(0, 64) ?? null,
    updatedAt: now,
  }

  const [saved] = await db.insert(affiliateTaxProfiles)
    .values({ userId, ...values, createdAt: now })
    .onConflictDoUpdate({ target: affiliateTaxProfiles.userId, set: values })
    .returning()
  return saved
}
