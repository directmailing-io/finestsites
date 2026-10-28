'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import type { NewsColor } from '@/lib/contracts/app-v1/news'
import { NewsBodyBlocks } from './NewsBodyBlocks'
import { NEWS_SHADOW_HOVER_CLASS, NEWS_TOKENS, formatNewsDate, newsPalette } from './news-ui'
import { NEWS_ON_SOLID, newsSolidClass, newsSolidStyle } from './NewsSurface'

/**
 * Eine Neuigkeit in der Liste `/neuigkeiten` (Daniel 26.10.2026: nur eine Ansicht, Vorschau aufklappen).
 * Vollton-Karte im Pastellverlauf der Neuigkeit: Datum, „Neu“, Überschrift, zwei Zeilen Kurztext,
 * darunter ein stiller Textlink „Weiterlesen“ (kein Knopf am Rand). Aufgeklappt bleibt alles stehen,
 * der ganze Inhalt (newsBodyBlocks) und der Knopf wachsen darunter einfach nach unten auf
 * (grid-template-rows 0fr → 1fr), der Textlink wird zu „Zuklappen“.
 * Gleiche Karte in der App (mobile/src/features/news/NewsRow.tsx) und in der Admin-Vorschau.
 */
export function NewsCard({
  id, title, summary, body, publishedAt, color, unread, expanded, onToggle, cta, compact = false,
}: {
  id: string
  title: string
  summary: string
  body: string
  publishedAt: string | null
  color?: NewsColor | null
  unread: boolean
  expanded: boolean
  /** Tipp auf die Karte (zu) bzw. auf „Zuklappen“ (auf); fehlt er, ist die Karte reine Vorschau (Admin) */
  onToggle?: () => void
  /** Fertiger Knopf (Link/Button) für die aufgeklappte Karte */
  cta?: ReactNode
  /** Admin-Vorschau: kleinere Maße, gleicher Aufbau */
  compact?: boolean
}) {
  const palette = newsPalette(id, color)
  const radius = compact ? 20 : NEWS_TOKENS.cardRadius
  const ref = useRef<HTMLElement>(null)
  const interactive = !!onToggle

  // Beim Aufklappen die Karte in den Blick holen (Deep-Link ?open=<id> oder weit unten in der Liste)
  useEffect(() => {
    if (!expanded || !interactive || !ref.current) return
    const t = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect()
      if (r && (r.top < 0 || r.top > window.innerHeight * 0.5)) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
    return () => window.clearTimeout(t)
  }, [expanded, interactive])

  const pad = compact ? '18px 20px 20px' : undefined
  const chevron = (
    <svg className={`transition-transform duration-[220ms] ${expanded ? '-rotate-90' : 'rotate-90 group-hover:translate-y-0.5'}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.8 }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )

  return (
    <article
      ref={ref}
      className={`group ${newsSolidClass} ${interactive && !expanded ? `transition-[transform,box-shadow] duration-[180ms] ease-out ${NEWS_SHADOW_HOVER_CLASS}` : ''}`}
      style={{ ...newsSolidStyle(palette, radius), scrollMarginTop: 24 }}
      data-news-surface="solid"
      data-expanded={expanded ? 'true' : 'false'}
    >
      {/* Vorschau: als Ganzes tippbar, solange zugeklappt */}
      <button
        type="button"
        onClick={interactive && !expanded ? onToggle : undefined}
        aria-expanded={expanded}
        aria-controls={`news-body-${id}`}
        disabled={!interactive || expanded}
        className={compact ? '' : 'px-6 pt-6 pb-6 sm:px-8 sm:pt-7 sm:pb-7'}
        style={{
          display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: 'inherit', font: 'inherit',
          padding: pad, ...(expanded ? { paddingBottom: 0 } : {}), cursor: interactive && !expanded ? 'pointer' : 'default',
        }}
      >
        <div className="flex items-center gap-2.5" style={{ minHeight: 20 }}>
          <time dateTime={publishedAt ?? undefined} style={{
            fontSize: compact ? 11 : 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: NEWS_ON_SOLID.kicker, lineHeight: 1,
          }}>
            {publishedAt ? formatNewsDate(publishedAt) : ''}
          </time>
          {unread && (
            <span style={{
              fontSize: 11.5, fontWeight: 600, letterSpacing: '0.01em', lineHeight: 1,
              padding: '5px 9px', borderRadius: 999, background: NEWS_ON_SOLID.pill, color: NEWS_TOKENS.ink,
            }}>
              Neu
            </span>
          )}
        </div>

        <h2 className={compact ? 'text-[19px]' : 'text-[22px] sm:text-[25px]'} style={{
          margin: '12px 0 8px', fontWeight: 600, lineHeight: 1.22, letterSpacing: '-0.4px',
          color: NEWS_TOKENS.ink, overflowWrap: 'anywhere',
        }}>
          {title || <span style={{ color: NEWS_ON_SOLID.kicker }}>Überschrift der Neuigkeit</span>}
        </h2>

        {/* Kurztext bleibt auch aufgeklappt stehen (Vorspann), aufgeklappt in voller Länge */}
        <p style={{
          margin: 0, fontSize: compact ? 14 : 15.5, lineHeight: 1.6, color: NEWS_ON_SOLID.text, overflowWrap: 'anywhere',
          ...(expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }),
        }}>
          {summary}
        </p>
        {interactive && !expanded && (
          <span className="inline-flex items-center gap-1.5" style={{ marginTop: compact ? 12 : 16, fontSize: 14.5, fontWeight: 600, color: NEWS_TOKENS.ink, letterSpacing: '-0.1px' }}>
            Weiterlesen
            {chevron}
          </span>
        )}
        {!interactive && !expanded && <span style={{ display: 'block', height: compact ? 4 : 8 }} />}
      </button>

      {/* Aufgeklappt: Inhalt, Knopf, Zuklappen */}
      <div
        id={`news-body-${id}`}
        style={{
          display: 'grid', gridTemplateRows: expanded ? '1fr' : '0fr', opacity: expanded ? 1 : 0,
          transition: 'grid-template-rows 0.32s ease, opacity 0.24s ease',
        }}
        aria-hidden={!expanded}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div className={compact ? '' : 'px-6 pb-6 sm:px-8 sm:pb-8'} style={compact ? { padding: '0 20px 20px' } : undefined}>
            <div style={{ height: 1, background: NEWS_ON_SOLID.line, margin: compact ? '16px 0 16px' : '22px 0 22px' }} />
            {body.trim() ? (
              <NewsBodyBlocks body={body} size={compact ? 'sm' : 'md'} onSolid />
            ) : (
              <p style={{ margin: 0, color: NEWS_ON_SOLID.kicker, fontSize: compact ? 13.5 : 15.5 }}>
                Der Inhalt erscheint hier, sobald du ihn schreibst.
              </p>
            )}
            {(cta || interactive) && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: compact ? 6 : 10, marginTop: compact ? 18 : 26 }}>
                {cta}
                {interactive && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: cta ? 2 : 0 }}>
                    <button type="button" onClick={onToggle} className="group inline-flex items-center gap-1.5 transition-opacity duration-150 hover:opacity-100"
                      style={{ background: 'transparent', border: 'none', padding: '6px 0', cursor: 'pointer', fontSize: 14.5, fontWeight: 600, color: NEWS_TOKENS.ink, letterSpacing: '-0.1px', opacity: 0.8 }}>
                      Zuklappen
                      {chevron}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

/** Hauptknopf der Neuigkeit: schwarze Pille, volle Kartenbreite. Als Button, Link oder reines Element nutzbar. */
export const newsPrimaryButtonStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 50,
  padding: '13px 22px', borderRadius: 999, background: NEWS_TOKENS.ink, color: '#fff',
  fontWeight: 600, fontSize: 15.5, letterSpacing: '-0.1px', border: 'none', cursor: 'pointer', textDecoration: 'none',
  boxSizing: 'border-box',
}

/** Leiser Zweitlink unter dem Knopf („Zuklappen“) – reiner Text, kein Kasten. */
export const newsQuietLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 38,
  padding: '8px 14px', borderRadius: 999, background: 'transparent', color: NEWS_TOKENS.muted,
  fontWeight: 500, fontSize: 14, border: 'none', cursor: 'pointer', textDecoration: 'none',
}
