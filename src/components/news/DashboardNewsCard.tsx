'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { NewsItem, NewsListResponse, NewsActionResponse } from '@/lib/contracts/app-v1/news'
import { NEWS_TOKENS } from './news-ui'
import { broadcastNewsUnread } from './useNewsUnread'

/**
 * Startkarte auf /sites (Konzept Bild 4): neueste veröffentlichte Neuigkeit, die weder gelesen noch
 * weggewischt ist. Quelle `GET /api/news`; Kreuz → `POST /api/news/[id]/dismiss`.
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
        const latest = d.items.find(n => !n.readAt && !n.dismissedAt) ?? null
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

  return (
    <div
      role="region"
      aria-label="Neuigkeit von FinestSites"
      className="mb-5"
      style={{
        display: 'grid', gridTemplateRows: visible ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.26s ease, opacity 0.22s ease, transform 0.26s ease',
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-6px)',
      }}
    >
      <div style={{ overflow: 'hidden' }}>
        <div
          className="relative"
          style={{
            background: NEWS_TOKENS.accentSoft, border: `1px solid ${NEWS_TOKENS.accentSoftBorder}`,
            borderRadius: 20, padding: '16px 48px 16px 18px', maxWidth: 680,
          }}
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Hinweis ausblenden"
            className="absolute flex items-center justify-center transition-colors"
            style={{ top: 10, right: 10, width: 32, height: 32, borderRadius: 999, background: 'transparent', border: 'none', color: NEWS_TOKENS.tertiary, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.10)'; e.currentTarget.style.color = NEWS_TOKENS.accent }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = NEWS_TOKENS.tertiary }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: NEWS_TOKENS.accent }}>
            Neu bei FinestSites
          </div>
          <div style={{ fontWeight: 700, color: NEWS_TOKENS.ink, fontSize: 16, lineHeight: 1.3, margin: '4px 0 3px', letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>
            {item.title}
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: NEWS_TOKENS.body, overflowWrap: 'anywhere' }}>
            {item.summary}{' '}
            <Link href={`/neuigkeiten/${item.id}`} className="whitespace-nowrap hover:underline"
              style={{ color: NEWS_TOKENS.accent, fontWeight: 700 }}>
              Mehr erfahren ›
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
