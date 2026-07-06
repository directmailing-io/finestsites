'use client'

import { useState, useMemo } from 'react'
import { COMING_SOON_PASTEL } from '@/components/FakeWebsitePreview'

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
  const isPremium = !tpl.isAllrounder
  const companyLabel = tpl.isAllrounder ? null : (tpl.nmCompanies[0] ?? null)

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
        border: isPremium ? '1.5px solid #D4B8F8' : '1px solid #E5E7EB',
        boxShadow: isPremium
          ? '0 4px 24px rgba(128,96,176,0.12)'
          : '0 2px 12px rgba(0,0,0,0.05)',
        transition: 'box-shadow 0.2s, transform 0.2s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = isPremium
          ? '0 14px 48px rgba(128,96,176,0.22)'
          : '0 10px 32px rgba(0,0,0,0.12)'
        el.style.transform = 'translateY(-4px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = isPremium
          ? '0 4px 24px rgba(128,96,176,0.12)'
          : '0 2px 12px rgba(0,0,0,0.05)'
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

      {/* Colored footer — the key visual differentiator */}
      <div style={{
        padding: '10px 20px 14px',
        background: isPremium
          ? 'linear-gradient(135deg, #F0E8FF 0%, #E8D5FF 100%)'
          : '#F5F5F7',
        borderTop: isPremium ? '1px solid #DFC8FF' : '1px solid #EBEBED',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: isPremium ? '#7C3AED' : '#9CA3AF',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          {isPremium ? '★ Premium' : 'Standard'}
        </span>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: isPremium ? '#7C3AED' : '#6B7280',
        }}>
          Ansehen →
        </span>
      </div>
    </a>
  )
}

export default function TemplateGridSection({ templates }: { templates: TemplateCardData[] }) {
  const [activeFilter, setActiveFilter] = useState<string>('Alle')

  const available = useMemo(() => templates.filter(t => !t.isComingSoon), [templates])

  const filterOptions = useMemo(() => {
    const companies = new Set<string>()
    let hasAllrounder = false
    available.forEach(t => {
      if (t.isAllrounder) hasAllrounder = true
      else t.nmCompanies.forEach(c => companies.add(c))
    })
    if (companies.size + (hasAllrounder ? 1 : 0) <= 1) return []
    const opts = ['Alle', ...Array.from(companies).sort()]
    if (hasAllrounder) opts.push('Standard')
    return opts
  }, [available])

  const filtered = useMemo(() => {
    if (activeFilter === 'Alle') return available
    if (activeFilter === 'Standard') return available.filter(t => t.isAllrounder)
    return available.filter(t => !t.isAllrounder && t.nmCompanies.includes(activeFilter))
  }, [available, activeFilter])

  if (available.length === 0) {
    return (
      <p style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '40px 0' }}>
        Templates folgen in Kürze.
      </p>
    )
  }

  return (
    <>
      {filterOptions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 36 }}>
          {filterOptions.map(opt => (
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
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      <div className="fs-template-grid">
        {filtered.map((tpl, i) => (
          <TemplateCard key={tpl.id} tpl={tpl} idx={i} />
        ))}
      </div>
    </>
  )
}
