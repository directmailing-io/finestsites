/**
 * GET /api/user/site-colors
 * Eigene Farben, die der Nutzer auf seinen Seiten verwendet (Feld `farbthema` = `seite:#RRGGBB`, oder
 * `eigene` = Kontofarbe), gruppiert nach Farbe mit den Namen der Seiten. Für die Schnellauswahl
 * „Eigene Farbe“ im Editor, damit alle Seiten dieselbe Farbe bekommen können.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { siteData, templates, userSites, users } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { effectiveBrandColor } from '@/lib/color/brand-palette'

/** „Deine PM-Business-Seite“ → „PM-Business-Seite“, „Deine Vitalcheck-Seite“ → „Vitalcheck-Seite“ */
function shortTitle(title: string | null, domain: string | null): string {
  const raw = title ?? ''
  if (/linkseite/i.test(raw)) return 'Linkseite'
  const t = raw.replace(/^Deine\s+/i, '').replace(/\s*\(.*\)\s*$/, '').trim()
  return t || domain || 'Seite'
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [me] = await db.select({ brandColor: users.brandColor }).from(users).where(eq(users.id, user.id)).limit(1)
  const sites = await db
    .select({ id: userSites.id, title: templates.title, domain: templates.domain })
    .from(userSites)
    .leftJoin(templates, eq(templates.id, userSites.templateId))
    .where(and(eq(userSites.userId, user.id), inArray(userSites.status, ['draft', 'published'])))
  if (sites.length === 0) return NextResponse.json({ colors: [] })

  const rows = await db
    .select({ siteId: siteData.userSiteId, value: siteData.fieldValue })
    .from(siteData)
    .where(and(inArray(siteData.userSiteId, sites.map(s => s.id)), eq(siteData.fieldKey, 'farbthema')))

  const byHex = new Map<string, { id: string; label: string }[]>()
  for (const r of rows) {
    const hex = effectiveBrandColor({ farbthema: r.value ?? '', markenfarbe: me?.brandColor ?? '' })
    if (!hex) continue
    const site = sites.find(s => s.id === r.siteId)
    if (!site) continue
    const list = byHex.get(hex) ?? []
    list.push({ id: site.id, label: shortTitle(site.title, site.domain) })
    byHex.set(hex, list)
  }
  return NextResponse.json({ colors: [...byHex.entries()].map(([hex, s]) => ({ hex, sites: s })) })
}
