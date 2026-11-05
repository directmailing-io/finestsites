import type { Metadata } from 'next'
import EventOfferPage from '@/components/event/EventOfferPage'

// Event-Seite „Angebot sichern“ (Konzept docs/event/powerday-konzept.html). Inhalte: src/lib/event/config.ts.
// Nur per QR-Code/Link erreichbar, nicht für Google (noindex).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Powerday-Angebot – FinestSites',
  description: 'Angebot jetzt sichern, Webseite daheim bearbeiten.',
  robots: { index: false, follow: false },
}

export default async function PowerdayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  return <EventOfferPage slug="powerday" canceled={params.abgebrochen === '1'} preview={params.vorschau === '1'} />
}
