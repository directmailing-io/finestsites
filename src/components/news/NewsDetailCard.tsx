'use client'

import type { ReactNode } from 'react'
import type { NewsColor } from '@/lib/contracts/app-v1/news'
import { NewsBodyBlocks } from './NewsBodyBlocks'
import { NEWS_TOKENS, formatNewsDate, newsPalette } from './news-ui'
import { newsFrameClass, newsFrameInnerStyle, newsFrameStyle } from './NewsSurface'

/**
 * Die Neuigkeit, wie sie Nutzer sehen (Web-Detail; die Admin-Vorschau nutzt `compact`):
 * ein weißes Blatt mit feinem Verlaufsrahmen in der Farbe der Neuigkeit – Datum, große Schlagzeile,
 * Vorspann und Inhalt (newsBodyBlocks), Knopf, leiser Zweitlink.
 * `cta` und `secondary` sind fertige Elemente, damit Web-Routen/Links außen entschieden werden.
 */
export function NewsDetailCard({
  title, body, publishedAt, cta, secondary, compact = false, paletteKey, color,
}: {
  title: string
  body: string
  publishedAt: string | null
  cta?: ReactNode
  secondary?: ReactNode
  /** Admin-Vorschau: kleinere Maße, gleicher Aufbau */
  compact?: boolean
  /** ID der Neuigkeit – bestimmt die Farbe, wenn keine gewählt ist (ohne ID: erste Palette) */
  paletteKey?: string | null
  /** Gewählte Pastellfarbe (Admin) */
  color?: NewsColor | null
}) {
  const palette = newsPalette(paletteKey, color)
  const radius = compact ? 20 : NEWS_TOKENS.detailRadius
  const date = publishedAt ? formatNewsDate(publishedAt) : ''
  return (
    <article className={newsFrameClass} style={newsFrameStyle(palette, radius)} data-news-surface="framed">
      <div className={compact ? 'px-[22px] pt-6 pb-7' : 'px-6 pt-8 pb-9 sm:px-10 sm:pt-10 sm:pb-11'} style={newsFrameInnerStyle(radius)}>
        {date && (
          <time dateTime={publishedAt ?? undefined} style={{
            display: 'block', fontSize: compact ? 11 : 12, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: NEWS_TOKENS.tertiary, lineHeight: 1,
          }}>
            {date}
          </time>
        )}

        <h1
          className={compact ? 'text-[21px]' : 'text-[28px] sm:text-[34px]'}
          style={{
            margin: compact ? '10px 0 16px' : '14px 0 24px', fontWeight: 700, lineHeight: 1.12,
            letterSpacing: compact ? '-0.5px' : '-0.8px', color: NEWS_TOKENS.ink, overflowWrap: 'anywhere',
          }}
        >
          {title || <span style={{ color: NEWS_TOKENS.tertiary, fontWeight: 600 }}>Überschrift der Neuigkeit</span>}
        </h1>

        {body.trim() ? (
          <NewsBodyBlocks body={body} size={compact ? 'sm' : 'md'} />
        ) : (
          <p style={{ margin: 0, color: NEWS_TOKENS.tertiary, fontSize: compact ? 13.5 : 16 }}>
            Der Inhalt erscheint hier, sobald du ihn schreibst.
          </p>
        )}

        {(cta || secondary) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: compact ? 8 : 12, marginTop: compact ? 22 : 36 }}>
            {cta}
            {secondary && <div style={{ display: 'flex', justifyContent: 'center' }}>{secondary}</div>}
          </div>
        )}
      </div>
    </article>
  )
}

/** Hauptknopf der Neuigkeit: schwarze Pille, volle Blattbreite. Als Button, Link oder reines Element nutzbar. */
export const newsPrimaryButtonStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 52,
  padding: '14px 22px', borderRadius: 999, background: NEWS_TOKENS.ink, color: '#fff',
  fontWeight: 600, fontSize: 16, letterSpacing: '-0.1px', border: 'none', cursor: 'pointer', textDecoration: 'none',
  boxSizing: 'border-box',
}

/** Leiser Zweitlink unter dem Knopf („Später“) – reiner Text, kein Kasten. */
export const newsQuietLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 40,
  padding: '8px 14px', borderRadius: 999, background: 'transparent', color: NEWS_TOKENS.muted,
  fontWeight: 500, fontSize: 14.5, border: 'none', cursor: 'pointer', textDecoration: 'none',
}
