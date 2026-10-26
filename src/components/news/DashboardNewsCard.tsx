'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { NewsItem, NewsListResponse, NewsActionResponse } from '@/lib/contracts/app-v1/news'
import { isRecentEnoughForCard } from '@/lib/news/constants'
import { NEWS_TOKENS, newsPalette } from './news-ui'
import { NEWS_ON_SOLID, newsSolidClass, newsSolidStyle } from './NewsSurface'
import { broadcastNewsUnread } from './useNewsUnread'

/**
 * Startkarte auf /sites: neueste veröffentlichte Neuigkeit, die weder gelesen noch weggewischt ist
 * und höchstens NEWS_CARD_MAX_AGE_DAYS alt (wie overviewFor() für die App – ein neues Konto bekommt
 * keine alte Karte). Quelle `GET /api/news`; Kreuz → `POST /api/news/[id]/dismiss`.
 * Vollton-Karte im Pastellverlauf der Neuigkeit (sie ist immer die neueste): Kicker, Titel, eine
 * Zeile Text, „Mehr erfahren“. Rendert erst nach dem Laden, blendet sanft ein und aus.
 */
export function DashboardNewsCard() {
  const [item, setItem] = useState<NewsItem | null>(null)
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/news', { cache: 'no-store' })
      .then(r => (r.ok ? (r.json() as Promise<NewsListResponse>) : null))
      .then(d => {
        if (!alive || !d?.items) return
        const latest = d.items.find(n => !n.readAt && !n.dismissedAt && isRecentEnoughForCard(n.publishedAt)) ?? null
        if (latest) {
          setItem(latest)
          requestAnimationFrame(() => { if (alive) setVisible(true) })
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  async function dismiss() {
    if (!item || leaving) return
    setLeaving(true)
    setVisible(false)
    try {
      const res = await fetch(`/api/news/${item.id}/dismiss`, { method: 'POST' })
      if (res.ok) {
        const d = (await res.json()) as NewsActionResponse
        broadcastNewsUnread(d.unreadCount)
      }
    } catch { /* Karte ist weg – beim nächsten Laden entscheidet der Server */ }
    window.setTimeout(() => setItem(null), 260)
  }

  if (!item) return null
  const palette = newsPalette(item.id, item.color)
  const href = `/neuigkeiten/${item.id}`

  return (
    <div
      role="region"
      aria-label="Neuigkeit von FinestSites"
      className="mb-1"
      style={{
        display: 'grid', gridTemplateRows: visible ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.26s ease, opacity 0.24s ease, transform 0.26s ease',
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(4px)',
      }}
    >
      {/* Innenabstand unten, damit der weiche Schatten nicht am overflow:hidden abgeschnitten wird */}
      <div style={{ overflow: 'hidden', padding: '2px 0 20px' }}>
        <div
          className={`group ${newsSolidClass}`}
          style={{ ...newsSolidStyle(palette, 20), padding: '18px 48px 21px 24px', maxWidth: 680 }}
          data-news-surface="solid"
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Hinweis ausblenden"
            className="absolute flex items-center justify-center opacity-0 max-sm:opacity-70 transition-[opacity,background-color] duration-150 group-hover:opacity-100 focus-visible:opacity-100"
            style={{ top: 12, right: 12, width: 30, height: 30, borderRadius: 999, background: 'transparent', border: 'none', color: NEWS_TOKENS.ink, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = NEWS_ON_SOLID.wash }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>

          <div className="min-w-0">
            <div style={{ fontSize: 12, fontWeight: 600, color: NEWS_ON_SOLID.kicker, lineHeight: 1, letterSpacing: '0.02em' }}>
              Neu bei FinestSites
            </div>
            <Link href={href} className="block hover:underline" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontWeight: 600, color: NEWS_TOKENS.ink, fontSize: 15.5, lineHeight: 1.3, margin: '7px 0 3px', letterSpacing: '-0.2px', overflowWrap: 'anywhere' }}>
                {item.title}
              </div>
            </Link>
            {/* Desktop: eine Zeile Text + Link daneben · Handy: zwei Zeilen Text, Link darunter */}
            <p className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2.5" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: NEWS_ON_SOLID.text, minWidth: 0 }}>
              <span className="min-w-0 line-clamp-2 sm:line-clamp-1" style={{ overflowWrap: 'anywhere' }}>{item.summary}</span>
              <Link href={href} className="group/more whitespace-nowrap flex-shrink-0 self-start inline-flex items-baseline hover:underline" style={{ color: NEWS_TOKENS.ink, fontWeight: 600, textDecoration: 'none', gap: 5 }}>
                Mehr erfahren
                <span aria-hidden className="transition-transform duration-[180ms] group-hover/more:translate-x-0.5" style={{ opacity: 0.8, fontSize: 16, lineHeight: 1 }}>›</span>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
