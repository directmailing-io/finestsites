'use client'

import { useState, useMemo } from 'react'

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
}

const BADGE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  brandneu:  { bg: '#7C3AED', color: '#fff', label: 'Brandneu' },
  beliebt:   { bg: '#EA580C', color: '#fff', label: 'Sehr beliebt' },
}

const PASTEL_COLORS = ['#DCD0ED', '#B8CCDB', '#EDCBA8', '#C8D8B8', '#F2C5C5', '#C5DFE0', '#EAD4B5', '#C5D4F2']
const PAGE_SIZE = 8

function TemplateCard({ tpl, idx }: { tpl: TemplateCardData; idx: number }) {
  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const cover = images[0] ?? null
  const pastel = PASTEL_COLORS[idx % PASTEL_COLORS.length]
  const badge = tpl.badge ? BADGE_STYLES[tpl.badge] ?? null : null

  return (
    <a
      href={`/vorlagen/${tpl.id}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block', borderRadius: 18, overflow: 'hidden', background: '#fff', border: '1px solid #ebebeb', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', transition: 'box-shadow 0.18s ease, transform 0.18s ease', cursor: 'pointer' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
    >
      {/* Cover image */}
      <div style={{ height: 260, background: pastel, position: 'relative', overflow: 'hidden' }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={tpl.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="21" /></svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{tpl.domain}</span>
          </div>
        )}

        {/* Badges overlay */}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tpl.isFree && (
            <span style={{ background: '#16A34A', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 100, letterSpacing: '0.04em' }}>KOSTENLOS</span>
          )}
          {badge && (
            <span style={{ background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 100, letterSpacing: '0.04em' }}>{badge.label.toUpperCase()}</span>
          )}
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '16px 18px 20px' }}>
        {/* NM Company chips */}
        {(tpl.isAllrounder || tpl.nmCompanies.length > 0) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {tpl.isAllrounder && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', padding: '2px 9px', borderRadius: 100 }}>Für alle Unternehmen</span>
            )}
            {!tpl.isAllrounder && tpl.nmCompanies.map(c => (
              <span key={c} style={{ fontSize: 11, fontWeight: 600, color: '#8060b0', background: '#F5F0FB', padding: '2px 9px', borderRadius: 100 }}>{c}</span>
            ))}
          </div>
        )}

        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 6, lineHeight: 1.3 }}>{tpl.title}</h3>

        {tpl.description && (
          <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {tpl.description}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: '#bbb' }}>{tpl.domain}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#8060b0' }}>Ansehen →</span>
        </div>
      </div>
    </a>
  )
}

export default function TemplateGridSection({ templates }: { templates: TemplateCardData[] }) {
  const [activeCompany, setActiveCompany] = useState<string>('Alle')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Collect all unique NM companies across templates
  const allCompanies = useMemo(() => {
    const set = new Set<string>()
    templates.forEach(t => t.nmCompanies.forEach(c => set.add(c)))
    return Array.from(set).sort()
  }, [templates])

  // Filter: allrounder templates always match; otherwise filter by nmCompanies
  const filtered = useMemo(() =>
    activeCompany === 'Alle'
      ? templates
      : templates.filter(t => t.isAllrounder || t.nmCompanies.includes(activeCompany)),
    [templates, activeCompany]
  )

  const visible = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount

  return (
    <>
      {/* Filter chips */}
      {allCompanies.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 }}>
          {['Alle', ...allCompanies].map(company => (
            <button
              key={company}
              onClick={() => { setActiveCompany(company); setVisibleCount(PAGE_SIZE) }}
              style={{
                background: activeCompany === company ? '#111' : '#fff',
                color: activeCompany === company ? '#fff' : '#555',
                border: activeCompany === company ? '1.5px solid #111' : '1.5px solid #e0e0e0',
                borderRadius: 100,
                padding: '7px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {company}
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
