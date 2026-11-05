import type { Metadata } from 'next'
import EventThanksPage from '@/components/event/EventThanksPage'

// Danke-Seite nach dem Event-Kauf (Stripe success_url, läuft auf app.finestsites.io, damit die
// Anmeldung nach dem Passwort direkt hier funktioniert).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Dein Angebot ist gesichert – FinestSites',
  robots: { index: false, follow: false },
}

export default async function PowerdayThanksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const sessionId = typeof params.session_id === 'string' ? params.session_id : ''
  return <EventThanksPage slug="powerday" sessionId={sessionId} preview={params.vorschau === '1'} />
}
