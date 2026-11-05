import { inArray, and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { templates, users, userSites } from '@/lib/db/schema'
import type { EventConfig } from '@/lib/event/config'

/** Benutzername des Demo-Kontos, dessen veröffentlichte Seiten als Beispiele dienen */
export const DEMO_USERNAME = 'demo'

export interface DemoSite { domain: string; label: string; url: string; thumbUrl: string | null }

/**
 * Beispielseiten eines Events (Server): die veröffentlichten Seiten des Demo-Kontos je Vorlage
 * (templates.domain, z. B. dailyoptimal.de) mit ihren Vorschaubildern (user_sites.thumb_url).
 * Verlinkt wird demo.<vorlagen-domain>. Ohne Treffer bleibt thumbUrl null; wirft nie.
 */
export async function loadDemoSites(event: EventConfig): Promise<DemoSite[]> {
  const url = (domain: string) => `https://${DEMO_USERNAME}.${domain}`
  try {
    const rows = await db
      .select({ domain: templates.domain, thumbUrl: userSites.thumbUrl })
      .from(userSites)
      .innerJoin(templates, eq(templates.id, userSites.templateId))
      .innerJoin(users, eq(users.id, userSites.userId))
      .where(and(eq(users.username, DEMO_USERNAME), inArray(templates.domain, event.demoSites.map(s => s.domain)), eq(userSites.status, 'published')))
    return event.demoSites.map(s => ({ ...s, url: url(s.domain), thumbUrl: rows.find(r => r.domain === s.domain)?.thumbUrl ?? null }))
  } catch (e) {
    console.error('[event] demo thumbs:', e instanceof Error ? e.message : e)
    return event.demoSites.map(s => ({ ...s, url: url(s.domain), thumbUrl: null }))
  }
}
