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
const PAGE_SIZE = 12

// ── Unique fake website preview layouts for coming-soon cards ──────────────

function FakeLayoutLinkInBio({ accent }: { accent: string }) {
  return (
    <div style={{ padding: '0' }}>
      {/* Nav */}
      <div style={{ height: 36, background: '#fff', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: accent }} />
        <div style={{ flex: 1, display: 'flex', gap: 6, marginLeft: 8 }}>
          <div style={{ width: 40, height: 8, borderRadius: 4, background: '#e0e0e0' }} />
          <div style={{ width: 40, height: 8, borderRadius: 4, background: '#e0e0e0' }} />
        </div>
        <div style={{ width: 52, height: 22, borderRadius: 11, background: accent }} />
      </div>
      {/* Hero */}
      <div style={{ padding: '18px 14px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: '#fff' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: accent }} />
        <div style={{ width: 120, height: 11, borderRadius: 6, background: '#222' }} />
        <div style={{ width: 80, height: 8, borderRadius: 4, background: '#bbb' }} />
      </div>
      {/* Link cards */}
      <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 38, borderRadius: 10, background: i === 1 ? accent : '#fff', border: `1.5px solid ${i === 1 ? accent : '#e8e8e8'}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: i === 1 ? 'rgba(255,255,255,0.3)' : accent + '33' }} />
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: i === 1 ? 'rgba(255,255,255,0.5)' : '#ddd' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function FakeLayoutEvent({ accent }: { accent: string }) {
  return (
    <div>
      {/* Hero image area */}
      <div style={{ height: 80, background: accent, display: 'flex', alignItems: 'flex-end', padding: '0 14px 10px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 10, right: 12, background: '#fff', borderRadius: 6, padding: '4px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: 20, height: 8, borderRadius: 3, background: accent }} />
          <div style={{ width: 24, height: 12, borderRadius: 3, background: '#222' }} />
        </div>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.9)' }} />
      </div>
      {/* Event info */}
      <div style={{ background: '#fff', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ width: 140, height: 12, borderRadius: 6, background: '#111' }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: accent }} />
          <div style={{ width: 90, height: 8, borderRadius: 4, background: '#ccc' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: accent + '88' }} />
          <div style={{ width: 110, height: 8, borderRadius: 4, background: '#ccc' }} />
        </div>
        <div style={{ marginTop: 4, height: 34, borderRadius: 8, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 80, height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.6)' }} />
        </div>
      </div>
      {/* Two cards */}
      <div style={{ padding: '0 10px', display: 'flex', gap: 7 }}>
        {[1,2].map(i => (
          <div key={i} style={{ flex: 1, height: 46, borderRadius: 8, background: i === 1 ? '#f5f5f7' : '#fff', border: '1px solid #eee' }} />
        ))}
      </div>
    </div>
  )
}

function FakeLayoutProduct({ accent }: { accent: string }) {
  return (
    <div>
      {/* Nav */}
      <div style={{ height: 32, background: '#fff', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
        <div style={{ width: 70, height: 10, borderRadius: 4, background: '#222', fontWeight: 700 }} />
        <div style={{ flex: 1 }} />
        {[1,2,3].map(i => <div key={i} style={{ width: 28, height: 7, borderRadius: 3, background: '#e0e0e0' }} />)}
        <div style={{ width: 40, height: 20, borderRadius: 10, background: accent }} />
      </div>
      {/* Hero: text left, image right */}
      <div style={{ display: 'flex', padding: '14px 12px', gap: 10, background: '#fff' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ width: '90%', height: 13, borderRadius: 6, background: '#111' }} />
          <div style={{ width: '75%', height: 13, borderRadius: 6, background: '#111' }} />
          <div style={{ width: '85%', height: 8, borderRadius: 4, background: '#ccc', marginTop: 4 }} />
          <div style={{ width: '70%', height: 8, borderRadius: 4, background: '#ccc' }} />
          <div style={{ marginTop: 8, width: 70, height: 24, borderRadius: 6, background: accent }} />
        </div>
        <div style={{ width: 70, height: 80, borderRadius: 10, background: accent + '55', flexShrink: 0 }} />
      </div>
      {/* Feature chips */}
      <div style={{ padding: '6px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 22, width: i * 32 + 28, borderRadius: 12, background: i === 1 ? accent : '#f0f0f0' }} />
        ))}
      </div>
    </div>
  )
}

function FakeLayoutBusiness({ accent }: { accent: string }) {
  return (
    <div>
      {/* Header bar */}
      <div style={{ height: 44, background: '#1a1a2e', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: accent }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ width: 80, height: 8, borderRadius: 4, background: '#fff' }} />
          <div style={{ width: 50, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.3)' }} />
        </div>
        <div style={{ width: 60, height: 22, borderRadius: 11, background: accent }} />
      </div>
      {/* Two-col profile */}
      <div style={{ display: 'flex', background: '#fff', padding: '12px', gap: 10 }}>
        <div style={{ width: 64, height: 64, borderRadius: 10, background: accent + '44', flexShrink: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', width: 40, height: 40, borderRadius: '50%', background: accent }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 4 }}>
          <div style={{ width: '80%', height: 10, borderRadius: 5, background: '#111' }} />
          <div style={{ width: '60%', height: 8, borderRadius: 4, background: '#bbb' }} />
          {/* Stats */}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ width: 24, height: 10, borderRadius: 4, background: accent }} />
                <div style={{ width: 28, height: 6, borderRadius: 3, background: '#e0e0e0' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* About rows */}
      <div style={{ padding: '4px 12px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[1,2].map(i => (
          <div key={i} style={{ height: 28, borderRadius: 7, background: '#f5f5f7', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: accent }} />
            <div style={{ flex: 1, height: 7, borderRadius: 3, background: '#ddd' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TemplateCard({ tpl, idx }: { tpl: TemplateCardData; idx: number }) {
  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const cover = images[0] ?? null
  const pastel = PASTEL_COLORS[idx % PASTEL_COLORS.length]
  const isComingSoon = tpl.isComingSoon ?? false

  if (isComingSoon) {
    const accent = pastel
    // Cycle through 4 unique layout types
    const layoutType = idx % 4

    const fakeLayout = (() => {
      switch (layoutType) {
        case 1: return <FakeLayoutEvent accent={accent} />
        case 2: return <FakeLayoutProduct accent={accent} />
        case 3: return <FakeLayoutBusiness accent={accent} />
        default: return <FakeLayoutLinkInBio accent={accent} />
      }
    })()

    return (
      <div style={{ display: 'block', borderRadius: 18, overflow: 'hidden', background: '#fff', border: '1px solid #ebebeb', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', cursor: 'default' }}>
        {/* Cover — blurred fake website preview */}
        <div style={{ height: 260, background: '#f5f5f7', position: 'relative', overflow: 'hidden' }}>
          {/* Fake site layout — blurred */}
          <div style={{ position: 'absolute', inset: 0, filter: 'blur(7px)', transform: 'scale(1.05)' }}>
            {fakeLayout}
          </div>

          {/* Slight overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.35)' }} />

          {/* Badge */}
          <div style={{ position: 'absolute', top: 12, right: 12, background: '#111', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100 }}>
            Coming Soon
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>
            🤫
          </div>
        </div>

        {/* Card body */}
        <div style={{ padding: '16px 18px 20px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <CompanyChip name={tpl.nmCompanies[0]} isAllrounder={tpl.isAllrounder} size="xs" />
            <PriceChip isFree={tpl.isFree} size="xs" />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 6, lineHeight: 1.3 }}>{tpl.title}</h3>
          {tpl.description && (
            <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {tpl.description}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#bbb', filter: 'blur(4px)', userSelect: 'none' }}>domain.de</span>
            <span style={{ fontSize: 12, color: '#bbb', fontWeight: 600 }}>Demnächst verfügbar</span>
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
