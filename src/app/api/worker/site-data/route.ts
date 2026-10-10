/**
 * GET /api/worker/site-data
 *
 * Internal endpoint called exclusively by the Cloudflare Worker during HTML rendering.
 * NOT intended for browser clients — protected by WORKER_SECRET.
 *
 * Purpose: Return all placeholder key/value pairs for a user site so the Worker
 * can substitute them into the template's HTML (e.g. {{business_name}} → "Muster GmbH").
 * This call happens on every KV cache miss for the rendered HTML. Once the Worker
 * has rendered and cached the result in KV (60s TTL), this endpoint is not hit again
 * until the cache expires or is explicitly purged.
 *
 * Query params:
 *   siteId — the user_site UUID
 *
 * Response (200):
 *   Array<{ fieldKey: string; fieldValue: string | null; html?: true }>
 *   html: true = Richtext laut Template-Schema → der Worker gibt den Wert roh (unescaped) aus
 *
 * Security: requests without the correct x-worker-secret header are rejected.
 * In development (WORKER_SECRET unset) all requests are allowed through.
 */

import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { siteData, userSites, users, templates } from '@/lib/db/schema'
import { rawKeysFromSchema } from '@/lib/utils/template-engine'
import { dropStaleTranslations } from '@/lib/utils/translate'
import { eq } from 'drizzle-orm'

const WORKER_SECRET = process.env.WORKER_SECRET

function checkSecret(req: NextRequest): boolean {
  if (!WORKER_SECRET) return false // fehlendes Secret = alles ablehnen (fail closed)
  const incoming = req.headers.get('x-worker-secret') ?? ''
  const a = Buffer.from(incoming)
  const b = Buffer.from(WORKER_SECRET)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const siteId = req.nextUrl.searchParams.get('siteId')
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 })
  }

  try {
    // Fetch all placeholder key/value pairs for this site
    // Entwurf ≠ Live: veröffentlichter Schnappschuss, falls vorhanden; sonst (alte Seiten) site_data
    const [snap] = await db.select({ publishedData: userSites.publishedData }).from(userSites).where(eq(userSites.id, siteId)).limit(1)
    const siteRows = snap?.publishedData
      ? Object.entries(snap.publishedData).map(([fieldKey, fieldValue]) => ({ fieldKey, fieldValue }))
      : await db
        .select({ fieldKey: siteData.fieldKey, fieldValue: siteData.fieldValue })
        .from(siteData)
        .where(eq(siteData.userSiteId, siteId))

    // Fetch user profile for legal pages (impressum/datenschutz)
    const [userInfo] = await db
      .select({ firstName: users.firstName, lastName: users.lastName, companyName: users.companyName, username: users.username, schema: templates.placeholderSchema })
      .from(userSites)
      .innerJoin(users, eq(userSites.userId, users.id))
      .innerJoin(templates, eq(userSites.templateId, templates.id))
      .where(eq(userSites.id, siteId))
    const rawKeys = rawKeysFromSchema(userInfo?.schema)

    const fullName = [userInfo?.firstName, userInfo?.lastName].filter(Boolean).join(' ').trim()
    const displayName = fullName || (userInfo?.username ? `Benutzer ${userInfo.username}` : 'Benutzer')

    // Übersetzungen nur, wenn sie zum aktuellen deutschen Text passen (sonst DE-Fallback)
    const rawMap: Record<string, string> = {}
    for (const r of siteRows) rawMap[r.fieldKey] = r.fieldValue ?? ''
    const fresh = dropStaleTranslations(rawMap)
    const liveRows = siteRows.filter(r => r.fieldKey in fresh)

    const rows = [
      ...liveRows.map(r => rawKeys.has(r.fieldKey) ? { ...r, html: true as const } : r),
      { fieldKey: 'user_first_name', fieldValue: userInfo?.firstName ?? '' },
      { fieldKey: 'user_last_name', fieldValue: userInfo?.lastName ?? '' },
      { fieldKey: 'user_username', fieldValue: userInfo?.username ?? '' },
      { fieldKey: 'user_display_name', fieldValue: displayName },
      // Firma aus dem Profil (global), für {{firma}} in Impressum/Datenschutz
      { fieldKey: 'firma', fieldValue: userInfo?.companyName?.trim() ?? '' },
    ]

    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
