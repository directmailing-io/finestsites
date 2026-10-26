import type { NewsCtaKind } from '@/lib/contracts/app-v1/news'

/** Farben und Radien wie in der App (`mobile/src/theme/tokens.ts`). */
export const NEWS_TOKENS = {
  accent: '#7C3AED',
  accentSoft: '#F5F0FB',
  accentSoftBorder: '#E4D7F5',
  ink: '#111827',
  body: '#374151',
  secondary: '#475569',
  tertiary: '#94A3B8',
  line: '#E2E8F0',
  cardRadius: 24,
  detailRadius: 28,
  heroGradient: 'linear-gradient(135deg, #7C3AED 0%, #C4B5FD 100%)',
  /** Weicher, zweistufiger Schatten – ruhig im Stand */
  shadow: '0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(17,24,39,0.06)',
} as const

/**
 * Schatten als Tailwind-Klassen (gleiche Werte wie `NEWS_TOKENS.shadow`), weil ein Inline-Schatten
 * eine Hover-Klasse immer überstimmen würde. Karte hebt sich 2 px und der Schatten wird tiefer.
 */
export const NEWS_SHADOW_CLASS = 'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_rgba(17,24,39,0.06)]'
export const NEWS_SHADOW_HOVER_CLASS = 'hover:shadow-[0_2px_4px_rgba(0,0,0,0.05),0_20px_44px_rgba(17,24,39,0.10)] hover:-translate-y-0.5'

/**
 * Vier Markenverläufe für die Kopfbänder. Welche Neuigkeit welchen bekommt, entscheidet
 * deterministisch ihre ID (`newsPalette`), damit Liste, Detail und Startkarte dasselbe zeigen.
 */
export type NewsPalette = { name: string; gradient: string; from: string; to: string }

export const NEWS_PALETTES: readonly NewsPalette[] = [
  { name: 'violet', from: '#7C3AED', to: '#C4B5FD', gradient: 'linear-gradient(135deg, #7C3AED 0%, #C4B5FD 100%)' },
  { name: 'indigo', from: '#4C1D95', to: '#8B5CF6', gradient: 'linear-gradient(135deg, #4C1D95 0%, #8B5CF6 100%)' },
  { name: 'dusk', from: '#5B21B6', to: '#EC4899', gradient: 'linear-gradient(135deg, #5B21B6 0%, #EC4899 100%)' },
  { name: 'aurora', from: '#6D28D9', to: '#22D3EE', gradient: 'linear-gradient(135deg, #6D28D9 0%, #22D3EE 100%)' },
] as const

export function newsPalette(key: string | null | undefined): NewsPalette {
  if (!key) return NEWS_PALETTES[0]
  // Gleiche Formel wie in der App (mobile/src/features/news/NewsHero.tsx): dieselbe Neuigkeit, derselbe Verlauf.
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % 9973
  return NEWS_PALETTES[h % NEWS_PALETTES.length]
}

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
