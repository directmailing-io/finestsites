// GENERIERT von mobile/scripts/sync-contracts.mjs aus src/lib/contracts/app-v1/ – NICHT BEARBEITEN.
// Änderungen immer im Server-Vertrag machen und danach `npm run sync:contracts` ausführen.
import { z } from 'zod'
import { Uuid } from './common'

/**
 * Neuigkeiten (Ankündigungen von FinestSites) – gleiche Formen für Web und App.
 * Konzept: docs/app/neuigkeiten-konzept.html. Spezifikation: docs/news/spec.md.
 */

/** Ziel des Knopfs. `url` öffnet im Browser; alle anderen sind Bereiche in Web/App. */
export const NewsCtaKind = z.enum(['sites', 'submissions', 'chats', 'affiliate', 'settings', 'url'])
export type NewsCtaKind = z.infer<typeof NewsCtaKind>

export const NewsCta = z.object({
  label: z.string().min(1).max(30),
  kind: NewsCtaKind,
  /** Nur bei kind = 'url' (https://…) */
  url: z.string().url().max(500).nullable(),
})
export type NewsCta = z.infer<typeof NewsCta>

/** Eine Neuigkeit aus Sicht des Nutzers (Liste + Detail). */
export const NewsItem = z.object({
  id: Uuid,
  title: z.string(),
  /** Kurztext (= Text der Push-Mitteilung) für Liste und Startkarte */
  summary: z.string(),
  /** Inhalt: Absätze durch Leerzeile, Zeilen mit "- " sind Aufzählungspunkte (siehe newsBodyBlocks) */
  body: z.string(),
  cta: NewsCta.nullable(),
  publishedAt: z.string(),
  readAt: z.string().nullable(),
  dismissedAt: z.string().nullable(),
})
export type NewsItem = z.infer<typeof NewsItem>

/** GET /api/app/v1/news (und /api/news im Web): neueste zuerst, höchstens 50. */
export const NewsListResponse = z.object({
  items: z.array(NewsItem),
  unreadCount: z.number().int().nonnegative(),
})
export type NewsListResponse = z.infer<typeof NewsListResponse>

/** GET /api/app/v1/news/[id] */
export const NewsDetailResponse = NewsItem

/** POST /api/app/v1/news/[id]/read | /cta | /dismiss → aktueller Stand */
export const NewsActionResponse = z.object({
  item: NewsItem,
  unreadCount: z.number().int().nonnegative(),
})
export type NewsActionResponse = z.infer<typeof NewsActionResponse>

/** Kompakte Karte für Startbildschirm/Dashboard (Teil von /overview). */
export const NewsCard = z.object({
  id: Uuid,
  title: z.string(),
  summary: z.string(),
  publishedAt: z.string(),
})
export type NewsCard = z.infer<typeof NewsCard>

/* ── Inhalt rendern (Web und App identisch) ─────────────────────────────────────────────────── */

export type NewsBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

/**
 * Zerlegt den Inhalt in Absätze und Aufzählungen. Regeln:
 *  - Leerzeile trennt Absätze
 *  - Zeilen, die mit "- " oder "• " beginnen, bilden zusammenhängend eine Aufzählung
 *  - Einzelne Zeilenumbrüche innerhalb eines Absatzes werden zu Leerzeichen
 * Kein HTML, kein Markdown darüber hinaus (bewusst schlicht, damit Push-Vorschau und Seiten gleich lesen).
 */
export function newsBodyBlocks(body: string): NewsBlock[] {
  const blocks: NewsBlock[] = []
  const chunks = body.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n+/)
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) continue
    let para: string[] = []
    let list: string[] = []
    const flushPara = () => { if (para.length) { blocks.push({ type: 'paragraph', text: para.join(' ') }); para = [] } }
    const flushList = () => { if (list.length) { blocks.push({ type: 'list', items: list }); list = [] } }
    for (const line of lines) {
      const m = /^(?:-|•)\s+(.*)$/.exec(line)
      if (m) { flushPara(); list.push(m[1].trim()) }
      else { flushList(); para.push(line) }
    }
    flushPara(); flushList()
  }
  return blocks
}
