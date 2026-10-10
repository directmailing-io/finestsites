/**
 * Veröffentlichter Stand einer Seite (Entwurf ≠ Live).
 * site_data ist der Entwurf (Editor). Beim Veröffentlichen wird daraus ein Schnappschuss in
 * user_sites.published_data eingefroren; der Worker liefert NUR diesen Schnappschuss aus.
 * Änderungen im Editor sind damit erst nach „Änderungen veröffentlichen“ online.
 */
import { db } from '@/lib/db'
import { siteData, userSites } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { dropStaleTranslations, isTranslationKey } from '@/lib/utils/translate'

export type SiteDataMap = Record<string, string>

/** Entwurfsdaten (site_data) als Map. */
export async function draftDataMap(siteId: string): Promise<SiteDataMap> {
  const rows = await db.select({ k: siteData.fieldKey, v: siteData.fieldValue }).from(siteData).where(eq(siteData.userSiteId, siteId))
  const map: SiteDataMap = {}
  for (const r of rows) map[r.k] = r.v ?? ''
  return map
}

/** Entwurf einfrieren → published_data. Gibt den Schnappschuss zurück. */
export async function snapshotPublishedData(siteId: string): Promise<SiteDataMap> {
  const map = dropStaleTranslations(await draftDataMap(siteId))
  await db.update(userSites).set({ publishedData: map, publishedDataAt: new Date() }).where(eq(userSites.id, siteId))
  return map
}

/**
 * Interne Schlüssel, die keine sichtbare Änderung sind: Prüf-Flags sowie Übersetzungen samt Hash.
 * Übersetzungen sind aus dem deutschen Text abgeleitet (Nachübersetzung per Cron schreibt sie in
 * Entwurf UND Schnappschuss); ändert sich der deutsche Text, unterscheidet sich der ohnehin.
 */
const isInternalKey = (k: string) => k.endsWith('__chk') || k.endsWith('__chkbase') || isTranslationKey(k)

/** Unterscheidet sich der Entwurf vom veröffentlichten Stand? */
export function differs(draft: SiteDataMap, published: SiteDataMap | null | undefined): boolean {
  if (!published) return false
  const keys = new Set([...Object.keys(draft), ...Object.keys(published)].filter(k => !isInternalKey(k)))
  for (const k of keys) if ((draft[k] ?? '') !== (published[k] ?? '')) return true
  return false
}

/** Für mehrere Seiten: { siteId → hat unveröffentlichte Änderungen } */
export async function unpublishedChangesFor(sites: { id: string; status: string; publishedData: SiteDataMap | null }[]): Promise<Record<string, boolean>> {
  const ids = sites.filter(s => s.status === 'published' && s.publishedData).map(s => s.id)
  const out: Record<string, boolean> = {}
  if (ids.length === 0) return out
  const rows = await db.select({ id: siteData.userSiteId, k: siteData.fieldKey, v: siteData.fieldValue }).from(siteData).where(inArray(siteData.userSiteId, ids))
  const drafts: Record<string, SiteDataMap> = {}
  for (const r of rows) (drafts[r.id] ??= {})[r.k] = r.v ?? ''
  for (const s of sites) if (ids.includes(s.id)) out[s.id] = differs(drafts[s.id] ?? {}, s.publishedData)
  return out
}
