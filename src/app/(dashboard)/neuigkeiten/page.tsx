'use client'

import { useEffect, useState } from 'react'
import type { NewsItem, NewsListResponse } from '@/lib/contracts/app-v1/news'
import { NewsCard } from '@/components/news/NewsCard'
import { NewsLogoGlyphRainbow } from '@/components/news/NewsLogoGlyph'
import { NEWS_SHEET_CLASS, NEWS_TOKENS } from '@/components/news/news-ui'
import { broadcastNewsUnread } from '@/components/news/useNewsUnread'

/** Liste aller sichtbaren Neuigkeiten (neueste zuerst), Quelle `GET /api/news`. */
export default function NewsListPage() {
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/news', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) throw new Error()
        return (await r.json()) as NewsListResponse
      })
      .then(d => {
        if (!alive) return
        setItems(d.items)
        broadcastNewsUnread(d.unreadCount)
      })
      .catch(() => { if (alive) setError('Die Neuigkeiten konnten gerade nicht geladen werden.') })
    return () => { alive = false }
  }, [])

  const unread = items?.filter(i => !i.readAt).length ?? 0
  const subtitle = items === null
    ? ' '
    : items.length === 0
      ? 'Was es Neues bei FinestSites gibt.'
      : unread > 0
        ? unread === 1 ? 'Eine neue Neuigkeit' : `${unread} neue Neuigkeiten`
        : 'Du bist auf dem neuesten Stand.'

  return (
    <div className="mx-auto" style={{ maxWidth: 720 }}>
      <header className="mb-8 sm:mb-10">
        <h1 className="text-[28px] sm:text-[30px]" style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.6px', lineHeight: 1.15, color: NEWS_TOKENS.ink }}>
          Neuigkeiten
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 16, lineHeight: 1.5, color: NEWS_TOKENS.muted }}>
          {subtitle}
        </p>
      </header>

      {items === null && !error && (
        <div className="flex flex-col gap-5 sm:gap-6" aria-hidden>
          {[1, 2].map(i => (
            <div key={i} className={`animate-pulse ${NEWS_SHEET_CLASS} px-5 pt-5 pb-6 sm:px-7 sm:pt-7 sm:pb-7 flex flex-col gap-3.5`} style={{ borderRadius: NEWS_TOKENS.cardRadius }}>
              <div className="h-2.5 rounded-full bg-gray-100 w-1/4" />
              <div className="h-4 rounded-full bg-gray-100 w-2/3" />
              <div className="h-3 rounded-full bg-gray-100 w-full" />
              <div className="h-3 rounded-full bg-gray-100 w-5/6" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl px-4 py-3.5 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          {error}
        </div>
      )}

      {items && items.length === 0 && (
        <div
          className="flex flex-col items-center justify-center text-center px-6 py-16 sm:py-24"
          data-testid="news-empty"
        >
          <NewsLogoGlyphRainbow height={44} />
          <h2 style={{ margin: '22px 0 8px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.3px', color: NEWS_TOKENS.ink }}>
            Noch keine Neuigkeiten
          </h2>
          <p style={{ margin: 0, maxWidth: 380, fontSize: 15, lineHeight: 1.6, color: NEWS_TOKENS.muted }}>
            Sobald es etwas Neues gibt, findest du es hier – und auf Wunsch als Mitteilung in der App.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-5 sm:gap-6">
          {/* Die neueste als Vollton, alle weiteren mit Verlaufsrahmen */}
          {items.map((item, i) => <NewsCard key={item.id} item={item} prominent={i === 0} />)}
        </div>
      )}
    </div>
  )
}
