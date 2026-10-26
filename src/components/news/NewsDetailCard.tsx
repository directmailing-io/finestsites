'use client'

import type { ReactNode } from 'react'
import { NewsBodyBlocks } from './NewsBodyBlocks'
import { NEWS_SHEET_CLASS, NEWS_TOKENS, formatNewsDate, newsPalette } from './news-ui'

/**
 * Die Neuigkeit, wie sie Nutzer sehen (Web-Detail; die Admin-Vorschau nutzt `compact`):
 * ein weißes Blatt – Datums-Kicker in der Farbe der Neuigkeit, große Schlagzeile, darunter die kurze
 * Pastell-Linie, dann Vorspann und Inhalt (newsBodyBlocks), zum Schluss Knopf + leiser Zweitlink.
 * Kein Band, kein Logo, kein Bild. `cta` und `secondary` sind fertige Elemente, damit Web-Routen/Links außen entschieden werden.
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
  /** ID der Neuigkeit – bestimmt die Pastell-Linie (ohne ID: erste Palette) */
  paletteKey?: string | null
}) {
  const palette = newsPalette(paletteKey)
  const date = publishedAt ? formatNewsDate(publishedAt) : ''
  return (
    <article
      className={`${NEWS_SHEET_CLASS} ${compact ? 'px-[22px] pt-6 pb-6' : 'px-6 pt-8 pb-8 sm:px-10 sm:pt-10 sm:pb-10'}`}
      style={{ borderRadius: compact ? 20 : NEWS_TOKENS.detailRadius }}
    >
      {date && (
        <time dateTime={publishedAt ?? undefined} style={{
          display: 'block', fontSize: compact ? 11 : 12, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: palette.ink, lineHeight: 1,
        }}>
          {date}
        </time>
      )}

      <h1
        className={compact ? 'text-[21px]' : 'text-[28px] sm:text-[34px]'}
        style={{
          margin: compact ? '10px 0 0' : '14px 0 0', fontWeight: 700, lineHeight: 1.12,
          letterSpacing: compact ? '-0.5px' : '-0.8px', color: NEWS_TOKENS.ink, overflowWrap: 'anywhere',
        }}
      >
        {title || <span style={{ color: NEWS_TOKENS.tertiary, fontWeight: 600 }}>Überschrift der Neuigkeit</span>}
      </h1>

      {/* Die Pastell-Linie unter der Schlagzeile – kurz, linksbündig */}
      <span aria-hidden style={{
        display: 'block', width: compact ? 48 : 72, height: 3, borderRadius: 999, background: palette.gradient,
        margin: compact ? '12px 0 16px' : '18px 0 24px',
      }} />

      {body.trim() ? (
        <NewsBodyBlocks body={body} size={compact ? 'sm' : 'md'} palette={palette} />
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
