'use client'

import { useState, useMemo } from 'react'
import { CompanyChip, BadgeChip, PriceChip } from '@/components/TemplateChips'

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

const PASTEL_COLORS = ['#DCD0ED', '#B8CCDB', '#EDCBA8', '#C8D8B8', '#F2C5C5', '#C5DFE0', '#EAD4B5', '#C5D4F2']
const PAGE_SIZE = 8

function TemplateCard({ tpl, idx }: { tpl: TemplateCardData; idx: number }) {
  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const cover = images[0] ?? null
  const pastel = PASTEL_COLORS[idx % PASTEL_COLORS.length]
  const isComingSoon = tpl.isComingSoon ?? false

  if (isComingSoon) {
    return (
      <div style={{ display: 'block', borderRadius: 18, overflow: 'hidden', background: '#0e0e10', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', cursor: 'default' }}>
        {/* Cover — dark gradient with noise texture feel */}
        <div style={{ height: 260, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${pastel}22 0%, #0e0e10 60%)` }}>
          {/* Subtle color glow in corner */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: pastel, opacity: 0.18, filter: 'blur(48px)' }} />
          <div style={{ position: 'absolute', bottom: -20, left: -20, width: 120, height: 120, borderRadius: '50%', background: pastel, opacity: 0.12, filter: 'blur(36px)' }} />

          {/* Grid pattern overlay */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

          {/* Coming soon pill */}
          <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 11px', borderRadius: 100 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
            Coming Soon
          </div>

          {/* Emoji + title hint */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ fontSize: 52, lineHeight: 1 }}>🤫</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>In Entwicklung</div>
          </div>
        </div>

        {/* Card body */}
        <div style={{ padding: '16px 18px 20px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <CompanyChip name={tpl.nmCompanies[0]} isAllrounder={tpl.isAllrounder} size="xs" />
            <PriceChip isFree={tpl.isFree} size="xs" />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', marginBottom: 6, lineHeight: 1.3 }}>{tpl.title}</h3>
          {tpl.description && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {tpl.description}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', filter: 'blur(4px)', userSelect: 'none' }}>domain.de</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>Demnächst →</span>
          </div>
        </div>
      </div>
    )
  }

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
      </div>

      {/* Card body */}
      <div style={{ padding: '16px 18px 20px' }}>
        {/* Chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <CompanyChip name={tpl.nmCompanies[0]} isAllrounder={tpl.isAllrounder} size="xs" />
          <BadgeChip badge={tpl.badge} size="xs" />
          <PriceChip isFree={tpl.isFree} size="xs" />
        </div>

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
  const [activeFilter, setActiveFilter] = useState<string>('Alle')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Build filter list: Alle → Allgemein (if any allrounders) → per NM company
  const filterOptions = useMemo(() => {
    const companies = new Set<string>()
    let hasAllrounder = false
    templates.forEach(t => {
      if (t.isAllrounder) hasAllrounder = true
      else t.nmCompanies.forEach(c => companies.add(c))
    })
    const opts = ['Alle']
    if (hasAllrounder) opts.push('Allgemein')
    opts.push(...Array.from(companies).sort())
    return opts
  }, [templates])

  // Filter logic
  const filtered = useMemo(() => {
    if (activeFilter === 'Alle') return templates
    if (activeFilter === 'Allgemein') return templates.filter(t => t.isAllrounder)
    return templates.filter(t => !t.isAllrounder && t.nmCompanies.includes(activeFilter))
  }, [templates, activeFilter])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount

  return (
    <>
      {/* Filter chips — only shown when there are multiple options */}
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
