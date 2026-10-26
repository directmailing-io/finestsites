'use client'

import { useEffect, useState } from 'react'
import type { NewsItem, NewsListResponse } from '@/lib/contracts/app-v1/news'
import { NewsCard } from '@/components/news/NewsCard'
import { NEWS_TOKENS } from '@/components/news/news-ui'
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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Neuigkeiten</h1>
        <p className="text-base mt-1.5" style={{ color: NEWS_TOKENS.secondary }}>
          {items === null
            ? ' '
            : items.length === 0
              ? 'Hier erfährst du, was es Neues bei FinestSites gibt.'
              : unread > 0
                ? `Was es Neues bei FinestSites gibt. ${unread === 1 ? 'Eine Neuigkeit ist' : `${unread} Neuigkeiten sind`} noch ungelesen.`
                : 'Was es Neues bei FinestSites gibt. Du bist auf dem neuesten Stand.'}
        </p>
      </div>

      {items === null && !error && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white" style={{ borderRadius: NEWS_TOKENS.cardRadius, border: `1.5px solid ${NEWS_TOKENS.line}`, padding: '18px 20px' }}>
              <div className="flex gap-4">
                <div className="rounded-2xl bg-gray-100" style={{ width: 42, height: 42 }} />
                <div className="flex-1 flex flex-col gap-2 pt-1">
                  <div className="h-2.5 rounded-full bg-gray-100 w-1/4" />
                  <div className="h-3.5 rounded-full bg-gray-100 w-2/3" />
                  <div className="h-3 rounded-full bg-gray-100 w-full" />
                </div>
              </div>
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
        <div className="flex flex-col items-center text-center px-6 py-14 bg-white"
          style={{ borderRadius: NEWS_TOKENS.cardRadius, border: `1.5px dashed ${NEWS_TOKENS.accentSoftBorder}`, background: '#FBF9FE' }}>
          <span style={{ width: 56, height: 56, borderRadius: 18, background: NEWS_TOKENS.heroGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(124,58,237,0.25)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>
              <path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/>
            </svg>
          </span>
          <h2 className="text-lg font-bold text-gray-900 mt-4">Noch keine Neuigkeiten</h2>
          <p className="text-sm mt-1 max-w-sm" style={{ color: NEWS_TOKENS.secondary }}>
            Sobald es etwas Neues bei FinestSites gibt, findest du es hier.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map(item => <NewsCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}
