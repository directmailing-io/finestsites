'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

// ── Template grid ─────────────────────────────────────────────────────────────

function TemplateGrid({
  templates: list,
  isFreeSection,
  siteMap,
  busy,
  userCompanies,
  onSelect,
}: {
  templates: Template[]
  isFreeSection: boolean
  siteMap: Record<string, { id: string; status: string }>
  busy: string | null
  userCompanies: string[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {list.map(tpl => {
        const isBusy = busy === tpl.id
        const preview = tpl.preview_images?.[0] ?? null
        const existingSite = siteMap[tpl.id]
        const isDraft = existingSite?.status === 'draft'
        const isPremium = !(tpl.is_free ?? false)
        const companyLabel = tpl.is_allrounder
          ? null
          : (tpl.nm_companies.find(c => userCompanies.includes(c)) ?? tpl.nm_companies[0] ?? null)

        return (
          <article key={tpl.id}
            className="flex flex-col rounded-3xl overflow-hidden bg-white"
            style={{ border: '1.5px solid #E2E8F0', boxShadow: '0 2px 12px rgba(15,23,42,0.06)' }}>

            {/* Preview — whole picture in its own format (16:10), never cropped */}
            <div className="relative flex-shrink-0 bg-gray-100" style={{ aspectRatio: '16 / 10', borderBottom: '1px solid #E2E8F0' }}>
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="absolute inset-0 w-full h-full"
                  style={{ objectFit: 'cover', objectPosition: 'top center' }} />
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
              {tpl.badge === 'brandneu' && !existingSite && (
                <span className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: '#7C3AED', color: '#fff' }}>
                  Neu
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3 p-4 sm:p-5 flex-1">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {existingSite && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                      style={isDraft ? { background: '#F1F5F9', color: '#475569' } : { background: '#DCFCE7', color: '#15803D' }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: isDraft ? '#94A3B8' : '#16A34A' }} />
                      {isDraft ? 'Entwurf vorhanden' : 'Schon online'}
                    </span>
                  )}
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={isPremium ? { background: '#F5F0FB', color: '#6D28D9' } : { background: '#ECFDF5', color: '#047857' }}>
                    {isPremium ? 'Premium' : 'Kostenlos'}
                  </span>
                  {companyLabel && (
                    <span className="text-xs font-semibold" style={{ color: '#64748B' }}>{companyLabel}</span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-gray-900 leading-snug">{tpl.title}</h3>
                {tpl.description && (
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: '#64748B' }}>{tpl.description}</p>
                )}
              </div>

              {existingSite ? (
                <button type="button" onClick={() => onSelect(tpl.id)} disabled={!!busy}
                  className="flex items-center justify-center gap-2 w-full min-h-12 px-4 rounded-2xl text-[15px] font-bold text-white"
                  style={{ background: '#111827', opacity: busy && !isBusy ? 0.5 : 1 }}>
                  {isBusy ? 'Wird geöffnet…' : isDraft ? 'Weiter bearbeiten' : 'Bearbeiten'}
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <a href={`/api/templates/${tpl.id}/public-preview`} target="_blank" rel="noopener noreferrer"
                    className="flex-[1_1_120px] flex items-center justify-center gap-2 min-h-12 px-3 rounded-2xl text-sm font-semibold whitespace-nowrap"
                    style={{ background: '#F1F5F9', color: '#111827' }}>
                    <svg className="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                    Ansehen
                  </a>
                  <button type="button" onClick={() => onSelect(tpl.id)} disabled={!!busy}
                    className="flex-[2_1_190px] flex items-center justify-center gap-2 min-h-12 px-3 rounded-2xl text-[15px] font-bold text-white whitespace-nowrap"
                    style={{ background: '#7C3AED', opacity: busy && !isBusy ? 0.5 : 1 }}>
                    {isBusy && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />}
                    {isBusy ? 'Wird angelegt…' : 'Diese Vorlage verwenden'}
                  </button>
                </div>
              )}
            </div>
          </article>
        )
      })}
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
    // Every template stays visible. Ones the user already started or published are not
    // hidden (that made them look "gone") — they are listed in their own group below.
    const base = templates.filter(t => !t.is_coming_soon)
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

  // Step 5: new templates (premium, then free) and, separately, the ones already in use
  const premiumTemplates = useMemo(
    () => searched.filter(t => !siteMap[t.id] && !(t.is_free ?? false)),
    [searched, siteMap],
  )
  const freeTemplates = useMemo(
    () => searched.filter(t => !siteMap[t.id] && (t.is_free ?? false)),
    [searched, siteMap],
  )
  const usedTemplates = useMemo(
    () => searched.filter(t => !!siteMap[t.id]),
    [searched, siteMap],
  )

  const visible = useMemo(() => {
    return [...premiumTemplates, ...freeTemplates, ...usedTemplates]
  }, [premiumTemplates, freeTemplates, usedTemplates])

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
        Zurück zu meinen Webseiten
      </Link>

      {/* ── Header ── */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Neue Webseite erstellen
        </h1>
        <p className="text-base mt-1.5" style={{ color: '#64748B' }}>
          Such dir eine Vorlage aus. Mit „Ansehen“ kannst du sie dir vorher in Ruhe anschauen.
        </p>
        {hasPrefs && (
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Vorlagen für: {userCompanies.join(', ')}</p>
        )}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse flex flex-col rounded-2xl bg-white overflow-hidden"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #E5E7EB' }}>
              <div className="bg-gray-100" style={{ height: 180 }} />
              <div className="p-4 flex flex-col gap-3">
                <div className="h-3 rounded-full bg-gray-100 w-1/3" />
                <div className="h-5 rounded-full bg-gray-100 w-3/4" />
              </div>
              <div className="h-11 bg-gray-100 mt-auto" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState hasPrefs={hasPrefs} search={search} priceFilter={priceFilter} />
      ) : (
        <>
          {/* ── New templates: premium first, then free ── */}
          {priceFilter !== 'free' && premiumTemplates.length > 0 && (
            <TemplateGrid templates={premiumTemplates} isFreeSection={false} siteMap={siteMap} busy={busy} userCompanies={userCompanies} onSelect={handleSelect} />
          )}

          {priceFilter !== 'premium' && freeTemplates.length > 0 && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mt-10 mb-1">Kostenlose Vorlagen</h2>
              <p className="text-sm mb-4" style={{ color: '#64748B' }}>Für diese Vorlagen brauchst du keinen Tarif.</p>
              <TemplateGrid templates={freeTemplates} isFreeSection={true} siteMap={siteMap} busy={busy} userCompanies={userCompanies} onSelect={handleSelect} />
            </>
          )}

          {/* ── Templates the user already has — shown, not hidden ── */}
          {usedTemplates.length > 0 && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mt-10 mb-1">Diese Vorlagen nutzt du schon</h2>
              <p className="text-sm mb-4" style={{ color: '#64748B' }}>Du findest sie auch auf deiner Startseite unter „Online“ oder „Entwürfe“.</p>
              <TemplateGrid templates={usedTemplates} isFreeSection={false} siteMap={siteMap} busy={busy} userCompanies={userCompanies} onSelect={handleSelect} />
            </>
          )}
        </>
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
