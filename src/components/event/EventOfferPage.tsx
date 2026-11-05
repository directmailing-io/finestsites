import { inArray, and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { templates, users, userSites } from '@/lib/db/schema'
import { getActiveCampaign, toPublicCampaign } from '@/lib/billing/campaign'
import type { PublicCampaign } from '@/lib/billing/campaign-shared'
import { getEventConfig } from '@/lib/event/config'
import { EVENT_CSS } from './event-styles'
import EventOfferClient, { type DemoSite } from './EventOfferClient'

/** Benutzername des Demo-Kontos, dessen veröffentlichte Seiten als Beispiele dienen */
const DEMO_USERNAME = 'demo'

function previewCampaign(code: string): PublicCampaign {
  const endsAt = new Date(Date.now() + 4 * 86400_000 + 12 * 3600_000).toISOString()
  return { code, percentOff: 20, amountOff: null, duration: 'repeating', durationInMonths: 3, interval: 'both', endsAt }
}

/**
 * Event-Seite „Angebot sichern“ (Server): lädt den laufenden Aktionscode aus Stripe (nur der aus
 * der Event-Konfiguration zählt) und die Vorschaubilder der Beispielseiten. Alles Weitere im Client.
 */
export default async function EventOfferPage({ slug, canceled, preview }: { slug: string; canceled?: boolean; preview?: boolean }) {
  const event = getEventConfig(slug)
  if (!event) return null

  const active = await getActiveCampaign()
  let campaign = active && active.code === event.code ? toPublicCampaign(active) : null
  // Nur lokal (nie in Produktion): ?vorschau=1 zeigt den laufenden Countdown ohne Stripe-Code
  if (!campaign && preview && process.env.NODE_ENV !== 'production') campaign = previewCampaign(event.code)

  // Die Beispielseiten sind die veröffentlichten Seiten des Demo-Kontos je Vorlage (templates.domain,
  // z. B. dailyoptimal.de); ihre Vorschaubilder kommen aus user_sites.thumb_url.
  let demoSites: DemoSite[] = event.demoSites.map(s => ({ ...s, thumbUrl: null }))
  try {
    const rows = await db
      .select({ domain: templates.domain, thumbUrl: userSites.thumbUrl })
      .from(userSites)
      .innerJoin(templates, eq(templates.id, userSites.templateId))
      .innerJoin(users, eq(users.id, userSites.userId))
      .where(and(eq(users.username, DEMO_USERNAME), inArray(templates.domain, event.demoSites.map(s => s.domain)), eq(userSites.status, 'published')))
    demoSites = event.demoSites.map(s => ({ ...s, thumbUrl: rows.find(r => r.domain === s.domain)?.thumbUrl ?? null }))
  } catch (e) {
    console.error('[event] demo thumbs:', e instanceof Error ? e.message : e)
  }

  return (
    <div className="ev">
      <style dangerouslySetInnerHTML={{ __html: EVENT_CSS }} />
      <header className="ev-head">
        <a href="https://finestsites.io" aria-label="FinestSites">
          <img src="/logos/logo-black.svg" alt="FinestSites" width={160} height={26} />
        </a>
      </header>
      <div className="ev-rule" />
      <main className="ev-main">
        <EventOfferClient event={event} campaign={campaign} demoSites={demoSites} canceled={!!canceled} />
      </main>
      <footer className="ev-foot">
        Nur für Unternehmer · Alle Preise inkl. MwSt.
        <div style={{ marginTop: 8 }}>
          <a href="https://finestsites.io/impressum">Impressum</a>
          <a href="https://finestsites.io/datenschutz">Datenschutz</a>
          <a href="https://finestsites.io/agb">AGB</a>
        </div>
      </footer>
    </div>
  )
}
