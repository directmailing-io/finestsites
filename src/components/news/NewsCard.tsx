'use client'

import Link from 'next/link'
import { Megaphone } from "lucide-react"
import type { NewsItem } from '@/lib/contracts/app-v1/news'
import { NEWS_TOKENS, formatNewsDate } from './news-ui'

/** Eine Neuigkeit in der Liste `/neuigkeiten`: Datum-Kicker, Überschrift, Kurztext, Punkt „ungelesen“. */
export function NewsCard({ item }: { item: NewsItem }) {
  const unread = !item.readAt
  return (
    <Link
      href={`/neuigkeiten/${item.id}`}
      className="group block transition-transform active:scale-[0.99]"
      style={{
        background: '#fff', borderRadius: NEWS_TOKENS.cardRadius,
        border: `1.5px solid ${unread ? NEWS_TOKENS.accentSoftBorder : NEWS_TOKENS.line}`,
        boxShadow: unread ? '0 4px 20px rgba(124,58,237,0.08)' : '0 2px 12px rgba(15,23,42,0.05)',
        padding: '18px 20px', textDecoration: 'none', color: 'inherit',
      }}
    >
      <div className="flex items-start gap-4">
        <span aria-hidden style={{
          width: 42, height: 42, borderRadius: 14, flexShrink: 0,
          background: unread ? NEWS_TOKENS.heroGradient : '#F1F5F9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Megaphone size={18} strokeWidth={2} color={unread ? '#fff' : NEWS_TOKENS.tertiary} aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: unread ? NEWS_TOKENS.accent : NEWS_TOKENS.tertiary }}>
              {formatNewsDate(item.publishedAt)}
            </span>
            {unread && (
              <span className="inline-flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 600, color: NEWS_TOKENS.accent }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: NEWS_TOKENS.accent, boxShadow: '0 0 0 3px rgba(124,58,237,0.15)' }} />
                Neu
              </span>
            )}
          </div>
          <h2 style={{ margin: '4px 0 4px', fontSize: 17, fontWeight: 700, lineHeight: 1.3, color: NEWS_TOKENS.ink, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>
            {item.title}
          </h2>
          <p style={{
            margin: 0, fontSize: 14, lineHeight: 1.5, color: NEWS_TOKENS.secondary,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.summary}
          </p>
        </div>
        <svg className="flex-shrink-0 self-center transition-transform group-hover:translate-x-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </Link>
  )
}
