import type { BillingInterval, PlanKey } from '@/lib/plans'

/**
 * Event-/Aktionsseiten („Angebot sichern beim Live-Event“, Konzept docs/event/powerday-konzept.html).
 *
 * Für ein neues Event: einen Eintrag hier ergänzen, eine Route `src/app/<slug>/page.tsx` (3 Zeilen,
 * siehe src/app/powerday/page.tsx) und `/<slug>` in FINESTSITES_IO_PATHS (src/middleware.ts) eintragen.
 * Dazu in Stripe einen aktiven Gutscheincode (Admin → Gutscheine, OHNE „Aktion“/sitewide: der Rabatt
 * soll nur auf der Event-Seite erscheinen, nie auf der Startseite), dessen Code hier unter `code`
 * steht. Ablauf des Codes = Ende des Angebots = Countdown auf der Seite.
 * Ist der Code abgelaufen oder inaktiv, zeigt die Seite die normalen Preise und eine Hinweiszeile.
 *
 * Diese Datei ist auch für Client-Komponenten sicher (keine Server-Importe).
 */
export interface EventConfig {
  /** URL-Pfad, z. B. „powerday“ → finestsites.io/powerday */
  slug: string
  /** Name des Events, erscheint als Zeile über dem Countdown und in Texten */
  name: string
  /** Stripe-Gutscheincode (nicht sitewide), dessen Ablauf das Angebot beendet */
  code: string
  /** Überschrift der Seite (zwei Sätze, Zeilenumbruch mit \n) */
  headline: string
  /** Satz unter der Überschrift */
  subline: string
  /** Tarif, der groß gezeigt wird */
  recommendedPlan: PlanKey
  /** Vorgewähltes Intervall */
  defaultInterval: BillingInterval
  /** Beschreibung des empfohlenen Tarifs in der Karte */
  planTitle: string
  planText: string
  /** Veröffentlichte Beispielseiten (eigene Domain) für „So sehen fertige Seiten aus“ */
  demoSites: { domain: string; label: string }[]
  /** Hinweiszeile, wenn der Code abgelaufen ist */
  endedText: string
}

export const EVENTS: Record<string, EventConfig> = {
  powerday: {
    slug: 'powerday',
    name: 'Powerday',
    code: 'POWERDAY20',
    headline: 'Angebot jetzt sichern.\nWebseite daheim bearbeiten.',
    subline: 'Du zahlst heute mit dem Handy und richtest deine Webseite später in Ruhe ein. Wir zeigen dir danach Schritt für Schritt, wie es weitergeht.',
    recommendedPlan: 'pro',
    defaultInterval: 'yearly',
    planTitle: 'Optimalset, PM-Business und cellRESET',
    planText: 'Die drei Seiten, die ein PM-Partner braucht. Fertige Texte, fertiges Design, du trägst nur deine Daten ein.',
    demoSites: [
      { domain: 'dailyoptimal.de', label: 'Optimalset' },
      { domain: 'wellpreneur.io', label: 'PM-Business' },
      { domain: 'cellrestart.net', label: 'cellRESET' },
    ],
    endedText: 'Das Powerday-Angebot ist beendet. Du kannst trotzdem starten, dann zum normalen Preis.',
  },
}

export function getEventConfig(slug: string): EventConfig | null {
  return EVENTS[slug] ?? null
}

/** Marketing-Adresse der Event-Seite (für Teilen, Mail, Rücksprung aus Stripe) */
export function eventPageUrl(event: EventConfig): string {
  return `https://finestsites.io/${event.slug}`
}
