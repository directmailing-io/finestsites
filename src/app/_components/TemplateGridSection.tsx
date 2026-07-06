'use client'

import { useState, useMemo } from 'react'
import { FakeWebsitePreview, COMING_SOON_PASTEL } from '@/components/FakeWebsitePreview'

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
const PAGE_SIZE = 12

function TemplateCard({ tpl, idx }: { tpl: TemplateCardData; idx: number }) {
  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const cover = images[0] ?? null
  const pastel = PASTEL_COLORS[idx % PASTEL_COLORS.length]
  const isComingSoon = tpl.isComingSoon ?? false

  // Company label: "Allgemein" for allrounders, first NM company otherwise
  const companyLabel = tpl.isAllrounder ? 'Allgemein' : (tpl.nmCompanies[0] ?? null)

  // Template type label for the cover badge area
  const typeLabel = tpl.isAllrounder ? 'Standard' : 'Premium'

  if (isComingSoon) {
    return (
      <div style={{
        borderRadius: 18,
        overflow: 'hidden',
        background: '#fff',
        border: '1px solid #ebebeb',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        cursor: 'default',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Preview */}
        <div style={{ height: 220, background: '#f5f5f7', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <FakeWebsitePreview idx={idx} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.5)' }} />
          {/* Status pill — top left */}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: '#F3F4F6', color: '#9CA3AF',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '4px 10px', borderRadius: 100,
          }}>
            Kommt bald
          </div>
          {/* Type pill — top right */}
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: tpl.isAllrounder ? 'rgba(239,246,255,0.9)' : 'rgba(254,243,199,0.9)',
            color: tpl.isAllrounder ? '#1D4ED8' : '#92400E',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
            padding: '4px 10px', borderRadius: 100,
          }}>
            {typeLabel}
          </div>
        </div>
        {/* Body */}
        <div style={{ padding: '14px 16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {companyLabel && (
            <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', margin: 0 }}>{companyLabel}</p>
          )}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#9CA3AF', lineHeight: 1.3, margin: 0 }}>{tpl.title}</h3>
        </div>
      </div>
    )
  }

  return (
    <a
      href={`/vorlagen/${tpl.id}`}
      style={{
        textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column',
        borderRadius: 18, overflow: 'hidden',
        background: '#fff', border: '1.5px solid #8060b0',
        boxShadow: '0 4px 24px rgba(128,96,176,0.12)',
        transition: 'box-shadow 0.18s ease, transform 0.18s ease', cursor: 'pointer',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 36px rgba(128,96,176,0.22)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(128,96,176,0.12)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
    >
      {/* Cover */}
      <div style={{ height: 220, background: pastel, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={tpl.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="21" /></svg>
          </div>
        )}
        {/* Status pill — top left */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: '#D1FAE5', color: '#065F46',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '4px 10px', borderRadius: 100,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
          Verfügbar
        </div>
        {/* Type pill — top right */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: tpl.isAllrounder ? 'rgba(239,246,255,0.92)' : 'rgba(254,243,199,0.92)',
          color: tpl.isAllrounder ? '#1D4ED8' : '#92400E',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
          padding: '4px 10px', borderRadius: 100,
        }}>
          {typeLabel}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {companyLabel && (
          <p style={{ fontSize: 11, fontWeight: 600, color: '#8060b0', margin: 0 }}>{companyLabel}</p>
        )}
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', lineHeight: 1.3, margin: 0 }}>{tpl.title}</h3>
        {tpl.description && (
          <p style={{ fontSize: 12, color: '#777', lineHeight: 1.55, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {tpl.description}
          </p>
        )}
        <div style={{ marginTop: 'auto', paddingTop: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#8060b0' }}>Ansehen →</span>
        </div>
      </div>
    </a>
  )
}

export default function TemplateGridSection({ templates }: { templates: TemplateCardData[] }) {
  const [activeFilter, setActiveFilter] = useState<string>('Alle')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Build filter list: Alle → per NM company → Allgemein (last)
  const filterOptions = useMemo(() => {
    const companies = new Set<string>()
    let hasAllrounder = false
    templates.forEach(t => {
      if (t.isAllrounder) hasAllrounder = true
      else t.nmCompanies.forEach(c => companies.add(c))
    })
    const opts = ['Alle', ...Array.from(companies).sort()]
    if (hasAllrounder) opts.push('Allgemein')
    return opts
  }, [templates])

  const filtered = useMemo(() => {
    if (activeFilter === 'Alle') return templates
    if (activeFilter === 'Allgemein') return templates.filter(t => t.isAllrounder)
    return templates.filter(t => !t.isAllrounder && t.nmCompanies.includes(activeFilter))
  }, [templates, activeFilter])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount

  return (
    <>
      {/* Filter chips */}
      {filterOptions.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 }}>
          {filterOptions.map(opt => (
            <button
              key={opt}
              onClick={() => { setActiveFilter(opt); setVisibleCount(PAGE_SIZE) }}
              style={{
                background: activeFilter === opt ? '#111' : '#fff',
                color: activeFilter === opt ? '#fff' : '#555',
                border: activeFilter === opt ? '1.5px solid #111' : '1.5px solid #e0e0e0',
                borderRadius: 100,
                padding: '7px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {visible.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '40px 0' }}>Keine Vorlagen für diese Kategorie gefunden.</p>
      ) : (
        <div className="fs-template-grid">
          {visible.map((tpl, i) => (
            <TemplateCard key={tpl.id} tpl={tpl} idx={i} />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            style={{ background: '#fff', color: '#111', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 100, padding: '13px 32px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Weitere Vorlagen anzeigen ({filtered.length - visibleCount} mehr)
          </button>
        </div>
      )}
    </>
  )
}
