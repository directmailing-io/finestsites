import { db } from '@/lib/db'
import { trackingConfigs, userSites, templates, users } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { decryptSecret } from './crypto'

import type { PublicTrackingConfig } from './types'
export type { PublicTrackingConfig }

export function toPublicConfig(c: typeof trackingConfigs.$inferSelect | undefined | null, siteId: string): PublicTrackingConfig | null {
  if (!c || !c.confirmedAt) return null
  if (Array.isArray(c.siteIds) && !c.siteIds.includes(siteId)) return null
  const ev = c.events ?? { contact: true, lead: true }
  const out: PublicTrackingConfig = { events: { contact: ev.contact !== false, lead: ev.lead !== false } }
  if (c.metaPixelId) out.meta = { pixelId: c.metaPixelId, server: !!c.metaTokenEnc }
  if (c.googleAdsId && c.googleLeadLabel) out.google = { adsId: c.googleAdsId, leadLabel: c.googleLeadLabel, ...(c.googleContactLabel ? { contactLabel: c.googleContactLabel } : {}) }
  if (c.tiktokPixelId) out.tiktok = { pixelId: c.tiktokPixelId, server: !!c.tiktokTokenEnc }
  return out.meta || out.google || out.tiktok ? out : null
}

/** Konfiguration zur Seite (über den Besitzer). */
export async function trackingForSite(siteId: string) {
  const [row] = await db
    .select({ cfg: trackingConfigs, siteId: userSites.id })
    .from(userSites)
    .innerJoin(trackingConfigs, eq(trackingConfigs.userId, userSites.userId))
    .where(eq(userSites.id, siteId))
    .limit(1)
  return row?.cfg ?? null
}

/** Entschlüsselte Tokens für den Worker (nur über den geschützten Worker-Endpunkt). */
export function secretsFor(c: typeof trackingConfigs.$inferSelect) {
  const safe = (enc: string | null) => { try { return enc ? decryptSecret(enc) : null } catch { return null } }
  return {
    metaPixelId: c.metaPixelId,
    metaToken: safe(c.metaTokenEnc),
    tiktokPixelId: c.tiktokPixelId,
    tiktokToken: safe(c.tiktokTokenEnc),
  }
}

/** Veröffentlichte Seiten eines Nutzers mit ihrer Adresse (für Anzeigen-Links und Seitenliste). */
export async function publishedSitesWithUrls(userId: string) {
  const rows = await db
    .select({
      id: userSites.id, status: userSites.status, customDomain: userSites.customDomain, customDomainStatus: userSites.customDomainStatus,
      templateTitle: templates.title, templateDomain: templates.domain, username: users.username,
    })
    .from(userSites)
    .innerJoin(templates, eq(templates.id, userSites.templateId))
    .innerJoin(users, eq(users.id, userSites.userId))
    .where(and(eq(userSites.userId, userId)))
  return rows.map(r => {
    const host = r.customDomain && r.customDomainStatus === 'active' ? r.customDomain : `${r.username}.${r.templateDomain}`
    return { id: r.id, status: r.status, title: r.templateTitle, host, url: `https://${host}` }
  })
}
