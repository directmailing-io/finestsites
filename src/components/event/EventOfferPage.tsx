import { inArray, and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userSites } from '@/lib/db/schema'
import { getActiveCampaign, toPublicCampaign } from '@/lib/billing/campaign'
import type { PublicCampaign } from '@/lib/billing/campaign-shared'
import { getEventConfig } from '@/lib/event/config'
import { EVENT_CSS } from './event-styles'
import EventOfferClient, { type DemoSite } from './EventOfferClient'

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

  let demoSites: DemoSite[] = event.demoSites.map(s => ({ ...s, thumbUrl: null }))
  try {
    const rows = await db.query.userSites.findMany({
      where: and(inArray(userSites.customDomain, event.demoSites.map(s => s.domain)), eq(userSites.status, 'published')),
      columns: { customDomain: true, thumbUrl: true },
    })
    demoSites = event.demoSites.map(s => ({ ...s, thumbUrl: rows.find(r => r.customDomain === s.domain)?.thumbUrl ?? null }))
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
