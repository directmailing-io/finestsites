'use client'

import Link from 'next/link'
import type { NewsItem } from '@/lib/contracts/app-v1/news'
import { NewsHeroBand } from './NewsHeroBand'
import { NEWS_SHADOW_CLASS, NEWS_SHADOW_HOVER_CLASS, NEWS_TOKENS, formatNewsDate, newsPalette } from './news-ui'

/**
 * Eine Neuigkeit in der Liste `/neuigkeiten` – große redaktionelle Karte: Kopfband im Markenverlauf
 * (je ID fest gewählt), darunter Kicker („NEU“ + Datum), Überschrift, zwei Zeilen Kurztext, „Weiterlesen“.
 */
export function NewsCard({ item }: { item: NewsItem }) {
  const unread = !item.readAt
  const palette = newsPalette(item.id)
  return (
    <Link
      href={`/neuigkeiten/${item.id}`}
      className={`group block overflow-hidden bg-white transition-[transform,box-shadow] duration-[180ms] ease-out active:scale-[0.995] ${NEWS_SHADOW_CLASS} ${NEWS_SHADOW_HOVER_CLASS}`}
      style={{ borderRadius: NEWS_TOKENS.cardRadius, textDecoration: 'none', color: 'inherit' }}
    >
      <NewsHeroBand palette={palette} className="h-24 sm:h-[120px]" />

      <div className="px-5 pt-[18px] pb-5 sm:px-7 sm:pt-5 sm:pb-6">
        {/* Kicker */}
        <div className="flex items-center gap-2.5" style={{ minHeight: 20 }}>
          {unread && (
            <>
              <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: NEWS_TOKENS.accent, flexShrink: 0 }} />
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1,
                padding: '5px 8px', borderRadius: 999, background: NEWS_TOKENS.accentSoft, color: NEWS_TOKENS.accent,
              }}>
                NEU
              </span>
            </>
          )}
          <time dateTime={item.publishedAt ?? undefined} style={{
            fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: unread ? NEWS_TOKENS.secondary : NEWS_TOKENS.tertiary,
          }}>
            {formatNewsDate(item.publishedAt)}
          </time>
        </div>

        <h2 className="text-[20px] sm:text-[22px]" style={{
          margin: '10px 0 6px', fontWeight: 700, lineHeight: 1.22, letterSpacing: '-0.3px',
          color: NEWS_TOKENS.ink, overflowWrap: 'anywhere',
        }}>
          {item.title}
        </h2>
        <p style={{
          margin: 0, fontSize: 15, lineHeight: 1.55, color: NEWS_TOKENS.secondary, overflowWrap: 'anywhere',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {item.summary}
        </p>

        <div className="flex justify-end" style={{ marginTop: 14 }}>
          <span className="inline-flex items-center gap-1" style={{ fontSize: 14, fontWeight: 600, color: NEWS_TOKENS.accent }}>
            Weiterlesen
            <svg className="transition-transform duration-[180ms] group-hover:translate-x-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}
