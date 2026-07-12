'use client'

import { useState, useMemo } from 'react'
import { CompanyChip, BadgeChip } from '@/components/TemplateChips'

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

type AvailFilter = 'all' | 'available' | 'coming_soon'
type SortOption = 'default' | 'az' | 'za'

function ComingSoonCard({ tpl, idx }: { tpl: TemplateItem; idx: number }) {
  const gradient = GRADIENTS[idx % GRADIENTS.length]
  return (
    <div style={{ borderRadius: 18, overflow: 'hidden', background: '#fff', border: '1px solid #ebebeb', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 240, background: gradient, position: 'relative', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Big blurred title as background texture */}
        <span style={{ fontSize: 56, fontWeight: 900, color: 'rgba(255,255,255,0.18)', textAlign: 'center', padding: '0 20px', lineHeight: 1.1, userSelect: 'none', letterSpacing: '-0.02em' }}>
          {tpl.title}
        </span>
        {/* Frosted overlay at bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 64, background: 'linear-gradient(to top, rgba(0,0,0,0.22), transparent)' }} />
        <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 100 }}>
          Bald
        </div>
      </div>
      <div style={{ padding: '14px 16px 12px', flex: 1 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <CompanyChip name={tpl.nmCompanies[0]} isAllrounder={tpl.isAllrounder} size="xs" />
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 5, lineHeight: 1.3 }}>{tpl.title}</h3>
        {tpl.description && (
          <p style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {tpl.description}
          </p>
        )}
      </div>
      <div style={{ padding: '10px 16px 14px', background: '#FAFAFA', borderTop: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#C4B5FD', letterSpacing: '0.06em', textTransform: 'uppercase' }}>In Kürze verfügbar</span>
      </div>
    </div>
  )
}

function TemplateCard({ tpl, idx, onPreview }: { tpl: TemplateItem; idx: number; onPreview: (id: string) => void }) {
  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const cover = images[0] ?? null

  if (tpl.isComingSoon) return <ComingSoonCard tpl={tpl} idx={idx} />

  return (
    <div style={{ borderRadius: 18, overflow: 'hidden', background: '#fff', border: '1px solid #e8e3f0', boxShadow: '0 2px 16px rgba(128,96,176,0.08)', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s, transform 0.2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 36px rgba(128,96,176,0.16)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 16px rgba(128,96,176,0.08)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
    >
      <div style={{ height: 240, background: '#F3F4F6', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={tpl.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="21" /></svg>
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px 12px', flex: 1 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <CompanyChip name={tpl.nmCompanies[0]} isAllrounder={tpl.isAllrounder} size="xs" />
          <BadgeChip badge={tpl.badge} size="xs" />
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 5, lineHeight: 1.3 }}>{tpl.title}</h3>
        {tpl.description && (
          <p style={{ fontSize: 12, color: '#777', lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {tpl.description}
          </p>
        )}
      </div>
      {/* Two action buttons */}
      <div style={{ padding: '10px 16px 14px', display: 'flex', gap: 8 }}>
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

export default function VorlagenGrid({ templates }: { templates: TemplateItem[] }) {
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('Alle')
  const [availFilter, setAvailFilter] = useState<AvailFilter>('all')
  const [sort, setSort] = useState<SortOption>('default')
  const [previewId, setPreviewId] = useState<string | null>(null)

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
      {/* Preview modal */}
      {previewId && (
        <div
          onClick={() => setPreviewId(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 1100, height: '85vh', background: '#fff', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Vorschau</span>
              <button onClick={() => setPreviewId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6B7280', padding: '2px 6px', lineHeight: 1 }}>✕</button>
            </div>
            <iframe src={`/api/templates/${previewId}/public-preview`} style={{ flex: 1, border: 'none', display: 'block' }} title="Template-Vorschau" />
          </div>
        </div>
      )}

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
            <TemplateCard key={tpl.id} tpl={tpl} idx={i} onPreview={setPreviewId} />
          ))}
        </div>
      )}
    </>
  )
}
