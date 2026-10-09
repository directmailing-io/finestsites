/**
 * Einstellungen → Werbung: Konfiguration lesen, speichern, löschen.
 * Tokens werden verschlüsselt gespeichert und nie zurückgegeben (nur „hinterlegt: ja/nein“).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trackingConfigs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { encryptSecret } from '@/lib/tracking/crypto'
import * as v from '@/lib/tracking/validate'
import { publishedSitesWithUrls } from '@/lib/tracking/config'

function view(c: typeof trackingConfigs.$inferSelect | undefined) {
  if (!c) return null
  return {
    metaPixelId: c.metaPixelId ?? '',
    metaTokenSet: !!c.metaTokenEnc,
    googleAdsId: c.googleAdsId ?? '',
    googleLeadLabel: c.googleLeadLabel ?? '',
    googleContactLabel: c.googleContactLabel ?? '',
    tiktokPixelId: c.tiktokPixelId ?? '',
    tiktokTokenSet: !!c.tiktokTokenEnc,
    siteIds: c.siteIds ?? null,
    events: c.events ?? { contact: true, lead: true },
    confirmed: !!c.confirmedAt,
    lastSend: c.lastSendAt ? { at: c.lastSendAt, platform: c.lastSendPlatform, status: c.lastSendStatus, error: c.lastSendError } : null,
    firstLeadAt: c.firstLeadAt,
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const cfg = await db.query.trackingConfigs.findFirst({ where: eq(trackingConfigs.userId, user.id) })
  const sites = await publishedSitesWithUrls(user.id)
  return NextResponse.json({ config: view(cfg), sites })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })

  const existing = await db.query.trackingConfigs.findFirst({ where: eq(trackingConfigs.userId, user.id) })

  // Felder, die im Body fehlen (undefined), bleiben wie gespeichert — jede Plattform speichert für sich.
  const keep = (key: keyof typeof body, current: string | null | undefined) => body[key] === undefined ? (current ?? '') : body[key]
  let values: Partial<typeof trackingConfigs.$inferInsert>
  try {
    const metaPixelId = v.metaPixelId(keep('metaPixelId', existing?.metaPixelId))
    const googleAdsId = v.googleAdsId(keep('googleAdsId', existing?.googleAdsId))
    const googleLeadLabel = v.googleLabel(keep('googleLeadLabel', existing?.googleLeadLabel), 'googleLeadLabel')
    const googleContactLabel = v.googleLabel(keep('googleContactLabel', existing?.googleContactLabel), 'googleContactLabel')
    const tiktokPixelId = v.tiktokPixelId(keep('tiktokPixelId', existing?.tiktokPixelId))
    if (googleAdsId && !googleLeadLabel) throw new v.TrackingInputError('googleLeadLabel', 'Zu Google Ads gehört ein Conversion-Label für „Anfrage“. Es steht direkt neben der Conversion-ID.')
    if (!googleAdsId && googleLeadLabel) throw new v.TrackingInputError('googleAdsId', 'Bitte auch die Conversion-ID (AW-…) eintragen.')

    // Tokens: leer lassen = unverändert, „-“ = entfernen, sonst neu setzen
    const tokenField = (raw: unknown, parse: (x: unknown) => string, current: string | null): string | null => {
      const s = String(raw ?? '')
      if (s === '') return current
      if (s === '-') return null
      return encryptSecret(parse(s))
    }
    const metaTokenEnc = metaPixelId ? tokenField(body.metaToken, v.metaToken, existing?.metaTokenEnc ?? null) : null
    const tiktokTokenEnc = tiktokPixelId ? tokenField(body.tiktokToken, v.tiktokToken, existing?.tiktokTokenEnc ?? null) : null

    const siteIds = body.siteIds === undefined ? (existing?.siteIds ?? null) : Array.isArray(body.siteIds) ? body.siteIds.filter((x): x is string => typeof x === 'string').slice(0, 50) : null
    const ev = (body.events && typeof body.events === 'object') ? body.events as Record<string, unknown> : null
    const events = ev
      ? { contact: ev.contact !== false, lead: ev.lead !== false }
      : (existing?.events ?? { contact: true, lead: true })
    const anyPlatform = !!(metaPixelId || googleAdsId || tiktokPixelId)
    if (anyPlatform && body.confirmed !== true && !existing?.confirmedAt) {
      throw new v.TrackingInputError('confirmed', 'Bitte bestätige, dass du für dein Werbekonto und die Datenschutzangaben verantwortlich bist.')
    }
    values = {
      metaPixelId: metaPixelId || null, metaTokenEnc,
      googleAdsId: googleAdsId || null, googleLeadLabel: googleLeadLabel || null, googleContactLabel: googleContactLabel || null,
      tiktokPixelId: tiktokPixelId || null, tiktokTokenEnc,
      siteIds,
      events,
      confirmedAt: anyPlatform ? (existing?.confirmedAt ?? new Date()) : null,
      updatedAt: new Date(),
    }
  } catch (err) {
    if (err instanceof v.TrackingInputError) return NextResponse.json({ field: err.field, error: err.message }, { status: 400 })
    throw err
  }

  const [saved] = existing
    ? await db.update(trackingConfigs).set(values).where(eq(trackingConfigs.userId, user.id)).returning()
    : await db.insert(trackingConfigs).values({ userId: user.id, ...values }).returning()
  return NextResponse.json({ config: view(saved) })
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await db.delete(trackingConfigs).where(eq(trackingConfigs.userId, user.id))
  return NextResponse.json({ ok: true })
}
