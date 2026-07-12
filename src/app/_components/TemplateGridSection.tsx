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

function TemplateCard({ tpl, onPreview }: { tpl: TemplateCardData; onPreview: (id: string) => void }) {
  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const cover = images[0] ?? null
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
        {/* Preview — coming soon image */}
        <div style={{ height: 240, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/coming-soon.png" alt="Coming Soon" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', top: 12, right: 12, background: '#111', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100 }}>
            Bald
          </div>
        </div>
        {/* Body */}
        <div style={{ padding: '16px 20px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {companyLabel && (
            <p style={{ fontSize: 10, fontWeight: 600, color: '#9d7ecc', margin: '0 0 5px' }}>
              Geeignet für {companyLabel}
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 20,
      overflow: 'hidden',
      background: '#fff',
      border: '1.5px solid #E5E7EB',
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    }}>
      {/* Preview image */}
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
      {/* Card body */}
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
      {/* Footer with two action buttons */}
      <div style={{ padding: '10px 20px 14px', background: '#F5F5F7', borderTop: '1px solid #EBEBED', display: 'flex', gap: 8 }}>
        <button
          onClick={() => startWithTemplate(tpl.id, tpl.title)}
          style={{
            flex: 1, background: '#8060b0', color: '#fff', border: 'none',
            borderRadius: 10, padding: '9px 10px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Jetzt bearbeiten
        </button>
        <button
          onClick={() => onPreview(tpl.id)}
          style={{
            flex: 1, background: '#fff', color: '#374151',
            border: '1.5px solid #E5E7EB', borderRadius: 10, padding: '9px 10px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Vorschau ansehen
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
        {filtered.map((tpl) => (
          <TemplateCard key={tpl.id} tpl={tpl} onPreview={setPreviewId} />
        ))}
      </div>
    </>
  )
}
