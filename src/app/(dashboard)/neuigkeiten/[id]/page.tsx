'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { NewsItem, NewsActionResponse } from '@/lib/contracts/app-v1/news'
import { NewsDetailCard, newsPrimaryButtonStyle, newsQuietLinkStyle } from '@/components/news/NewsDetailCard'
import { NEWS_CTA_ROUTES, NEWS_SHADOW_CLASS, NEWS_TOKENS } from '@/components/news/news-ui'
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
  // Pfeil rechts vom Text: ruht leicht zurückgenommen, rückt beim Schweben 2 px nach rechts
  const arrow = (
    <svg className="transition-transform duration-[180ms] group-hover:translate-x-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.85 }}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
  const ctaEl = cta ? (
    cta.kind === 'url' && cta.url ? (
      <a href={cta.url} target="_blank" rel="noopener noreferrer" style={newsPrimaryButtonStyle}
        className="group transition-[transform,background-color] duration-[180ms] hover:bg-black active:scale-[0.985]"
        onClick={e => { trackCta(); openExternal(e, cta.url!) }}>
        {cta.label}
        {arrow}
      </a>
    ) : (
      <Link href={NEWS_CTA_ROUTES[cta.kind as keyof typeof NEWS_CTA_ROUTES] ?? '/sites'} style={newsPrimaryButtonStyle}
        className="group transition-[transform,background-color] duration-[180ms] hover:bg-black active:scale-[0.985]" onClick={trackCta}>
        {cta.label}
        {arrow}
      </Link>
    )
  ) : null

  const backEl = (
    <button type="button" style={newsQuietLinkStyle} className="transition-colors duration-150 hover:text-gray-900 hover:bg-gray-50"
      onClick={() => router.push('/neuigkeiten')}>
      {cta ? 'Später' : 'Zurück zu den Neuigkeiten'}
    </button>
  )

  return (
    <div className="mx-auto" style={{ maxWidth: 680 }}>
      <Link href="/neuigkeiten" className="group inline-flex items-center gap-1 mb-5 sm:mb-6"
        style={{ fontSize: 14.5, fontWeight: 600, color: NEWS_TOKENS.secondary, textDecoration: 'none', marginLeft: -4, padding: '6px 8px 6px 4px', borderRadius: 999 }}>
        <svg className="transition-transform duration-[180ms] group-hover:-translate-x-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
        Neuigkeiten
      </Link>

      {state === 'loading' && (
        <div className={`animate-pulse bg-white overflow-hidden ${NEWS_SHADOW_CLASS}`} style={{ borderRadius: NEWS_TOKENS.detailRadius }} aria-hidden>
          <div className="h-[150px] sm:h-[200px]" style={{ background: '#EDE9FE' }} />
          <div className="px-5 py-6 sm:px-8 sm:py-8 flex flex-col gap-3.5">
            <div className="h-2.5 rounded-full bg-gray-100 w-1/4" />
            <div className="h-6 rounded-full bg-gray-100 w-4/5" />
            <div className="h-3.5 rounded-full bg-gray-100 w-full mt-2" />
            <div className="h-3.5 rounded-full bg-gray-100 w-11/12" />
            <div className="h-3.5 rounded-full bg-gray-100 w-2/3" />
            <div className="h-[52px] rounded-full bg-gray-100 w-full mt-5" />
          </div>
        </div>
      )}

      {state === 'missing' && (
        <div className={`bg-white text-center px-6 py-14 ${NEWS_SHADOW_CLASS}`} style={{ borderRadius: NEWS_TOKENS.detailRadius }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', color: NEWS_TOKENS.ink }}>Diese Neuigkeit gibt es nicht mehr.</h1>
          <p style={{ margin: '6px 0 0', fontSize: 15, color: NEWS_TOKENS.secondary }}>Vielleicht wurde sie inzwischen zurückgezogen.</p>
          <Link href="/neuigkeiten" className="inline-flex items-center justify-center mt-6 px-6" style={{ ...newsPrimaryButtonStyle, width: 'auto', minHeight: 46, fontSize: 15 }}>
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
        <NewsDetailCard title={item.title} body={item.body} publishedAt={item.publishedAt} cta={ctaEl} secondary={backEl} paletteKey={item.id} />
      )}
    </div>
  )
}
