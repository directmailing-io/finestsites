/**
 * GET/PUT /api/affiliate/tax-profile
 * Angaben des Partners für die Abrechnung per Gutschrift (§ 14 Abs. 2 Satz 2 UStG).
 * Nur Unternehmer: Kleinunternehmer (§ 19 UStG) oder regelbesteuert.
 * Änderungen gelten nur für künftige Auszahlungen (jede Auszahlung speichert einen Snapshot).
 */

import { NextResponse } from 'next/server'
import { getUserFromRequest, getRealUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { affiliateTaxProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getClientIp, rateLimit } from '@/lib/security/request'
import {
  validateTaxProfile, classifyTaxId, isTaxStatus, isTaxProfileComplete,
  TAX_CONSENT_VERSION, TAX_CONSENT_STORED_TEXT, type TaxProfileInput,
} from '@/lib/affiliate/tax'

function toJson(p: typeof affiliateTaxProfiles.$inferSelect | undefined) {
  if (!p) return { profile: null, complete: false }
  return {
    profile: {
      tax_status: p.taxStatus,
      full_name: p.fullName,
      street: p.street,
      zip: p.zip,
      city: p.city,
      country: p.country,
      tax_id: p.vatId ?? p.taxNumber ?? '',
      entrepreneur_confirmed: p.entrepreneurConfirmed,
      consent_at: p.consentAt,
      consent_version: p.consentVersion,
      updated_at: p.updatedAt,
    },
    complete: isTaxProfileComplete(p),
  }
}

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit('tax-profile-get', user.id, 60, 60_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte kurz.' }, { status: 429 })
  }
  const p = await db.query.affiliateTaxProfiles.findFirst({ where: eq(affiliateTaxProfiles.userId, user.id) })
  return NextResponse.json(toJson(p))
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')

export async function PUT(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Einverständnis gibt nur der Partner selbst – nicht ein Admin im „Anmelden als“-Modus.
  const real = await getRealUserFromRequest(req)
  if (!real || real.id !== user.id) {
    return NextResponse.json({ error: 'Diese Angaben kann nur der Partner selbst bestätigen.' }, { status: 403 })
  }

  if (!rateLimit('tax-profile-put', user.id, 10, 10 * 60_000)) {
    return NextResponse.json({ error: 'Zu viele Versuche. Bitte warte ein paar Minuten.' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const input: TaxProfileInput = {
    taxStatus: isTaxStatus(body.tax_status) ? body.tax_status : null,
    fullName: str(body.full_name),
    street: str(body.street),
    zip: str(body.zip, 10),
    city: str(body.city),
    taxId: str(body.tax_id, 40),
  }
  const errors = validateTaxProfile(input)
  if (body.entrepreneur_confirmed !== true) errors.entrepreneurConfirmed = 'Bitte bestätige, dass du als Unternehmer handelst.'
  if (body.consent !== true) errors.consent = 'Bitte setze den Haken beim Einverständnis.'
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Bitte prüfe deine Angaben.', errors }, { status: 400 })
  }

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
    consentIp: getClientIp(req)?.slice(0, 64) ?? null,
    updatedAt: now,
  }

  const [saved] = await db.insert(affiliateTaxProfiles)
    .values({ userId: user.id, ...values, createdAt: now })
    .onConflictDoUpdate({ target: affiliateTaxProfiles.userId, set: values })
    .returning()

  return NextResponse.json(toJson(saved))
}
