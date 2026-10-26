'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { NewsItem, NewsActionResponse } from '@/lib/contracts/app-v1/news'
import { NewsDetailCard, newsPrimaryButtonStyle, newsSoftButtonStyle } from '@/components/news/NewsDetailCard'
import { NEWS_CTA_ROUTES, NEWS_TOKENS } from '@/components/news/news-ui'
import { broadcastNewsUnread } from '@/components/news/useNewsUnread'
import { useOpenExternal } from '@/components/app-mode/AppMode'

/**
 * Detail einer Neuigkeit – gleiche Karte wie in der App. Beim Laden `POST /api/news/[id]/read`,
 * Knopf → `POST /api/news/[id]/cta`, dann Ziel öffnen (interne Route bzw. Link im neuen Tab).
 */
export default function NewsDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const openExternal = useOpenExternal()
  const id = params?.id
  const [item, setItem] = useState<NewsItem | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')

  useEffect(() => {
    if (!id) return
    let alive = true
    // Gelesen melden – die Antwort enthält bereits den aktuellen Stand der Neuigkeit
    fetch(`/api/news/${id}/read`, { method: 'POST' })
      .then(async r => {
        if (r.status === 404) { if (alive) setState('missing'); return }
        if (!r.ok) throw new Error()
        const d = (await r.json()) as NewsActionResponse
        if (!alive) return
        setItem(d.item)
        setState('ready')
        broadcastNewsUnread(d.unreadCount)
      })
      .catch(async () => {
        // Fallback: wenigstens lesen
        try {
          const r = await fetch(`/api/news/${id}`, { cache: 'no-store' })
          if (!alive) return
          if (r.status === 404) { setState('missing'); return }
          if (!r.ok) throw new Error()
          setItem((await r.json()) as NewsItem)
          setState('ready')
        } catch { if (alive) setState('error') }
      })
    return () => { alive = false }
  }, [id])

  function trackCta() {
    if (!id) return
    // keepalive: der Klick darf das Verlassen der Seite nicht aufhalten
    fetch(`/api/news/${id}/cta`, { method: 'POST', keepalive: true }).catch(() => {})
  }

  const cta = item?.cta
  const ctaEl = cta ? (
    cta.kind === 'url' && cta.url ? (
      <a href={cta.url} target="_blank" rel="noopener noreferrer" style={newsPrimaryButtonStyle}
        className="transition-transform active:scale-[0.98]"
        onClick={e => { trackCta(); openExternal(e, cta.url!) }}>
        {cta.label}
        <svg className="ml-2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </a>
    ) : (
      <Link href={NEWS_CTA_ROUTES[cta.kind as keyof typeof NEWS_CTA_ROUTES] ?? '/sites'} style={newsPrimaryButtonStyle}
        className="transition-transform active:scale-[0.98]" onClick={trackCta}>
        {cta.label}
      </Link>
    )
  ) : null

  const backEl = (
    <button type="button" style={newsSoftButtonStyle} className="transition-transform active:scale-[0.98]"
      onClick={() => router.push('/neuigkeiten')}>
      {cta ? 'Später' : 'Zurück zu den Neuigkeiten'}
    </button>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/neuigkeiten" className="inline-flex items-center gap-1 text-sm font-semibold mb-5 hover:underline"
        style={{ color: NEWS_TOKENS.accent }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        Neuigkeiten
      </Link>

      {state === 'loading' && (
        <div className="animate-pulse bg-white overflow-hidden" style={{ borderRadius: NEWS_TOKENS.cardRadius, border: `1px solid ${NEWS_TOKENS.line}` }}>
          <div style={{ height: 128, background: '#EDE9FE' }} />
          <div className="p-6 flex flex-col gap-3">
            <div className="h-2.5 rounded-full bg-gray-100 w-1/3" />
            <div className="h-5 rounded-full bg-gray-100 w-3/4" />
            <div className="h-3 rounded-full bg-gray-100 w-full" />
            <div className="h-3 rounded-full bg-gray-100 w-5/6" />
            <div className="h-12 rounded-2xl bg-gray-100 w-full mt-3" />
          </div>
        </div>
      )}

      {state === 'missing' && (
        <div className="bg-white text-center px-6 py-12" style={{ borderRadius: NEWS_TOKENS.cardRadius, border: `1px solid ${NEWS_TOKENS.line}` }}>
          <h1 className="text-lg font-bold text-gray-900">Diese Neuigkeit gibt es nicht mehr.</h1>
          <p className="text-sm mt-1" style={{ color: NEWS_TOKENS.secondary }}>Vielleicht wurde sie inzwischen zurückgezogen.</p>
          <Link href="/neuigkeiten" className="inline-flex mt-5 px-5 min-h-11 items-center rounded-2xl text-sm font-semibold" style={{ background: '#F1F5F9', color: NEWS_TOKENS.ink }}>
            Zu den Neuigkeiten
          </Link>
        </div>
      )}

      {state === 'error' && (
        <div className="rounded-2xl px-4 py-3.5 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          Die Neuigkeit konnte gerade nicht geladen werden. Bitte versuch es gleich noch einmal.
        </div>
      )}

      {state === 'ready' && item && (
        <NewsDetailCard title={item.title} body={item.body} publishedAt={item.publishedAt} cta={ctaEl} secondary={backEl} />
      )}
    </div>
  )
}
