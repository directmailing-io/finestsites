'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { NewsItem, NewsListResponse, NewsActionResponse } from '@/lib/contracts/app-v1/news'
import { isRecentEnoughForCard } from '@/lib/news/constants'
import { NewsHeroMini } from './NewsHeroBand'
import { NEWS_SHADOW_CLASS, NEWS_TOKENS, newsPalette } from './news-ui'
import { broadcastNewsUnread } from './useNewsUnread'

/**
 * Startkarte auf /sites: neueste veröffentlichte Neuigkeit, die weder gelesen noch weggewischt ist
 * und höchstens NEWS_CARD_MAX_AGE_DAYS alt (wie overviewFor() für die App – ein neues Konto bekommt
 * keine alte Karte). Quelle `GET /api/news`; Kreuz → `POST /api/news/[id]/dismiss`.
 * Schlanke „Tipp“-Karte: links die Verlaufs-Kachel der Neuigkeit, rechts Kicker, Titel, eine Zeile Text.
 * Rendert erst nach dem Laden (kein Platzhalter, kein Springen), blendet sanft ein und aus.
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
  const palette = newsPalette(item.id)
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
          className={`group relative bg-white ${NEWS_SHADOW_CLASS}`}
          style={{ borderRadius: 20, padding: '14px 44px 14px 14px', maxWidth: 680 }}
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Hinweis ausblenden"
            className="absolute flex items-center justify-center opacity-50 transition-[opacity,background-color,color] duration-150 group-hover:opacity-100 focus-visible:opacity-100"
            style={{ top: 10, right: 10, width: 30, height: 30, borderRadius: 999, background: 'transparent', border: 'none', color: NEWS_TOKENS.tertiary, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = NEWS_TOKENS.ink }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = NEWS_TOKENS.tertiary }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>

          <div className="flex items-start gap-3.5">
            <Link href={href} aria-hidden tabIndex={-1} className="flex-shrink-0" style={{ marginTop: 1 }}>
              <NewsHeroMini palette={palette} width={44} height={44} radius={13} glyph />
            </Link>
            <div className="min-w-0 flex-1">
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: NEWS_TOKENS.accent, lineHeight: 1, marginTop: 2 }}>
                Neu bei FinestSites
              </div>
              <Link href={href} className="block hover:underline" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ fontWeight: 600, color: NEWS_TOKENS.ink, fontSize: 15.5, lineHeight: 1.3, margin: '5px 0 2px', letterSpacing: '-0.2px', overflowWrap: 'anywhere' }}>
                  {item.title}
                </div>
              </Link>
              {/* Desktop: eine Zeile Text + Link daneben · Handy: zwei Zeilen Text, Link darunter */}
              <p className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2" style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: NEWS_TOKENS.secondary, minWidth: 0 }}>
                <span className="min-w-0 line-clamp-2 sm:line-clamp-1" style={{ overflowWrap: 'anywhere' }}>{item.summary}</span>
                <Link href={href} className="whitespace-nowrap flex-shrink-0 self-start hover:underline" style={{ color: NEWS_TOKENS.accent, fontWeight: 600 }}>
                  Mehr erfahren ›
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
