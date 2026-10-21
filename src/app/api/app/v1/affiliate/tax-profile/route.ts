/**
 * GET /api/app/v1/affiliate/tax-profile — Angaben für die Abrechnung per Gutschrift.
 * PUT /api/app/v1/affiliate/tax-profile — speichern; gleiche Prüfung, Normalisierung und
 *     Einverständnis-Nachweis wie /api/affiliate/tax-profile (src/lib/affiliate/tax-profile-store.ts).
 *     Fehler: 400 VALIDATION_FAILED + `fields` (Feld → Hinweis).
 */
import { db } from '@/lib/db'
import { affiliateTaxProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { getClientIp, rateLimit } from '@/lib/security/request'
import { appError, appJson, readJson, toIso } from '@/lib/app-api/http'
import { requireAffiliateUser } from '@/lib/app-api/affiliate'
import { isTaxProfileComplete } from '@/lib/affiliate/tax'
import { taxProfileErrors, taxProfileInput, upsertTaxProfile } from '@/lib/affiliate/tax-profile-store'
import { TaxProfileResponse, UpdateTaxProfileRequest } from '@/lib/contracts/app-v1/affiliate'

export const dynamic = 'force-dynamic'

type Row = typeof affiliateTaxProfiles.$inferSelect

function toBody(p: Row | undefined | null) {
  if (!p) return { profile: null, complete: false }
  return {
    profile: {
      taxStatus: p.taxStatus === 'kleinunternehmer' ? 'kleinunternehmer' as const : 'regelbesteuert' as const,
      fullName: p.fullName ?? '',
      street: p.street ?? '',
      zip: p.zip ?? '',
      city: p.city ?? '',
      country: p.country ?? 'DE',
      taxId: p.vatId ?? p.taxNumber ?? '',
      entrepreneurConfirmed: !!p.entrepreneurConfirmed,
      consentAt: toIso(p.consentAt),
      consentVersion: p.consentVersion ?? null,
      updatedAt: toIso(p.updatedAt),
    },
    complete: isTaxProfileComplete(p),
  }
}

export async function GET(req: Request) {
  const a = await requireAffiliateUser(req, 'affiliate-tax-profile', 60)
  if (a.response) return a.response
  const p = await db.query.affiliateTaxProfiles.findFirst({ where: eq(affiliateTaxProfiles.userId, a.user.id) })
  return appJson(TaxProfileResponse, toBody(p))
}

export async function PUT(req: Request) {
  const a = await requireAffiliateUser(req, 'affiliate-tax-profile-put', 30)
  if (a.response) return a.response
  // Einverständnis gibt nur der Partner selbst – nicht der Support im „Anmelden als“-Modus
  const real = await getRealUserFromRequest(req).catch(() => null)
  if (!real || real.id !== a.user.id) return appError('NOT_SELF')
  // Gleiches Limit wie im Web (10 Versuche in 10 Minuten, gemeinsamer Zähler)
  if (!rateLimit('tax-profile-put', a.user.id, 10, 10 * 60_000)) return appError('RATE_LIMITED')

  const body = await readJson(req, UpdateTaxProfileRequest)
  if (body.response) return body.response
  const b = body.data

  const input = taxProfileInput({ taxStatus: b.taxStatus, fullName: b.fullName, street: b.street, zip: b.zip, city: b.city, taxId: b.taxId })
  const errors = taxProfileErrors(input, b.entrepreneurConfirmed, b.consent)
  if (Object.keys(errors).length > 0) return appError('VALIDATION_FAILED', 'Bitte prüfe deine Angaben.', 400, errors)

  const saved = await upsertTaxProfile(a.user.id, input, getClientIp(req))
  return appJson(TaxProfileResponse, toBody(saved))
}
