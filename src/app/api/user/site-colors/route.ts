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
    .select({ id: userSites.id, title: templates.title, domain: templates.domain, schema: templates.placeholderSchema })
    .from(userSites)
    .leftJoin(templates, eq(templates.id, userSites.templateId))
    .where(and(eq(userSites.userId, user.id), inArray(userSites.status, ['draft', 'published'])))
  if (sites.length === 0) return NextResponse.json({ colors: [] })

  const rows = await db
    .select({ siteId: siteData.userSiteId, value: siteData.fieldValue })
    .from(siteData)
    .where(and(inArray(siteData.userSiteId, sites.map(s => s.id)), eq(siteData.fieldKey, 'farbthema')))

  /** Farbe einer Vorgabe (card_options.color) aus dem Template-Schema, z. B. „gruen“ → #2F8650 */
  function presetHex(schema: unknown, value: string): string | null {
    const fields = (schema as { fields?: { key: string; card_options?: { value: string; color?: string }[] }[] } | null)?.fields ?? []
    const color = fields.find(f => f.key === 'farbthema')?.card_options?.find(o => o.value === value)?.color ?? ''
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : null
  }

  const byHex = new Map<string, { id: string; label: string }[]>()
  for (const r of rows) {
    const site = sites.find(s => s.id === r.siteId)
    if (!site) continue
    // eigene Farbe oder Vorgabe: beides zählt, damit alle Seiten dieselbe Farbe bekommen können
    const hex = effectiveBrandColor({ farbthema: r.value ?? '', markenfarbe: me?.brandColor ?? '' }) ?? presetHex(site.schema, (r.value ?? '').trim())
    if (!hex) continue
    const list = byHex.get(hex) ?? []
    list.push({ id: site.id, label: shortTitle(site.title, site.domain) })
    byHex.set(hex, list)
  }
  return NextResponse.json({ colors: [...byHex.entries()].map(([hex, s]) => ({ hex, sites: s })) })
}
