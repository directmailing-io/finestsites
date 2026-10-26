'use client'

import type { ReactNode } from 'react'
import { NewsBodyBlocks } from './NewsBodyBlocks'
import { NewsLogoGlyph } from './NewsLogoGlyph'
import { NEWS_TOKENS, formatNewsDate } from './news-ui'

/**
 * Die Neuigkeit, wie sie Nutzer sehen (Web-Detail und App identisch): Karte mit Lila-Verlauf-Kopf
 * „FinestSites“, Kicker „NEUIGKEIT · Datum“, Überschrift, Inhalt (newsBodyBlocks), Knopf.
 * `cta` und `secondary` sind fertige Elemente, damit Web-Routen/Links außen entschieden werden.
 */
export function NewsDetailCard({
  title, body, publishedAt, cta, secondary, compact = false,
}: {
  title: string
  body: string
  publishedAt: string | null
  cta?: ReactNode
  secondary?: ReactNode
  /** Admin-Vorschau: etwas kleiner */
  compact?: boolean
}) {
  const pad = compact ? '16px 18px 18px' : '22px 24px 24px'
  return (
    <article style={{
      background: '#fff', border: `1px solid ${NEWS_TOKENS.line}`, borderRadius: NEWS_TOKENS.cardRadius,
      overflow: 'hidden', boxShadow: '0 4px 20px rgba(15,23,42,0.05)',
    }}>
      <div style={{
        height: compact ? 92 : 128, background: NEWS_TOKENS.heroGradient, position: 'relative',
        display: 'flex', alignItems: 'flex-end', padding: compact ? '0 18px 12px' : '0 24px 16px',
      }}>
        {/* weiche Lichtflecken, damit der Verlauf nicht flach wirkt */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,0.28), transparent 55%)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <span style={{
            width: compact ? 28 : 34, height: compact ? 28 : 34, borderRadius: compact ? 8 : 10, background: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}>
            <NewsLogoGlyph height={compact ? 16 : 19} />
          </span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: compact ? 14 : 16, letterSpacing: '-0.01em', textShadow: '0 1px 2px rgba(0,0,0,0.12)' }}>
            FinestSites
          </span>
        </div>
      </div>
      <div style={{ padding: pad }}>
        <div style={{ fontSize: compact ? 10.5 : 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: NEWS_TOKENS.accent }}>
          Neuigkeit{publishedAt ? ` · ${formatNewsDate(publishedAt)}` : ''}
        </div>
        <h1 style={{
          margin: compact ? '6px 0 10px' : '8px 0 14px', fontSize: compact ? 18 : 24, lineHeight: 1.25, fontWeight: 700,
          color: NEWS_TOKENS.ink, letterSpacing: '-0.02em', overflowWrap: 'anywhere',
        }}>
          {title || <span style={{ color: NEWS_TOKENS.tertiary }}>Überschrift der Neuigkeit</span>}
        </h1>
        {body.trim() ? (
          <NewsBodyBlocks body={body} size={compact ? 'sm' : 'md'} />
        ) : (
          <p style={{ margin: 0, color: NEWS_TOKENS.tertiary, fontSize: compact ? 13 : 15 }}>Der Inhalt erscheint hier, sobald du ihn schreibst.</p>
        )}
        {(cta || secondary) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: compact ? 14 : 20 }}>
            {cta}
            {secondary}
          </div>
        )}
      </div>
    </article>
  )
}

/** Hauptknopf der Neuigkeit (dunkel, Radius 16). Als Button, Link oder reines Element nutzbar. */
export const newsPrimaryButtonStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 48,
  padding: '12px 16px', borderRadius: 16, background: NEWS_TOKENS.ink, color: '#fff',
  fontWeight: 600, fontSize: 15, border: 'none', cursor: 'pointer', textDecoration: 'none',
  boxSizing: 'border-box',
}

export const newsSoftButtonStyle: React.CSSProperties = {
  ...newsPrimaryButtonStyle,
  background: '#F1F5F9', color: NEWS_TOKENS.ink,
}
