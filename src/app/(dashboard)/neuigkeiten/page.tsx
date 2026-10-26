'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { NewsItem, NewsListResponse, NewsActionResponse } from '@/lib/contracts/app-v1/news'
import { NewsCard, newsPrimaryButtonStyle } from '@/components/news/NewsCard'
import { NewsLogoGlyphRainbow } from '@/components/news/NewsLogoGlyph'
import { NEWS_CTA_ROUTES, NEWS_SHEET_CLASS, NEWS_TOKENS } from '@/components/news/news-ui'
import { broadcastNewsUnread } from '@/components/news/useNewsUnread'
import { useOpenExternal } from '@/components/app-mode/AppMode'

/**
 * Neuigkeiten – die einzige Ansicht (Daniel 26.10.2026): alle sichtbaren Neuigkeiten als Vollton-Karten,
 * neueste zuerst, Quelle `GET /api/news`. Eine Karte klappt auf (eine zur Zeit) und zeigt Inhalt + Knopf;
 * Aufklappen meldet `POST /api/news/[id]/read`. `?open=<id>` (Startkarte, alte Detail-Links) klappt
 * diese Neuigkeit direkt auf. Knopf → `POST /api/news/[id]/cta`, dann Ziel öffnen.
 */
export default function NewsListPage() {
  return (
    <Suspense fallback={null}>
      <NewsList />
    </Suspense>
  )
}

function NewsList() {
  const router = useRouter()
  const params = useSearchParams()
  const openExternal = useOpenExternal()
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(() => params.get('open'))

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

  // ?open=<id> aus der Adresse übernehmen (z. B. Tipp auf die Startkarte), danach die Adresse säubern
  useEffect(() => {
    const open = params.get('open')
    if (!open) return
    setOpenId(open)
    router.replace('/neuigkeiten', { scroll: false })
  }, [params, router])

  const markRead = useCallback((id: string) => {
    fetch(`/api/news/${id}/read`, { method: 'POST' })
      .then(async r => {
        if (!r.ok) return
        const d = (await r.json()) as NewsActionResponse
        setItems(prev => prev ? prev.map(n => (n.id === id ? d.item : n)) : prev)
        broadcastNewsUnread(d.unreadCount)
      })
      .catch(() => {})
  }, [])

  // Beim Aufklappen als gelesen melden (auch für ?open=<id>, sobald die Liste da ist)
  useEffect(() => {
    if (!openId || !items) return
    const it = items.find(n => n.id === openId)
    if (it && !it.readAt) markRead(openId)
  }, [openId, items, markRead])

  function toggle(id: string) {
    setOpenId(prev => (prev === id ? null : id))
  }

  function trackCta(id: string) {
    // keepalive: der Klick darf das Verlassen der Seite nicht aufhalten
    fetch(`/api/news/${id}/cta`, { method: 'POST', keepalive: true }).catch(() => {})
  }

  const unread = items?.filter(i => !i.readAt).length ?? 0
  const subtitle = items === null
    ? ' '
    : items.length === 0
      ? 'Was es Neues bei FinestSites gibt.'
      : unread > 0
        ? unread === 1 ? 'Eine neue Neuigkeit' : `${unread} neue Neuigkeiten`
        : 'Du bist auf dem neuesten Stand.'

  const arrow = (
    <svg className="transition-transform duration-[180ms] group-hover:translate-x-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.8, marginRight: -4 }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )

  function ctaFor(item: NewsItem) {
    const cta = item.cta
    if (!cta) return null
    if (cta.kind === 'url' && cta.url) {
      return (
        <a href={cta.url} target="_blank" rel="noopener noreferrer" style={newsPrimaryButtonStyle}
          className="group transition-[transform,background-color] duration-[180ms] hover:bg-black active:scale-[0.985]"
          onClick={e => { trackCta(item.id); openExternal(e, cta.url!) }}>
          {cta.label}
          {arrow}
        </a>
      )
    }
    return (
      <Link href={NEWS_CTA_ROUTES[cta.kind as keyof typeof NEWS_CTA_ROUTES] ?? '/sites'} style={newsPrimaryButtonStyle}
        className="group transition-[transform,background-color] duration-[180ms] hover:bg-black active:scale-[0.985]" onClick={() => trackCta(item.id)}>
        {cta.label}
        {arrow}
      </Link>
    )
  }

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
          {items.map(item => (
            <NewsCard
              key={item.id}
              id={item.id}
              title={item.title}
              summary={item.summary}
              body={item.body}
              publishedAt={item.publishedAt}
              color={item.color}
              unread={!item.readAt}
              expanded={openId === item.id}
              onToggle={() => toggle(item.id)}
              cta={ctaFor(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
