import { getCampaignByCode, toPublicCampaign } from '@/lib/billing/campaign'
import type { PublicCampaign } from '@/lib/billing/campaign-shared'
import { getEventConfig } from '@/lib/event/config'
import { EVENT_CSS } from './event-styles'
import { loadDemoSites } from './demo-sites'
import EventOfferClient from './EventOfferClient'

function previewCampaign(code: string): PublicCampaign {
  const endsAt = new Date(Date.now() + 4 * 86400_000 + 12 * 3600_000).toISOString()
  return { code, percentOff: 20, amountOff: null, duration: 'repeating', durationInMonths: 3, interval: 'both', endsAt }
}

/**
 * Event-Seite „Angebot sichern“ (Server): lädt den Event-Code aus Stripe (nur der aus der
 * Event-Konfiguration, unabhängig von „sitewide“) und die Vorschaubilder der Beispielseiten.
 */
export default async function EventOfferPage({ slug, canceled, preview }: { slug: string; canceled?: boolean; preview?: boolean }) {
  const event = getEventConfig(slug)
  if (!event) return null

  // Nur der Event-Code zählt, und nur hier (nicht sitewide: die Startseite bleibt ohne Rabatt)
  let campaign = toPublicCampaign(await getCampaignByCode(event.code))
  // Nur lokal (nie in Produktion): ?vorschau=1 zeigt den laufenden Countdown ohne Stripe-Code
  if (!campaign && preview && process.env.NODE_ENV !== 'production') campaign = previewCampaign(event.code)

  const demoSites = await loadDemoSites(event)

  return (
    <div className="ev">
      <style dangerouslySetInnerHTML={{ __html: EVENT_CSS }} />
      <div className="ev-top" aria-hidden />
      <header className="ev-head">
        <a href="https://finestsites.io" aria-label="FinestSites">
          <img src="/logos/logo-black.svg" alt="FinestSites" width={160} height={26} />
        </a>
      </header>
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
