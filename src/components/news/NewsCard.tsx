'use client'

import Link from 'next/link'
import type { NewsItem } from '@/lib/contracts/app-v1/news'
import { NEWS_SHADOW_HOVER_CLASS, NEWS_TOKENS, formatNewsDate, newsPalette } from './news-ui'
import { NEWS_ON_SOLID, newsFrameClass, newsFrameInnerStyle, newsFrameStyle, newsSolidClass, newsSolidStyle } from './NewsSurface'

/**
 * Eine Neuigkeit in der Liste `/neuigkeiten`. Die neueste (`prominent`) ist eine Vollton-Karte im
 * Pastellverlauf mit schwarzer „Weiterlesen“-Pille; alle weiteren sind weiße Blätter mit feinem
 * Verlaufsrahmen. Datum, Überschrift, zwei Zeilen Kurztext. Kein Punkt, kein Icon, kein Bild.
 */
export function NewsCard({ item, prominent = false }: { item: NewsItem; prominent?: boolean }) {
  const unread = !item.readAt
  const palette = newsPalette(item.id, item.color)
  const radius = NEWS_TOKENS.cardRadius
  const href = `/neuigkeiten/${item.id}`
  const interactive = `group block transition-[transform,box-shadow] duration-[180ms] ease-out active:scale-[0.995] ${NEWS_SHADOW_HOVER_CLASS}`

  const chevron = (
    <svg className="transition-transform duration-[180ms] group-hover:translate-x-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: prominent ? 0.85 : 0.7 }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )

  const content = (
    <div className={prominent ? 'px-6 pt-6 pb-6 sm:px-8 sm:pt-8 sm:pb-8' : 'px-5 pt-5 pb-6 sm:px-7 sm:pt-7 sm:pb-7'}>
      <div className="flex items-center gap-2.5" style={{ minHeight: 20 }}>
        <time dateTime={item.publishedAt ?? undefined} style={{
          fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: prominent ? NEWS_ON_SOLID.kicker : NEWS_TOKENS.tertiary, lineHeight: 1,
        }}>
          {formatNewsDate(item.publishedAt)}
        </time>
        {unread && (
          <span style={{
            fontSize: 11.5, fontWeight: 600, letterSpacing: '0.01em', lineHeight: 1,
            padding: '5px 9px', borderRadius: 999, background: prominent ? NEWS_ON_SOLID.pill : palette.tint, color: NEWS_TOKENS.ink,
          }}>
            Neu
          </span>
        )}
      </div>

      <h2 className={prominent ? 'text-[22px] sm:text-[25px]' : 'text-[20px] sm:text-[22px]'} style={{
        margin: '12px 0 8px', fontWeight: 600, lineHeight: 1.22, letterSpacing: prominent ? '-0.4px' : '-0.3px',
        color: NEWS_TOKENS.ink, overflowWrap: 'anywhere',
      }}>
        {item.title}
      </h2>
      <p style={{
        margin: 0, fontSize: 15.5, lineHeight: 1.6, color: prominent ? NEWS_ON_SOLID.text : NEWS_TOKENS.secondary, overflowWrap: 'anywhere',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {item.summary}
      </p>

      <div className="flex justify-end" style={{ marginTop: prominent ? 20 : 18 }}>
        {prominent ? (
          <span className="inline-flex items-center gap-1" style={{ fontSize: 14, fontWeight: 600, color: '#fff', background: NEWS_TOKENS.ink, padding: '10px 14px 10px 16px', borderRadius: 999, letterSpacing: '-0.1px' }}>
            Weiterlesen
            {chevron}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1" style={{ fontSize: 14.5, fontWeight: 600, color: NEWS_TOKENS.ink, letterSpacing: '-0.1px' }}>
            Weiterlesen
            {chevron}
          </span>
        )}
      </div>
    </div>
  )

  if (prominent) {
    return (
      <Link href={href} className={`${interactive} ${newsSolidClass}`} style={{ ...newsSolidStyle(palette, radius), textDecoration: 'none', color: 'inherit' }} data-news-surface="solid">
        {content}
      </Link>
    )
  }
  return (
    <Link href={href} className={`${interactive} ${newsFrameClass}`} style={{ ...newsFrameStyle(palette, radius), textDecoration: 'none', color: 'inherit' }} data-news-surface="framed">
      <div style={newsFrameInnerStyle(radius)}>{content}</div>
    </Link>
  )
}
