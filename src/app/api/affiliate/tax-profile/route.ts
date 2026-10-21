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
import { isTaxProfileComplete } from '@/lib/affiliate/tax'
import { taxProfileErrors, taxProfileInput, upsertTaxProfile } from '@/lib/affiliate/tax-profile-store'

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

  const input = taxProfileInput({
    taxStatus: body.tax_status, fullName: body.full_name, street: body.street,
    zip: body.zip, city: body.city, taxId: body.tax_id,
  })
  const errors = taxProfileErrors(input, body.entrepreneur_confirmed, body.consent)
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Bitte prüfe deine Angaben.', errors }, { status: 400 })
  }

  const saved = await upsertTaxProfile(user.id, input, getClientIp(req))

  return NextResponse.json(toJson(saved))
}
