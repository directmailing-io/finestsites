'use client'

import { NewsLogoGlyph } from './NewsLogoGlyph'
import { NEWS_TOKENS } from './news-ui'

/**
 * Vorschau der Push-Mitteilung für den Admin-Editor: iPhone-Sperrbildschirm (Glas-Karte auf
 * dunklem Lila-Verlauf) und Android-Karte (dunkel, aufgeklappt). Texte kommen live aus dem Formular.
 */

const PLACEHOLDER_TITLE = 'Titel der Mitteilung'
const PLACEHOLDER_BODY = 'Der Text der Mitteilung erscheint hier, sobald du ihn schreibst.'

export function IphoneLockPreview({ title, body }: { title: string; body: string }) {
  const t = title.trim() || PLACEHOLDER_TITLE
  const b = body.trim() || PLACEHOLDER_BODY
  const empty = !title.trim() && !body.trim()
  return (
    <div style={{
      borderRadius: 26, padding: '22px 12px 16px', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(180deg, #2B1A5E 0%, #5B3BB0 55%, #A98BE0 100%)',
    }}>
      <div aria-hidden style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 74, height: 20, borderRadius: 999, background: '#000' }} />
      <div style={{ textAlign: 'center', color: '#fff', marginTop: 8 }}>
        <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-1.5px', lineHeight: 1 }}>9:41</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{lockDateLabel()}</div>
      </div>
      <div style={{
        marginTop: 46, background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 20, padding: '10px 12px', color: '#111', display: 'flex', gap: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)', opacity: empty ? 0.75 : 1,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', border: '1px solid #eee' }}>
          <NewsLogoGlyph height={22} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: title.trim() ? '#111' : '#777' }}>{t}</span>
            <span style={{ fontSize: 11, color: '#555', flex: 'none' }}>jetzt</span>
          </div>
          <div style={{
            fontSize: 12.5, lineHeight: 1.35, color: body.trim() ? '#222' : '#777', marginTop: 1,
            display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere',
          }}>{b}</div>
        </div>
      </div>
    </div>
  )
}

export function AndroidCardPreview({ title, body }: { title: string; body: string }) {
  const t = title.trim() || PLACEHOLDER_TITLE
  const b = body.trim() || PLACEHOLDER_BODY
  return (
    <div style={{ background: '#1F1F1F', borderRadius: 16, padding: '10px 14px 12px', color: '#EEE', fontSize: 12.5, lineHeight: 1.4 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#BBB', marginBottom: 4 }}>
        <span aria-hidden style={{ width: 12, height: 12, borderRadius: 3, background: NEWS_TOKENS.accent, display: 'inline-block' }} />
        FinestSites · jetzt
      </div>
      <div style={{ color: title.trim() ? '#fff' : '#999', fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere' }}>{t}</div>
      <div style={{ color: body.trim() ? '#EEE' : '#999', overflowWrap: 'anywhere' }}>{b}</div>
    </div>
  )
}

function lockDateLabel(): string {
  return new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
}
