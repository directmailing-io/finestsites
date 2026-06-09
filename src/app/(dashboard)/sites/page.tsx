'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ── Types ───────────────────────────────────────────────────────────────────

interface Site {
  id: string
  template_id: string
  status: 'draft' | 'published' | 'deleted'
  created_at: string
  username: string | null
  custom_domain: string | null
  custom_domain_status: string | null
  unread_submissions?: number
  templates: {
    title: string
    domain: string
    preview_images?: string[] | null
  } | null
}

interface Template {
  id: string
  title: string
  description: string | null
  domain: string
  preview_images: string[] | null
  tags: string[] | null
  is_free?: boolean
}

interface EnrichedTemplate extends Template {
  activated: boolean
  activatedSiteId?: string
}

const TAG_LABEL: Record<string, string> = {
  fitline: 'FitLine',
  pminternational: 'PM International',
  sonstiges: 'Sonstiges',
  demo: 'Demo',
}

const ALL_TAG = '__all__'

// ── SiteCard (user's own published sites) ───────────────────────────────────

function SiteCard({ site }: { site: Site }) {
  const isPublished = site.status === 'published'
  const domain = site.templates?.domain
  const username = site.username
  const hasCustomDomain = site.custom_domain_status === 'active' && !!site.custom_domain
  const displayUrl = hasCustomDomain
    ? site.custom_domain!
    : (domain && username ? `${username}.${domain}` : null)
  const siteUrl = isPublished && displayUrl ? `https://${displayUrl}` : null
  const preview = site.templates?.preview_images?.[0]
    ?? (siteUrl ? `https://image.thum.io/get/width/800/crop/500/${siteUrl}` : null)

  return (
    <Link href={`/sites/${site.id}/edit`} className="group block">
      {/* Photo */}
      <div className="relative overflow-hidden rounded-2xl bg-gray-100"
        style={{ aspectRatio: '4/3' }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={site.templates?.title ?? ''}
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: 'linear-gradient(160deg, #FAFAFA 0%, #F1F5F9 100%)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
            {!isPublished && (
              <span className="text-[11px] font-medium" style={{ color: '#CBD5E1' }}>
                Vorschau nach Veröffentlichung
              </span>
            )}
          </div>
        )}

        {/* Status badge — top-left, AirBnB style */}
        <div className="absolute top-3 left-3">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
            style={{
              background: 'rgba(255,255,255,0.96)',
              color: isPublished ? '#15803D' : '#475569',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: isPublished ? '#16A34A' : '#94A3B8' }} />
            {isPublished ? 'Live' : 'Entwurf'}
          </span>
        </div>

        {/* Unread badge */}
        {(site.unread_submissions ?? 0) > 0 && (
          <div className="absolute top-3 right-3">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
              style={{ background: '#EF4444', boxShadow: '0 2px 8px rgba(239,68,68,0.4)' }}>
              {site.unread_submissions} neue Anfrage{site.unread_submissions === 1 ? '' : 'n'}
            </span>
          </div>
        )}
      </div>

      {/* Title + URL */}
      <div className="pt-3 px-1">
        <p className="font-semibold text-gray-900 text-[15px] leading-tight truncate">
          {site.templates?.title ?? 'Meine Webseite'}
        </p>
        {displayUrl && (
          <p className="text-sm mt-1 truncate flex items-center gap-1"
            style={{ color: hasCustomDomain ? '#16A34A' : '#94A3B8' }}>
            {hasCustomDomain && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
              </svg>
            )}
            <span className="font-mono text-[12.5px]">{displayUrl}</span>
          </p>
        )}
      </div>
    </Link>
  )
}

// ── TemplateCard (library) ──────────────────────────────────────────────────

function TemplateCard({ tpl }: { tpl: EnrichedTemplate }) {
  const router = useRouter()
  const preview = tpl.preview_images?.[0] ?? null
  const visibleTags = (tpl.tags ?? []).filter(t => t !== 'demo').slice(0, 2)
  const [busy, setBusy] = useState(false)

  // Activated → straight to editor. Not activated → create draft + open editor.
  async function handleClick(e: React.MouseEvent) {
    if (busy) return
    if (tpl.activated) return // Link handles navigation
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: tpl.id }),
      })
      const data = await res.json()
      if (res.ok && data.id) {
        router.push(`/sites/${data.id}/edit`)
      } else {
        setBusy(false)
        alert(data.error ?? 'Konnte Vorlage nicht öffnen.')
      }
    } catch {
      setBusy(false)
      alert('Netzwerkfehler. Bitte erneut versuchen.')
    }
  }

  const href = tpl.activated ? `/sites/${tpl.activatedSiteId}/edit` : '#'

  return (
    <Link href={href} className="group block" onClick={handleClick}>
      {/* Photo */}
      <div className="relative overflow-hidden rounded-2xl bg-gray-100"
        style={{ aspectRatio: '4/3' }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={tpl.title}
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
          </div>
        )}

        {/* Loading overlay while creating draft */}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white shadow-lg">
              <span className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
              <span className="text-xs font-semibold text-gray-900">Editor öffnet…</span>
            </div>
          </div>
        )}

        {/* Activated badge — top-left */}
        {tpl.activated && (
          <div className="absolute top-3 left-3">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
              style={{
                background: 'rgba(255,255,255,0.96)',
                color: '#15803D',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block bg-green-500" />
              Aktiv
            </span>
          </div>
        )}

        {/* Free badge */}
        {tpl.is_free && !tpl.activated && (
          <div className="absolute top-3 right-3">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.96)',
                color: '#1D4ED8',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}>
              Gratis
            </span>
          </div>
        )}
      </div>

      {/* Title + tags */}
      <div className="pt-3 px-1">
        <p className="font-semibold text-gray-900 text-[15px] leading-tight truncate">
          {tpl.title}
        </p>
        {visibleTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {visibleTags.map(tag => (
              <span key={tag} className="text-[11px] font-medium text-gray-500">
                {TAG_LABEL[tag] ?? tag}
              </span>
            ))}
          </div>
        ) : tpl.description ? (
          <p className="text-sm mt-1 line-clamp-1 text-gray-500">{tpl.description}</p>
        ) : null}
      </div>
    </Link>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [username, setUsername] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState(ALL_TAG)

  useEffect(() => {
    Promise.all([
      fetch('/api/sites').then(r => r.json()),
      fetch('/api/templates').then(r => r.json()),
      fetch('/api/user/profile').then(r => r.json()),
    ]).then(([sitesData, templatesData, profile]) => {
      setSites(Array.isArray(sitesData) ? sitesData : [])
      setTemplates(Array.isArray(templatesData) ? templatesData : [])
      setUsername(profile?.username ?? '')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const enrichedTemplates = useMemo<EnrichedTemplate[]>(() => {
    const activatedIds = new Set(sites.map(s => s.template_id))
    return templates
      .filter(t => !activatedIds.has(t.id))
      .map(t => ({ ...t, activated: false }))
  }, [templates, sites])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    enrichedTemplates.forEach(t => t.tags?.filter(tag => tag !== 'demo').forEach(tag => tagSet.add(tag)))
    return Array.from(tagSet)
  }, [enrichedTemplates])

  const filteredTemplates = useMemo(() => {
    let list = enrichedTemplates
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
  }, [enrichedTemplates, search, activeTag])

  const hasSites = sites.length > 0
  const greeting = username ? `Hallo, ${username}` : 'Willkommen'

  return (
    <div className="max-w-7xl mx-auto">

      {/* ── Hero / Greeting ──────────────────────────────────────────── */}
      <div className="mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          {greeting}
        </h1>
        <p className="text-base mt-1.5" style={{ color: '#94A3B8' }}>
          {hasSites
            ? 'Verwalte deine Webseite oder entdecke neue Vorlagen.'
            : 'Wähle eine Vorlage und starte mit deiner Webseite.'}
        </p>
      </div>

      {/* ── Section 1: Meine Webseite ────────────────────────────────── */}
      {(loading || hasSites) && (
        <section className="mb-12 sm:mb-16">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              Meine Webseite{sites.length > 1 ? 'n' : ''}
            </h2>
            {hasSites && (
              <span className="text-sm" style={{ color: '#94A3B8' }}>
                {sites.length} {sites.length === 1 ? 'Webseite' : 'Webseiten'}
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
              {[1, 2].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="rounded-2xl bg-gray-100" style={{ aspectRatio: '4/3' }} />
                  <div className="pt-3 px-1 flex flex-col gap-2">
                    <div className="h-3.5 rounded-full bg-gray-100 w-2/3" />
                    <div className="h-3 rounded-full bg-gray-100 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
              {sites.map(site => <SiteCard key={site.id} site={site} />)}
            </div>
          )}
        </section>
      )}

      {/* ── Empty state — no sites yet ──────────────────────────────── */}
      {!loading && !hasSites && (
        <section className="mb-12 sm:mb-16">
          <div className="rounded-3xl overflow-hidden p-10 sm:p-14 text-center"
            style={{ background: 'linear-gradient(160deg, #FAFAFA 0%, #FFF8F3 100%)' }}>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ background: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C07050" strokeWidth="1.75">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              Deine Webseite wartet auf dich
            </h3>
            <p className="text-base text-gray-500 leading-relaxed max-w-md mx-auto">
              Wähle unten eine Vorlage, trage deine Daten ein und veröffentliche sie in Minuten.
            </p>
          </div>
        </section>
      )}

      {/* ── Section 2: Vorlagen ──────────────────────────────────────── */}
      <section className="pb-8">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            Vorlagen entdecken
          </h2>
          {!loading && (
            <span className="text-sm" style={{ color: '#94A3B8' }}>
              {filteredTemplates.length} {filteredTemplates.length === 1 ? 'Vorlage' : 'Vorlagen'}
            </span>
          )}
        </div>

        {/* Search */}
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
            className="w-full pl-11 pr-10 py-3.5 text-[15px] rounded-2xl outline-none transition-all bg-white"
            style={{ border: '1.5px solid #E5E7EB' }}
            onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
              style={{ color: '#9CA3AF' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTag(ALL_TAG)}
              className="text-sm font-medium px-4 py-2 rounded-full transition-colors flex-shrink-0"
              style={{
                background: activeTag === ALL_TAG ? '#1a1a1a' : '#F3F4F6',
                color: activeTag === ALL_TAG ? '#fff' : '#6B7280',
              }}>
              Alle
            </button>
            {allTags.map(tag => (
              <button key={tag}
                onClick={() => setActiveTag(tag === activeTag ? ALL_TAG : tag)}
                className="text-sm font-medium px-4 py-2 rounded-full transition-colors flex-shrink-0"
                style={{
                  background: activeTag === tag ? '#1a1a1a' : '#F3F4F6',
                  color: activeTag === tag ? '#fff' : '#6B7280',
                }}>
                {TAG_LABEL[tag] ?? tag}
              </button>
            ))}
          </div>
        )}

        {/* Template grid */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="animate-pulse">
                <div className="rounded-2xl bg-gray-100" style={{ aspectRatio: '4/3' }} />
                <div className="pt-3 px-1 flex flex-col gap-2">
                  <div className="h-3.5 rounded-full bg-gray-100 w-2/3" />
                  <div className="h-3 rounded-full bg-gray-100 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl"
            style={{ background: '#FAFAFA', border: '1px solid #E5E7EB' }}>
            <p className="font-semibold text-gray-700 mb-1">Keine Vorlagen gefunden</p>
            <p className="text-sm text-gray-400 mb-4">Versuche einen anderen Suchbegriff.</p>
            <button onClick={() => { setSearch(''); setActiveTag(ALL_TAG) }}
              className="text-sm font-medium px-5 py-2.5 rounded-xl transition-colors hover:bg-gray-200"
              style={{ background: '#F3F4F6', color: '#374151' }}>
              Suche zurücksetzen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            {filteredTemplates.map(tpl => (
              <TemplateCard key={tpl.id} tpl={tpl} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
