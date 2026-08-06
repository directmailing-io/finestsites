'use client'

import { useState } from 'react'
import { NM_COMPANIES } from '@/lib/constants/nm-companies'

export interface TemplateCardData {
  id: string
  title: string
  description: string | null
  domain: string
  isFree: boolean
  badge: string | null
  tags: string[]
  nmCompanies: string[]
  isAllrounder: boolean
  previewImages: unknown
  isComingSoon?: boolean
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')

function startWithTemplate(templateId: string, templateTitle: string) {
  document.cookie = `fs_template_intent=${templateId}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`
  window.location.href = `${APP_URL}/register?template=${encodeURIComponent(templateId)}&tname=${encodeURIComponent(templateTitle)}`
}

const CARD_BASE: React.CSSProperties = {
  borderRadius: 16,
  overflow: 'hidden',
  background: '#fff',
  border: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  display: 'flex',
  flexDirection: 'column',
  transition: 'box-shadow 0.18s, transform 0.18s',
}

// Compact DE + GB flag SVGs (12x12) — surfaced on template cards so users see
// at a glance which templates ship with both German and English content.
function LanguageFlags() {
  return (
    <span
      title="Verfügbar auf Deutsch und Englisch"
      aria-label="Verfügbar auf Deutsch und Englisch"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 6, verticalAlign: 'middle' }}
    >
      <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" style={{ borderRadius: '50%', boxShadow: '0 0 0 1px rgba(255,255,255,0.6)' }}>
        <rect width="20" height="6.67" y="0" fill="#000" />
        <rect width="20" height="6.67" y="6.67" fill="#DD0000" />
        <rect width="20" height="6.66" y="13.34" fill="#FFCE00" />
      </svg>
      <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" style={{ borderRadius: '50%', boxShadow: '0 0 0 1px rgba(255,255,255,0.6)' }}>
        <rect width="20" height="20" fill="#012169" />
        <path d="M0 0 L20 20 M20 0 L0 20" stroke="#fff" strokeWidth="4" />
        <path d="M0 0 L20 20 M20 0 L0 20" stroke="#C8102E" strokeWidth="2" />
        <path d="M10 0 V20 M0 10 H20" stroke="#fff" strokeWidth="6" />
        <path d="M10 0 V20 M0 10 H20" stroke="#C8102E" strokeWidth="3.5" />
      </svg>
    </span>
  )
}

function TemplateCard({ tpl }: { tpl: TemplateCardData }) {
  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const cover = images[0] ?? null
  const companyLabel = tpl.nmCompanies[0] ?? null
  const isMultilingual = tpl.tags.includes('multilingual')

  if (tpl.isComingSoon) {
    return (
      <div style={CARD_BASE}>
        {/* Image — same structure as regular card */}
        <div style={{ position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/coming-soon.png" alt="Coming Soon" style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 35%, transparent 60%)' }} />
          <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }}>
            {companyLabel && <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: '0 0 4px' }}>Geeignet für {companyLabel}</p>}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2, margin: 0, textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>{tpl.title}</h3>
          </div>
        </div>
        {/* White bar — same height as regular card bottom, blurred domain + coming soon badge */}
        <div style={{ padding: '12px 16px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none' }}>
              {tpl.domain}
            </span>
            <span style={{ background: '#111827', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 100, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={CARD_BASE}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.13)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
    >
      <div style={{ position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={tpl.title} style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', aspectRatio: '16/10', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="21" />
            </svg>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 38%, rgba(0,0,0,0.1) 68%, transparent 100%)' }} />
        <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }}>
          {companyLabel && <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.8)', margin: '0 0 4px' }}>Geeignet für {companyLabel}</p>}
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2, margin: 0, textShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>
            {tpl.title}
            {isMultilingual && <LanguageFlags />}
          </h3>
        </div>
      </div>
      <div style={{ padding: '12px 16px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{tpl.domain}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => window.open(`https://demo.${tpl.domain}`, '_blank')}
              style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 100, padding: '6px 14px', fontSize: 11, fontWeight: 600, color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Vorschau
            </button>
            <button
              onClick={() => startWithTemplate(tpl.id, tpl.title)}
              style={{ background: '#8060b0', border: 'none', borderRadius: 100, padding: '6px 16px', fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Starten →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// All supported NM companies as tabs (static list so every company always appears)
const COMPANY_TABS = ['Alle', ...NM_COMPANIES]

export default function TemplateGridSection({ templates }: { templates: TemplateCardData[] }) {
  const [activeFilter, setActiveFilter] = useState<string>('Alle')

  const filtered = activeFilter === 'Alle'
    ? templates
    : templates.filter(t => t.nmCompanies.includes(activeFilter))

  if (templates.length === 0) {
    return (
      <p style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '40px 0' }}>
        Templates folgen in Kürze.
      </p>
    )
  }

  return (
    <>
      {/* Company tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 36, overflowX: 'auto' }}>
          {COMPANY_TABS.map(opt => (
            <button
              key={opt}
              onClick={() => setActiveFilter(opt)}
              style={{
                background: activeFilter === opt ? '#111' : '#fff',
                color: activeFilter === opt ? '#fff' : '#555',
                border: activeFilter === opt ? '1.5px solid #111' : '1.5px solid #e0e0e0',
                borderRadius: 100,
                padding: '7px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {opt}
            </button>
          ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '32px 0' }}>
          Für {activeFilter} folgen Templates in Kürze.
        </p>
      )}
      <div className="fs-template-grid">
        {filtered.map((tpl) => (
          <TemplateCard key={tpl.id} tpl={tpl} />
        ))}
      </div>
    </>
  )
}
