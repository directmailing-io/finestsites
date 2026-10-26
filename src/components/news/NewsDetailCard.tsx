'use client'

import type { ReactNode } from 'react'
import { NewsBodyBlocks } from './NewsBodyBlocks'
import { NewsHeroBand } from './NewsHeroBand'
import { NEWS_SHADOW_CLASS, NEWS_TOKENS, formatNewsDate, newsPalette } from './news-ui'

/**
 * Die Neuigkeit, wie sie Nutzer sehen (Web-Detail; die Admin-Vorschau nutzt `compact`):
 * hohes Kopfband im Markenverlauf der Neuigkeit, darunter im Weißen der Datums-Kicker, die große
 * Schlagzeile, der Vorspann und der Inhalt (newsBodyBlocks), zum Schluss Knopf + leiser Zweitlink.
 * `cta` und `secondary` sind fertige Elemente, damit Web-Routen/Links außen entschieden werden.
 */
export function NewsDetailCard({
  title, body, publishedAt, cta, secondary, compact = false, paletteKey,
}: {
  title: string
  body: string
  publishedAt: string | null
  cta?: ReactNode
  secondary?: ReactNode
  /** Admin-Vorschau: kleinere Maße, gleicher Aufbau */
  compact?: boolean
  /** ID der Neuigkeit – bestimmt den Verlauf des Kopfbands (ohne ID: Standardverlauf) */
  paletteKey?: string | null
}) {
  const palette = newsPalette(paletteKey)
  const date = publishedAt ? formatNewsDate(publishedAt) : ''
  return (
    <article
      className={`overflow-hidden bg-white ${NEWS_SHADOW_CLASS}`}
      style={{ borderRadius: compact ? 22 : NEWS_TOKENS.detailRadius }}
    >
      <NewsHeroBand
        palette={palette}
        className={compact ? 'h-[112px]' : 'h-[150px] sm:h-[200px]'}
        wordmarkHeight={compact ? 12 : 15}
        inset={compact ? 18 : 28}
      />

      <div className={compact ? 'px-[18px] pt-5 pb-5' : 'px-5 pt-6 pb-6 sm:px-8 sm:pt-7 sm:pb-8'}>
        {date && (
          <time dateTime={publishedAt ?? undefined} style={{
            display: 'block', fontSize: compact ? 11 : 12, fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: NEWS_TOKENS.accent,
          }}>
            {date}
          </time>
        )}

        <h1
          className={compact ? 'text-[20px]' : 'text-[26px] sm:text-[32px]'}
          style={{
            margin: compact ? '8px 0 12px' : '10px 0 16px', fontWeight: 700, lineHeight: 1.15,
            letterSpacing: compact ? '-0.4px' : '-0.6px', color: NEWS_TOKENS.ink, overflowWrap: 'anywhere',
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: compact ? 10 : 14, marginTop: compact ? 20 : 30 }}>
            {cta}
            {secondary && <div style={{ display: 'flex', justifyContent: 'center' }}>{secondary}</div>}
          </div>
        )}
      </div>
    </article>
  )
}

/** Hauptknopf der Neuigkeit: schwarze Pille, volle Kartenbreite. Als Button, Link oder reines Element nutzbar. */
export const newsPrimaryButtonStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 52,
  padding: '14px 22px', borderRadius: 999, background: NEWS_TOKENS.ink, color: '#fff',
  fontWeight: 600, fontSize: 16, letterSpacing: '-0.1px', border: 'none', cursor: 'pointer', textDecoration: 'none',
  boxSizing: 'border-box',
}

/** Leiser Zweitlink unter dem Knopf („Später“) – reiner Text, kein Kasten. */
export const newsQuietLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 40,
  padding: '8px 14px', borderRadius: 999, background: 'transparent', color: NEWS_TOKENS.secondary,
  fontWeight: 600, fontSize: 14.5, border: 'none', cursor: 'pointer', textDecoration: 'none',
}
