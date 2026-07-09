'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CompanyChip, BadgeChip, PriceChip } from '@/components/TemplateChips'
import { FakeWebsitePreview } from '@/components/FakeWebsitePreview'

interface Template {
  id: string
  title: string
  description: string | null
  domain: string
  preview_images: string[] | null
  tags: string[] | null
  badge: string | null
  is_free?: boolean
  nm_companies: string[]
  is_allrounder: boolean
  is_coming_soon?: boolean
}

interface Site {
  template_id: string
  id: string
  status: string
}

type PriceFilter = 'all' | 'free' | 'premium'

// ── Filter chip ───────────────────────────────────────────────────────────────

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 transition-all"
      style={{
        background: active ? '#111827' : '#F1F5F9',
        color: active ? '#fff' : '#4B5563',
        border: 'none',
        borderRadius: 100,
        padding: '7px 16px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyState({ hasPrefs, search, priceFilter }: { hasPrefs: boolean; search: string; priceFilter: PriceFilter }) {
  if (search) {
    return (
      <div className="py-16 text-center rounded-3xl" style={{ background: '#FAFAFA', border: '1px solid #E5E7EB' }}>
        <div className="text-3xl mb-3">🔍</div>
        <p className="font-semibold text-gray-700 mb-1">Keine Vorlagen gefunden</p>
        <p className="text-sm" style={{ color: '#9CA3AF' }}>Versuche einen anderen Suchbegriff.</p>
      </div>
    )
  }
  if (priceFilter === 'free') {
    return (
      <div className="py-16 text-center rounded-3xl" style={{ background: '#FAFAFA', border: '1px solid #E5E7EB' }}>
        <div className="text-3xl mb-3">✨</div>
        <p className="font-semibold text-gray-700 mb-1">Keine kostenlosen Vorlagen verfügbar</p>
        <p className="text-sm" style={{ color: '#9CA3AF' }}>Wechsle den Filter, um alle Vorlagen zu sehen.</p>
      </div>
    )
  }
  if (priceFilter === 'premium') {
    return (
      <div className="py-16 text-center rounded-3xl" style={{ background: '#FAFAFA', border: '1px solid #E5E7EB' }}>
        <div className="text-3xl mb-3">⭐</div>
        <p className="font-semibold text-gray-700 mb-1">Keine Premium-Vorlagen verfügbar</p>
        <p className="text-sm" style={{ color: '#9CA3AF' }}>Wechsle den Filter, um alle Vorlagen zu sehen.</p>
      </div>
    )
  }
  if (hasPrefs) {
    return (
      <div className="py-14 text-center rounded-3xl px-8" style={{ background: '#F5F0FB', border: '1px solid #E0D0F0' }}>
        <div className="text-3xl mb-3">🏗️</div>
        <p className="font-semibold text-gray-900 mb-2">Noch keine Vorlagen für dein Unternehmen</p>
        <p className="text-sm mb-5" style={{ color: '#6B7280' }}>
          Wir arbeiten bereits an passenden Templates. In den Einstellungen kannst du ein anderes Unternehmen auswählen.
        </p>
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white"
          style={{ background: '#111827' }}
        >
          Einstellungen öffnen
        </Link>
      </div>
    )
  }
  return (
    <div className="py-16 text-center rounded-3xl" style={{ background: '#FAFAFA', border: '1px solid #E5E7EB' }}>
      <p className="font-semibold text-gray-700 mb-1">Keine Vorlagen verfügbar</p>
      <p className="text-sm" style={{ color: '#9CA3AF' }}>Bitte versuche es später erneut.</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewSitePage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  // siteMap: template_id → { id, status }
  const [siteMap, setSiteMap] = useState<Record<string, { id: string; status: string }>>({})
  const [userCompanies, setUserCompanies] = useState<string[]>([])
  const [activeCompany, setActiveCompany] = useState<string>('Alle')
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/templates').then(r => r.json()),
      fetch('/api/sites').then(r => r.json()),
      fetch('/api/user/profile').then(r => r.json()),
    ]).then(([templatesData, sitesData, profileData]) => {
      setTemplates(Array.isArray(templatesData) ? templatesData : [])
      const map: Record<string, { id: string; status: string }> = {}
      if (Array.isArray(sitesData)) {
        for (const s of sitesData as Site[]) map[s.template_id] = { id: s.id, status: s.status }
      }
      setSiteMap(map)
      const companies = Array.isArray(profileData?.nm_companies) ? profileData.nm_companies : []
      setUserCompanies(companies)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const hasPrefs = userCompanies.length > 0
  // Show company sub-filter only when user has 2+ companies
  const showCompanyFilter = userCompanies.length > 1

  // Step 1: filter by user's companies + exclude published/active sites + exclude coming soon
  const companyMatched = useMemo(() => {
    // Exclude coming soon and templates where the user already has a live (non-draft) site
    const base = templates.filter(t => {
      if (t.is_coming_soon) return false  // never show coming soon
      const site = siteMap[t.id]
      if (!site) return true          // no site → always show
      return site.status === 'draft'  // draft → show; published/active → hide
    })
    if (!hasPrefs) return base
    return base.filter(t => t.is_allrounder || t.nm_companies.some(c => userCompanies.includes(c)))
  }, [templates, siteMap, userCompanies, hasPrefs])

  // Step 2: sub-filter by specific company or "Allgemein"
  const companyFiltered = useMemo(() => {
    if (activeCompany === 'Alle') return companyMatched
    if (activeCompany === 'Allgemein') return companyMatched.filter(t => t.is_allrounder)
    return companyMatched.filter(t => !t.is_allrounder && t.nm_companies.includes(activeCompany))
  }, [companyMatched, activeCompany])

  // Step 3: price filter
  const priceFiltered = useMemo(() => {
    if (priceFilter === 'free') return companyFiltered.filter(t => t.is_free)
    if (priceFilter === 'premium') return companyFiltered.filter(t => !t.is_free)
    return companyFiltered
  }, [companyFiltered, priceFilter])

  // Step 4: search
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return priceFiltered
    return priceFiltered.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q)
    )
  }, [priceFiltered, search])

  // Step 5: sort — drafts first, then rest
  const visible = useMemo(() => {
    return [...searched].sort((a, b) => {
      const pa = siteMap[a.id]?.status === 'draft' ? 0 : 1
      const pb = siteMap[b.id]?.status === 'draft' ? 0 : 1
      return pa - pb
    })
  }, [searched, siteMap])

  async function handleSelect(templateId: string) {
    if (busy) return
    if (siteMap[templateId]) {
      router.push(`/sites/${siteMap[templateId].id}/edit`)
      return
    }
    setBusy(templateId)
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId }),
      })
      const data = await res.json()
      if (res.ok && data.id) {
        router.push(`/sites/${data.id}/edit`)
      } else {
        setBusy(null)
        alert(data.error ?? 'Konnte Vorlage nicht öffnen.')
      }
    } catch {
      setBusy(null)
      alert('Netzwerkfehler. Bitte erneut versuchen.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-28 lg:pb-8">

      {/* ── Back ── */}
      <Link href="/sites"
        className="inline-flex items-center gap-2 text-sm font-medium mb-8 transition-colors"
        style={{ color: '#94A3B8' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Zurück
      </Link>

      {/* ── Header ── */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Welche Vorlage passt zu dir?
        </h1>
        <p className="text-base mt-1.5" style={{ color: '#94A3B8' }}>
          {hasPrefs
            ? `Templates für: ${userCompanies.join(', ')}`
            : 'Wähle eine Vorlage und starte sofort.'}
        </p>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-4">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Vorlage suchen…"
          className="w-full pl-10 pr-10 py-3 text-sm rounded-2xl outline-none transition-all"
          style={{ background: '#fff', border: '1.5px solid #E5E7EB', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          onFocus={e => (e.target.style.borderColor = '#111827')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2"
            style={{ color: '#9CA3AF' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Filter chips ── */}
      {!loading && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>

          {/* Company sub-filter (only when user has 2+ companies) */}
          {showCompanyFilter && (
            <>
              <FilterChip label="Alle" active={activeCompany === 'Alle'} onClick={() => setActiveCompany('Alle')} />
              <FilterChip label="Allgemein" active={activeCompany === 'Allgemein'} onClick={() => setActiveCompany('Allgemein')} />
              {userCompanies.map(c => (
                <FilterChip key={c} label={c} active={activeCompany === c} onClick={() => setActiveCompany(c)} />
              ))}
              {/* Divider */}
              <div style={{ width: 1, alignSelf: 'stretch', background: '#E5E7EB', flexShrink: 0, margin: '4px 0' }} />
            </>
          )}

          {/* Price filter — order: Alle → ★ Premium → Gratis */}
          <FilterChip
            label="Alle"
            active={priceFilter === 'all'}
            onClick={() => setPriceFilter('all')}
          />
          <FilterChip
            label="Premium"
            active={priceFilter === 'premium'}
            onClick={() => setPriceFilter(priceFilter === 'premium' ? 'all' : 'premium')}
          />
          <FilterChip
            label="Gratis"
            active={priceFilter === 'free'}
            onClick={() => setPriceFilter(priceFilter === 'free' ? 'all' : 'free')}
          />
        </div>
      )}

      {/* ── Result count ── */}
      {!loading && (visible.length > 0 || search || priceFilter !== 'all') && (
        <p className="text-xs mb-4 px-0.5" style={{ color: '#9CA3AF' }}>
          {visible.length} {visible.length === 1 ? 'Vorlage' : 'Vorlagen'} gefunden
        </p>
      )}

      {/* ── Template list ── */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex gap-4 p-4 rounded-2xl bg-white"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
              <div className="flex-shrink-0 rounded-xl bg-gray-100" style={{ width: 140, aspectRatio: '4/3' }} />
              <div className="flex-1 flex flex-col gap-3 py-1">
                <div className="flex gap-1.5"><div className="h-5 rounded-full bg-gray-100 w-20" /><div className="h-5 rounded-full bg-gray-100 w-12" /></div>
                <div className="h-4 rounded-full bg-gray-100 w-2/3" />
                <div className="h-3 rounded-full bg-gray-100 w-full" />
                <div className="h-3 rounded-full bg-gray-100 w-3/4" />
                <div className="mt-auto h-9 rounded-xl bg-gray-100 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState hasPrefs={hasPrefs} search={search} priceFilter={priceFilter} />
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map(tpl => {
            const isBusy = busy === tpl.id
            const preview = tpl.preview_images?.[0] ?? null
            const existingSite = siteMap[tpl.id]
            const isDraft = existingSite?.status === 'draft'
            const isPublished = !!existingSite && !isDraft
            const isPremium = !(tpl.is_free ?? false)
            // Show the company the user belongs to; fall back to first listed
            const matchedCompany = tpl.is_allrounder
              ? undefined
              : (tpl.nm_companies.find(c => userCompanies.includes(c)) ?? tpl.nm_companies[0])

            return (
              <div key={tpl.id}
                className="flex rounded-2xl bg-white overflow-hidden"
                style={{
                  boxShadow: isPremium
                    ? '0 1px 4px rgba(124,58,237,0.08), 0 6px 24px rgba(124,58,237,0.10)'
                    : '0 1px 4px rgba(0,0,0,0.06), 0 6px 24px rgba(0,0,0,0.06)',
                  border: isPremium ? '1.5px solid #E8D8FB' : '1px solid #F1F5F9',
                  minHeight: 190,
                }}>

                {/* Image — left */}
                <div className="flex-shrink-0 relative overflow-hidden" style={{ width: '40%', background: '#f5f5f7' }}>
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt={tpl.title}
                      className="absolute inset-0 w-full h-full object-cover object-top" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'linear-gradient(160deg, #F8FAFC 0%, #F1F5F9 100%)' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <line x1="3" y1="9" x2="21" y2="9"/>
                        <line x1="9" y1="9" x2="9" y2="21"/>
                      </svg>
                    </div>
                  )}
                  {/* Premium label on preview image */}
                  {isPremium && (
                    <div className="absolute top-2.5 left-2.5"
                      style={{
                        background: 'rgba(255,255,255,0.96)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        borderRadius: 5, padding: '3px 8px',
                        fontSize: 9, fontWeight: 800, color: '#5B21B6',
                        boxShadow: '0 1px 6px rgba(0,0,0,0.14)',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        border: '1px solid rgba(200,180,240,0.5)',
                      }}>
                      PREMIUM
                    </div>
                  )}
                </div>

                {/* Content — right */}
                <div className="flex-1 flex flex-col gap-2.5 p-4 sm:p-5 min-w-0">

                  {/* Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    <CompanyChip name={matchedCompany} isAllrounder={tpl.is_allrounder} size="xs" />
                    <BadgeChip badge={tpl.badge} size="xs" />
                    {tpl.is_free && <PriceChip isFree={true} size="xs" />}
                    {isDraft && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
                        Entwurf
                      </span>
                    )}
                    {isPublished && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
                        Aktiv
                      </span>
                    )}
                  </div>

                  {/* Title + description */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-[15px] sm:text-[16px] leading-snug mb-1.5">
                      {tpl.title}
                    </h3>
                    {tpl.description && (
                      <p className="text-sm leading-relaxed line-clamp-2" style={{ color: '#64748B' }}>
                        {tpl.description}
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleSelect(tpl.id)}
                    disabled={!!busy}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                    style={{
                      background: isBusy ? '#E5E7EB' : isPremium ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : '#1a1a1a',
                      color: isBusy ? '#9CA3AF' : '#fff',
                      boxShadow: (!isBusy && isPremium) ? '0 4px 12px rgba(124,58,237,0.25)' : undefined,
                    }}
                  >
                    {isBusy ? (
                      <>
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
                        Wird geöffnet…
                      </>
                    ) : isDraft ? 'Weiter bearbeiten →' : isPublished ? 'Website öffnen →' : 'Vorlage verwenden →'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Settings hint ── */}
      {!loading && hasPrefs && visible.length > 0 && (
        <p className="text-xs text-center mt-8" style={{ color: '#C4B5C8' }}>
          Anderes Unternehmen?{' '}
          <Link href="/settings" style={{ color: '#8060b0', textDecoration: 'underline' }}>
            Einstellungen ändern
          </Link>
        </p>
      )}
    </div>
  )
}
