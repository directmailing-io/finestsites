'use client'

import { useState } from 'react'
import { COMING_SOON_PASTEL } from '@/components/FakeWebsitePreview'
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

const PASTEL_COLORS = COMING_SOON_PASTEL

function TemplateCard({ tpl, idx }: { tpl: TemplateCardData; idx: number }) {
  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const cover = images[0] ?? null
  const pastel = PASTEL_COLORS[idx % PASTEL_COLORS.length]
  const companyLabel = tpl.nmCompanies[0] ?? null

  if (tpl.isComingSoon) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 20,
        overflow: 'hidden',
        background: '#fff',
        border: '1.5px solid #E5E7EB',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}>
        {/* Preview — same height as real card, blurred content */}
        <div style={{ height: 240, background: pastel, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>🤫</div>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'absolute', top: 12, right: 12, background: '#111', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100 }}>
            Bald
          </div>
        </div>
        {/* Body */}
        <div style={{ padding: '16px 20px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {companyLabel && (
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9d7ecc', letterSpacing: '0.07em', textTransform: 'uppercase', margin: '0 0 5px' }}>
              {companyLabel}
            </p>
          )}
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#9CA3AF', lineHeight: 1.3, margin: 0, flex: 1 }}>
            {tpl.title}
          </h3>
        </div>
        {/* Footer */}
        <div style={{ padding: '10px 20px 14px', background: '#F5F5F7', borderTop: '1px solid #EBEBED', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Bald verfügbar</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1' }}>···</span>
        </div>
      </div>
    )
  }

  return (
    <a
      href={`/vorlagen/${tpl.id}`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 20,
        overflow: 'hidden',
        background: '#fff',
        border: '1.5px solid #E5E7EB',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        transition: 'box-shadow 0.2s, transform 0.2s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)'
        el.style.transform = 'translateY(-4px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.05)'
        el.style.transform = 'translateY(0)'
      }}
    >
      {/* Preview image */}
      <div style={{ height: 240, background: pastel, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={tpl.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="21" />
            </svg>
          </div>
        )}
      </div>
      {/* Card body */}
      <div style={{ padding: '16px 20px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {companyLabel && (
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9d7ecc', letterSpacing: '0.07em', textTransform: 'uppercase', margin: '0 0 5px' }}>
            {companyLabel}
          </p>
        )}
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', lineHeight: 1.3, margin: 0, flex: 1 }}>
          {tpl.title}
        </h3>
      </div>
      {/* Gray footer */}
      <div style={{ padding: '10px 20px 14px', background: '#F5F5F7', borderTop: '1px solid #EBEBED', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Vorlage ansehen</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>→</span>
      </div>
    </a>
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
        {filtered.map((tpl, i) => (
          <TemplateCard key={tpl.id} tpl={tpl} idx={i} />
        ))}
      </div>
    </>
  )
}
