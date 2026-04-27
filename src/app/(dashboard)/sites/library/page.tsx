'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

interface Template {
  id: string
  title: string
  description: string | null
  domain: string
  preview_images: string[] | null
  tags: string[] | null
  is_free?: boolean
  activated?: boolean
  activatedSiteId?: string
}

const TAG_LABEL: Record<string, string> = {
  fitline: 'FitLine',
  pminternational: 'PM International',
  sonstiges: 'Sonstiges',
  demo: 'Demo',
}

const ALL_TAG = '__all__'

// ── Card ─────────────────────────────────────────────────────────────────────

function TemplateCard({ tpl }: { tpl: Template }) {
  const preview = tpl.preview_images?.[0] ?? null
  const visibleTags = (tpl.tags ?? []).filter(t => t !== 'demo').slice(0, 2)

  return (
    <div className="group flex flex-col rounded-2xl bg-white overflow-hidden transition-all duration-200 hover:shadow-md"
      style={{ border: '1px solid #E5E7EB' }}>

      {/* Preview image */}
      <Link href={`/sites/library/${tpl.id}`} className="block relative overflow-hidden bg-gray-50 flex-shrink-0"
        style={{ aspectRatio: '4/3' }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={tpl.title}
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.25">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {tpl.activated && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
              style={{ background: 'rgba(255,255,255,0.92)', color: '#15803D', border: '1px solid rgba(22,163,74,0.25)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Aktiviert
            </span>
          )}
          {tpl.is_free && !tpl.activated && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.92)', color: '#1D4ED8', border: '1px solid rgba(37,99,235,0.2)' }}>
              Kostenlos
            </span>
          )}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-end justify-center pb-4">
          <span className="opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 text-xs font-semibold text-white px-4 py-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
            Vorschau ansehen →
          </span>
        </div>
      </Link>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm leading-snug">{tpl.title}</p>
          {tpl.description && (
            <p className="text-xs mt-1 line-clamp-2 leading-relaxed text-gray-400">
              {tpl.description}
            </p>
          )}
          {visibleTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {visibleTags.map(tag => (
                <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: '#F3F4F6', color: '#6B7280' }}>
                  {TAG_LABEL[tag] ?? tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        {tpl.activated ? (
          <Link href={`/sites/${tpl.activatedSiteId}/edit`}
            className="flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl transition-opacity hover:opacity-80"
            style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #D1FAE5' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Bearbeiten
          </Link>
        ) : (
          <Link href={`/sites/library/${tpl.id}`}
            className="flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl text-white transition-opacity hover:opacity-90"
            style={{ background: '#1a1a1a' }}>
            Vorlage wählen
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [userSites, setUserSites] = useState<Array<{ template_id: string; id: string }>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState(ALL_TAG)

  useEffect(() => {
    Promise.all([
      fetch('/api/templates').then(r => r.json()),
      fetch('/api/sites').then(r => r.json()),
    ]).then(([tpls, sites]) => {
      setTemplates(Array.isArray(tpls) ? tpls : [])
      setUserSites(Array.isArray(sites) ? sites.map((s: { template_id: string; id: string }) => ({ template_id: s.template_id, id: s.id })) : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const enriched = useMemo<Template[]>(() => {
    const siteMap = new Map(userSites.map(s => [s.template_id, s.id]))
    return templates
      .map(t => ({ ...t, activated: siteMap.has(t.id), activatedSiteId: siteMap.get(t.id) }))
      .sort((a, b) => (b.activated ? 1 : 0) - (a.activated ? 1 : 0))
  }, [templates, userSites])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    enriched.forEach(t => t.tags?.filter(tag => tag !== 'demo').forEach(tag => tagSet.add(tag)))
    return Array.from(tagSet)
  }, [enriched])

  const filtered = useMemo(() => {
    let list = enriched
    if (activeTag !== ALL_TAG) list = list.filter(t => t.tags?.includes(activeTag))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some(tag => (TAG_LABEL[tag] ?? tag).toLowerCase().includes(q))
      )
    }
    return list
  }, [enriched, search, activeTag])

  return (
    <div className="max-w-4xl">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Vorlagen</h1>
        <p className="text-gray-400 mt-1">
          Wähle eine fertige Vorlage und richte deine Webseite in Minuten ein.
        </p>
      </div>

      {/* ── Search ──────────────────────────────────────────────── */}
      <div className="relative mb-4">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Vorlage suchen…"
          className="w-full pl-11 pr-10 py-3.5 text-sm rounded-2xl outline-none transition-all bg-white"
          style={{ border: '1.5px solid #E5E7EB' }}
          onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
            style={{ color: '#9CA3AF' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Tag filters ─────────────────────────────────────────── */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <button
            onClick={() => setActiveTag(ALL_TAG)}
            className="text-sm font-medium px-4 py-1.5 rounded-full transition-colors"
            style={{
              background: activeTag === ALL_TAG ? '#1a1a1a' : '#F3F4F6',
              color: activeTag === ALL_TAG ? '#fff' : '#6B7280',
            }}>
            Alle
          </button>
          {allTags.map(tag => (
            <button key={tag}
              onClick={() => setActiveTag(tag === activeTag ? ALL_TAG : tag)}
              className="text-sm font-medium px-4 py-1.5 rounded-full transition-colors"
              style={{
                background: activeTag === tag ? '#1a1a1a' : '#F3F4F6',
                color: activeTag === tag ? '#fff' : '#6B7280',
              }}>
              {TAG_LABEL[tag] ?? tag}
            </button>
          ))}
          {!loading && (
            <span className="text-xs text-gray-400 ml-1">
              {filtered.length} {filtered.length === 1 ? 'Vorlage' : 'Vorlagen'}
            </span>
          )}
        </div>
      )}

      {/* ── Grid ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl overflow-hidden bg-white animate-pulse"
              style={{ border: '1px solid #E5E7EB' }}>
              <div className="bg-gray-100" style={{ aspectRatio: '4/3' }} />
              <div className="p-4 flex flex-col gap-3">
                <div className="h-3.5 rounded-full bg-gray-100 w-3/5" />
                <div className="h-2.5 rounded-full bg-gray-100 w-full" />
                <div className="h-9 rounded-xl bg-gray-100 mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl"
          style={{ background: '#FAFAFA', border: '1px solid #E5E7EB' }}>
          <p className="font-semibold text-gray-700 mb-1">Keine Vorlagen gefunden</p>
          <p className="text-sm text-gray-400 mb-4">Versuche einen anderen Suchbegriff.</p>
          <button onClick={() => { setSearch(''); setActiveTag(ALL_TAG) }}
            className="text-sm font-medium px-4 py-2 rounded-xl transition-colors hover:bg-gray-200"
            style={{ background: '#F3F4F6', color: '#374151' }}>
            Suche zurücksetzen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(tpl => (
            <TemplateCard key={tpl.id} tpl={tpl} />
          ))}
        </div>
      )}

    </div>
  )
}
