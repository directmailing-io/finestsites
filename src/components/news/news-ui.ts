import type { NewsCtaKind } from '@/lib/contracts/app-v1/news'

/** Farben und Radien wie in der App (`mobile/src/theme/tokens.ts`). */
export const NEWS_TOKENS = {
  accent: '#7C3AED',
  accentSoft: '#F5F0FB',
  accentSoftBorder: '#E4D7F5',
  ink: '#111827',
  body: '#374151',
  secondary: '#64748B',
  tertiary: '#94A3B8',
  line: '#E2E8F0',
  cardRadius: 24,
  heroGradient: 'linear-gradient(135deg, #7C3AED 0%, #C4B5FD 100%)',
} as const

/** Web-Route je Knopf-Ziel (interne Ziele); `url` wird extern geöffnet. */
export const NEWS_CTA_ROUTES: Record<Exclude<NewsCtaKind, 'url'>, string> = {
  sites: '/sites',
  submissions: '/submissions',
  chats: '/chats',
  affiliate: '/affiliate',
  settings: '/settings',
}

/** Beschriftung der Ziele im Admin-Select. */
export const NEWS_CTA_KIND_LABELS: Record<NewsCtaKind, string> = {
  sites: 'Meine Webseiten',
  submissions: 'Anfragen',
  chats: 'Chats',
  affiliate: 'Partnerbereich',
  settings: 'Einstellungen',
  url: 'Eigener Link',
}

/** „4. November 2026“ */
export function formatNewsDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** „04.11.26, 09:41“ für Admin-Tabellen. */
export function formatNewsDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
