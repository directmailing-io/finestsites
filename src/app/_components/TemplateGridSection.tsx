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

const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
]

function startWithTemplate(templateId: string, templateTitle: string) {
  document.cookie = `fs_template_intent=${templateId}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`
  window.location.href = `${APP_URL}/register?template=${encodeURIComponent(templateId)}&tname=${encodeURIComponent(templateTitle)}`
}

function TemplateCard({ tpl, idx, onPreview }: { tpl: TemplateCardData; idx: number; onPreview: (id: string) => void }) {
  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const cover = images[0] ?? null
  const companyLabel = tpl.nmCompanies[0] ?? null
  const gradient = GRADIENTS[idx % GRADIENTS.length]

  if (tpl.isComingSoon) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden', background: '#fff', border: '1.5px solid #E5E7EB', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
        <div style={{ height: 240, background: gradient, position: 'relative', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 52, fontWeight: 900, color: 'rgba(255,255,255,0.18)', textAlign: 'center', padding: '0 20px', lineHeight: 1.1, userSelect: 'none', letterSpacing: '-0.02em' }}>
            {tpl.title}
          </span>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to top, rgba(0,0,0,0.2), transparent)' }} />
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 100 }}>
            Bald
          </div>
        </div>
        <div style={{ padding: '16px 20px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {companyLabel && (
            <p style={{ fontSize: 10, fontWeight: 600, color: '#9d7ecc', margin: '0 0 5px' }}>
              Geeignet für {companyLabel}
            </p>
          )}
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', lineHeight: 1.3, margin: 0, flex: 1 }}>
            {tpl.title}
          </h3>
        </div>
        <div style={{ padding: '10px 20px 14px', background: '#FAFAFA', borderTop: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#C4B5FD', letterSpacing: '0.06em', textTransform: 'uppercase' }}>In Kürze verfügbar</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden', background: '#fff', border: '1.5px solid #e8e3f0', boxShadow: '0 2px 16px rgba(128,96,176,0.08)', transition: 'box-shadow 0.2s, transform 0.2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 36px rgba(128,96,176,0.16)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 16px rgba(128,96,176,0.08)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
    >
      <div style={{ height: 240, background: '#F3F4F6', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
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
      <div style={{ padding: '16px 20px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {companyLabel && (
          <p style={{ fontSize: 10, fontWeight: 600, color: '#9d7ecc', margin: '0 0 5px' }}>
            Geeignet für {companyLabel}
          </p>
        )}
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', lineHeight: 1.3, margin: 0, flex: 1 }}>
          {tpl.title}
        </h3>
      </div>
      <div style={{ padding: '10px 20px 14px', display: 'flex', gap: 8 }}>
        <button
          onClick={() => startWithTemplate(tpl.id, tpl.title)}
          style={{ flex: 1, background: '#8060b0', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.01em' }}
        >
          Jetzt bearbeiten
        </button>
        <button
          onClick={() => onPreview(tpl.id)}
          style={{ flex: 1, background: 'transparent', color: '#6B7280', border: '1.5px solid #E5E7EB', borderRadius: 10, padding: '10px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Vorschau
        </button>
      </div>
    </div>
  )
}

// All supported NM companies as tabs (static list so every company always appears)
const COMPANY_TABS = ['Alle', ...NM_COMPANIES]

export default function TemplateGridSection({ templates }: { templates: TemplateCardData[] }) {
  const [activeFilter, setActiveFilter] = useState<string>('Alle')
  const [previewId, setPreviewId] = useState<string | null>(null)

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
      {/* Preview modal */}
      {previewId && (
        <div
          onClick={() => setPreviewId(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 1100, height: '85vh',
              background: '#fff', borderRadius: 16, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            }}
          >
            {/* Modal header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Vorschau</span>
              <button
                onClick={() => setPreviewId(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6B7280', padding: '2px 6px', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <iframe
              src={`/api/templates/${previewId}/public-preview`}
              style={{ flex: 1, border: 'none', display: 'block' }}
              title="Template-Vorschau"
            />
          </div>
        </div>
      )}

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
          <TemplateCard key={tpl.id} tpl={tpl} idx={i} onPreview={setPreviewId} />
        ))}
      </div>
    </>
  )
}
