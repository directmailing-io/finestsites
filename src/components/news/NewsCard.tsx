'use client'

import Link from 'next/link'
import type { NewsItem } from '@/lib/contracts/app-v1/news'
import { NEWS_SHEET_CLASS, NEWS_SHEET_HOVER_CLASS, NEWS_TOKENS, formatNewsDate, newsPalette } from './news-ui'

/**
 * Eine Neuigkeit in der Liste `/neuigkeiten` – ein weißes, typografisches Blatt: Datum, Überschrift,
 * zwei Zeilen Kurztext, „Weiterlesen“. Die einzige Farbe ist die 3 px dünne Pastell-Linie an der
 * Unterkante (je ID fest gewählt), 28 px von beiden Seiten eingerückt – ein Unterstrich, kein Rahmen.
 */
export function NewsCard({ item }: { item: NewsItem }) {
  const unread = !item.readAt
  const palette = newsPalette(item.id)
  return (
    <Link
      href={`/neuigkeiten/${item.id}`}
      className={`group relative block transition-[transform,box-shadow,border-color] duration-[180ms] ease-out active:scale-[0.995] ${NEWS_SHEET_CLASS} ${NEWS_SHEET_HOVER_CLASS}`}
      style={{ borderRadius: NEWS_TOKENS.cardRadius, textDecoration: 'none', color: 'inherit' }}
    >
      <div className="px-5 pt-5 pb-6 sm:px-7 sm:pt-7 sm:pb-6">
        {/* Kopfzeile: Punkt (ungelesen) · Datum · „Neu“ */}
        <div className="flex items-center gap-2.5" style={{ minHeight: 20 }}>
          {unread && <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: palette.ink, flexShrink: 0 }} />}
          <time dateTime={item.publishedAt ?? undefined} style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: NEWS_TOKENS.tertiary, lineHeight: 1,
          }}>
            {formatNewsDate(item.publishedAt)}
          </time>
          {unread && (
            <span style={{
              fontSize: 11.5, fontWeight: 600, letterSpacing: '0.01em', lineHeight: 1,
              padding: '5px 9px', borderRadius: 999, background: palette.tint, color: palette.ink,
            }}>
              Neu
            </span>
          )}
        </div>

        <h2 className="text-[20px] sm:text-[22px]" style={{
          margin: '12px 0 8px', fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.3px',
          color: NEWS_TOKENS.ink, overflowWrap: 'anywhere',
        }}>
          {item.title}
        </h2>
        <p style={{
          margin: 0, fontSize: 15.5, lineHeight: 1.6, color: NEWS_TOKENS.secondary, overflowWrap: 'anywhere',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {item.summary}
        </p>

        <div className="flex justify-end" style={{ marginTop: 18 }}>
          <span className="inline-flex items-center gap-1" style={{ fontSize: 14.5, fontWeight: 600, color: NEWS_TOKENS.ink, letterSpacing: '-0.1px' }}>
            Weiterlesen
            <svg className="transition-transform duration-[180ms] group-hover:translate-x-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.7 }}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </div>
      </div>

      {/* Die Pastell-Linie: Unterkante, eingerückt – liegt auf der Haarlinie */}
      <span aria-hidden className="absolute left-5 right-5 sm:left-7 sm:right-7" style={{ bottom: -1, height: 3, borderRadius: 999, background: palette.gradient }} />
    </Link>
  )
}
