import type { NewsCtaKind } from '@/lib/contracts/app-v1/news'

/**
 * Gestaltung der Neuigkeiten (Web): weiße, typografische Blätter – die einzige Farbe ist eine
 * zarte Pastell-Linie je Neuigkeit. Keine Bilder, keine Icons, keine Verlaufsbänder.
 */
export const NEWS_TOKENS = {
  /** Lila nur noch im Admin-Editor (Schalter, Chips) – Nutzerseiten sind farblos bis auf die Pastell-Linie */
  accent: '#7C3AED',
  accentSoft: '#F5F0FB',
  accentSoftBorder: '#E4D7F5',
  ink: '#111827',
  lead: '#1F2937',
  body: '#374151',
  secondary: '#5B6472',
  muted: '#6B7280',
  tertiary: '#8A94A6',
  line: '#ECEEF2',
  lineHover: '#E3E6EB',
  cardRadius: 24,
  detailRadius: 28,
  /** Haarlinie + sehr weicher Schatten – das Blatt liegt kaum merklich auf der Fläche */
  shadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.05)',
} as const

/**
 * Schatten und Haarlinie als Tailwind-Klassen (gleiche Werte wie `NEWS_TOKENS`), weil ein Inline-Wert
 * eine Hover-Klasse immer überstimmen würde. Beim Schweben hebt sich die Karte 2 px, die Linie wird einen Hauch dunkler.
 */
export const NEWS_SHADOW_CLASS = 'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.05)]'
export const NEWS_SHADOW_HOVER_CLASS = 'hover:shadow-[0_2px_4px_rgba(16,24,40,0.05),0_14px_32px_rgba(16,24,40,0.08)] hover:-translate-y-0.5'
export const NEWS_SHEET_CLASS = `bg-white border border-[#ECEEF2] ${NEWS_SHADOW_CLASS}`
export const NEWS_SHEET_HOVER_CLASS = `hover:border-[#E3E6EB] ${NEWS_SHADOW_HOVER_CLASS}`

/**
 * Fünf Pastellpaare. Welche Neuigkeit welches bekommt, entscheidet deterministisch ihre ID
 * (`newsPalette`), damit Liste, Detail und Startkarte dieselbe Linie zeigen.
 * `gradient` ist die Linie (links → rechts), `tint` eine fast weiße Fläche (Pille, Häkchen-Kreis),
 * `ink` ein kräftigerer Ton derselben Familie für kleine Akzente (Punkt, Kicker, Häkchen).
 */
export type NewsPalette = { name: string; gradient: string; from: string; to: string; tint: string; ink: string }

const pastel = (name: string, from: string, to: string, tint: string, ink: string): NewsPalette =>
  ({ name, from, to, tint, ink, gradient: `linear-gradient(90deg, ${from}, ${to})` })

export const NEWS_PALETTES: readonly NewsPalette[] = [
  pastel('peach', '#F7C4B4', '#F6DFA9', '#FDF3EF', '#B45F4A'),
  pastel('mint', '#CDE8D3', '#BBD6F2', '#F0F8F2', '#3F7A5A'),
  pastel('lavender', '#D9D3F3', '#F5C9DC', '#F4F1FB', '#6B5BB5'),
  pastel('apricot', '#F6DFA9', '#CDE8D3', '#FCF6EA', '#9A7A2C'),
  pastel('sky', '#BBD6F2', '#D9D3F3', '#EFF5FC', '#3F6BA8'),
] as const

export function newsPalette(key: string | null | undefined): NewsPalette {
  if (!key) return NEWS_PALETTES[0]
  // Gleiche Formel wie in der App (mobile/src/features/news/NewsHero.tsx): dieselbe Neuigkeit, derselbe Verlauf.
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % 9973
  return NEWS_PALETTES[h % NEWS_PALETTES.length]
}

/** Die Pastell-Linie als senkrechter Balken (Startkarte) */
export function newsPaletteVertical(p: NewsPalette): string {
  return `linear-gradient(180deg, ${p.from}, ${p.to})`
}

/** Der Pastell-Regenbogen, den das „f“ im Leerzustand trägt (Pfirsich → Aprikose → Mint → Himmel) */
export const NEWS_RAINBOW_STOPS: readonly { offset: string; color: string }[] = [
  { offset: '0%', color: '#F4B9AE' },
  { offset: '35%', color: '#F5DBA2' },
  { offset: '68%', color: '#CBE6CD' },
  { offset: '100%', color: '#B8D2F1' },
] as const

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
