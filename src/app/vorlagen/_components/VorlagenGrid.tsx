'use client'

import { useState, useMemo } from 'react'
import { CompanyChip, BadgeChip } from '@/components/TemplateChips'
import { COMING_SOON_PASTEL } from '@/components/FakeWebsitePreview'

interface TemplateItem {
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
  isComingSoon: boolean
}

const PASTEL_COLORS = COMING_SOON_PASTEL

type AvailFilter = 'all' | 'available' | 'coming_soon'
type SortOption = 'default' | 'az' | 'za'

function ComingSoonCard({ tpl }: { tpl: TemplateItem }) {
  return (
    <div style={{ borderRadius: 18, overflow: 'hidden', background: '#fff', border: '1px solid #ebebeb', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', cursor: 'default' }}>
      <div style={{ height: 240, background: '#f5f5f7', position: 'relative', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/coming-soon.png" alt="Coming Soon" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={{ position: 'absolute', top: 12, right: 12, background: '#111', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100 }}>
          Coming Soon
        </div>
      </div>
      <div style={{ padding: '14px 16px 18px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <CompanyChip name={tpl.nmCompanies[0]} isAllrounder={tpl.isAllrounder} size="xs" />
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 5, lineHeight: 1.3 }}>{tpl.title}</h3>
        {tpl.description && (
          <p style={{ fontSize: 12, color: '#777', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 10 }}>
            {tpl.description}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: '#bbb', filter: 'blur(4px)', userSelect: 'none' }}>domain.de</span>
          <span style={{ fontSize: 11, color: '#bbb', fontWeight: 600 }}>Demnächst</span>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ tpl, idx }: { tpl: TemplateItem; idx: number }) {
  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const cover = images[0] ?? null
  const pastel = PASTEL_COLORS[idx % PASTEL_COLORS.length]

  if (tpl.isComingSoon) return <ComingSoonCard tpl={tpl} />

  return (
    <a
      href={`/vorlagen/${tpl.id}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block', borderRadius: 18, overflow: 'hidden', background: '#fff', border: '1px solid #ebebeb', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', transition: 'box-shadow 0.18s ease, transform 0.18s ease' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
    >
      <div style={{ height: 240, background: pastel, position: 'relative', overflow: 'hidden' }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={tpl.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="21" /></svg>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{tpl.domain}</span>
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px 18px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <CompanyChip name={tpl.nmCompanies[0]} isAllrounder={tpl.isAllrounder} size="xs" />
          <BadgeChip badge={tpl.badge} size="xs" />
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 5, lineHeight: 1.3 }}>{tpl.title}</h3>
        {tpl.description && (
          <p style={{ fontSize: 12, color: '#777', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 10 }}>
            {tpl.description}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: '#bbb' }}>{tpl.domain}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#8060b0' }}>Ansehen →</span>
        </div>
      </div>
    </a>
  )
}

export default function VorlagenGrid({ templates }: { templates: TemplateItem[] }) {
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('Alle')
  const [availFilter, setAvailFilter] = useState<AvailFilter>('all')
  const [sort, setSort] = useState<SortOption>('default')

  // Collect all companies
  const companies = useMemo(() => {
    const set = new Set<string>()
    let hasAllrounder = false
    templates.forEach(t => {
      if (t.isAllrounder) hasAllrounder = true
      else t.nmCompanies.forEach(c => set.add(c))
    })
    const opts: string[] = ['Alle']
    if (hasAllrounder) opts.push('Allgemein')
    opts.push(...Array.from(set).sort())
    return opts
  }, [templates])

  const filtered = useMemo(() => {
    let list = templates

    // Availability
    if (availFilter === 'available') list = list.filter(t => !t.isComingSoon)
    else if (availFilter === 'coming_soon') list = list.filter(t => t.isComingSoon)

    // Company
    if (companyFilter === 'Allgemein') list = list.filter(t => t.isAllrounder)
    else if (companyFilter !== 'Alle') list = list.filter(t => !t.isAllrounder && t.nmCompanies.includes(companyFilter))

    // Search
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q) ||
      t.nmCompanies.some(c => c.toLowerCase().includes(q))
    )

    // Sort
    if (sort === 'az') list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'de'))
    else if (sort === 'za') list = [...list].sort((a, b) => b.title.localeCompare(a.title, 'de'))

    return list
  }, [templates, search, companyFilter, availFilter, sort])

  const chipStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#111' : '#fff',
    color: active ? '#fff' : '#555',
    border: active ? '1.5px solid #111' : '1.5px solid #e0e0e0',
    borderRadius: 100,
    padding: '6px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.12s ease',
    whiteSpace: 'nowrap',
  })

  return (
    <>
      {/* ── Search ── */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <svg style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suche nach Vorlage, Unternehmen…"
          style={{ width: '100%', paddingLeft: 46, paddingRight: search ? 44 : 16, paddingTop: 13, paddingBottom: 13, fontSize: 14, borderRadius: 14, border: '1.5px solid #E5E7EB', outline: 'none', boxSizing: 'border-box', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          onFocus={e => (e.target.style.borderColor = '#111')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* ── Filters row ── */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 32, alignItems: 'flex-start' }}>

        {/* Company */}
        {companies.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Unternehmen</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {companies.map(c => (
                <button key={c} onClick={() => setCompanyFilter(c)} style={chipStyle(companyFilter === c)}>{c}</button>
              ))}
            </div>
          </div>
        )}

        {/* Availability */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Verfügbarkeit</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setAvailFilter('all')} style={chipStyle(availFilter === 'all')}>Alle</button>
            <button onClick={() => setAvailFilter('available')} style={chipStyle(availFilter === 'available')}>Verfügbar</button>
            <button onClick={() => setAvailFilter('coming_soon')} style={chipStyle(availFilter === 'coming_soon')}>Coming Soon</button>
          </div>
        </div>

        {/* Sort — right-aligned */}
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sortierung</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortOption)}
            style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 10, border: '1.5px solid #e0e0e0', background: '#fff', color: '#333', cursor: 'pointer', outline: 'none' }}
          >
            <option value="default">Standard</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
          </select>
        </div>
      </div>

      {/* ── Result count ── */}
      <p style={{ fontSize: 12, color: '#aaa', marginBottom: 24 }}>
        {filtered.length} {filtered.length === 1 ? 'Vorlage' : 'Vorlagen'} gefunden
      </p>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#555', marginBottom: 8 }}>Keine Vorlagen gefunden</p>
          <p style={{ fontSize: 13 }}>Passe deine Filter an oder suche nach einem anderen Begriff.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 24,
        }}>
          {filtered.map((tpl, i) => (
            <TemplateCard key={tpl.id} tpl={tpl} idx={i} />
          ))}
        </div>
      )}
    </>
  )
}
