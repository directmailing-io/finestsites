'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getTemplateIntentCookie, clearTemplateIntentCookie, isValidTemplateId } from '@/lib/cookies/template-intent'

// ── Types ────────────────────────────────────────────────────────────────────

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
  domain: string
  preview_images: string[] | null
  badge: string | null
  is_free?: boolean
  nm_companies: string[]
  is_allrounder: boolean
  is_coming_soon?: boolean
}

// ── SiteCard ─────────────────────────────────────────────────────────────────

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
    <div className="group">
      <Link
        href={`/sites/${site.id}/edit`}
        className="block relative overflow-hidden rounded-2xl bg-gray-100"
        style={{ aspectRatio: '4/3' }}
      >
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

        {(site.unread_submissions ?? 0) > 0 && (
          <div className="absolute top-3 left-3">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
              style={{ background: '#EF4444', boxShadow: '0 2px 8px rgba(239,68,68,0.4)' }}>
              {site.unread_submissions} neue Anfrage{site.unread_submissions === 1 ? '' : 'n'}
            </span>
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center
          bg-black/0 group-hover:bg-black/15 transition-colors duration-300 pointer-events-none">
          <span className="text-[12px] font-semibold text-white bg-black/55 backdrop-blur-sm
            px-3.5 py-1.5 rounded-full opacity-0 group-hover:opacity-100
            transition-all duration-200 translate-y-1 group-hover:translate-y-0">
            ✏️ Bearbeiten
          </span>
        </div>
      </Link>

      <div className="pt-3 px-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 text-[15px] leading-tight truncate">
            {site.templates?.title ?? 'Meine Webseite'}
          </p>
          <span
            className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
            style={isPublished
              ? { background: '#DCFCE7', color: '#15803D' }
              : { background: '#F1F5F9', color: '#64748B' }
            }
          >
            <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
              style={{ background: isPublished ? '#16A34A' : '#94A3B8' }} />
            {isPublished ? 'Live' : 'Entwurf'}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          {displayUrl && (
            <p className="text-sm truncate flex-1 flex items-center gap-1 min-w-0"
              style={{ color: hasCustomDomain ? '#16A34A' : '#94A3B8' }}>
              {hasCustomDomain && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                </svg>
              )}
              <span className="font-mono text-[12.5px] truncate">{displayUrl}</span>
            </p>
          )}

          {siteUrl ? (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors"
              style={{ color: '#6B7280', background: '#F3F4F6', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#E5E7EB'; e.currentTarget.style.color = '#111' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#6B7280' }}
            >
              Öffnen
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15,3 21,3 21,9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          ) : !displayUrl ? (
            <Link
              href={`/sites/${site.id}/edit`}
              className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors"
              style={{ color: '#6B7280', background: '#F3F4F6', whiteSpace: 'nowrap' }}
            >
              Bearbeiten
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── TemplateCard ──────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  existingSiteId,
  busy,
  onEdit,
  onPreview,
}: {
  template: Template
  existingSiteId: string | null
  busy: boolean
  onEdit: () => void
  onPreview: () => void
}) {
  const preview = template.preview_images?.[0] ?? null

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden bg-white"
      style={{ border: '1.5px solid #E5E7EB', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>

      {/* Image */}
      <div className="relative overflow-hidden flex-shrink-0" style={{ height: 170, background: '#F5F5F7' }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={template.title}
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
        {template.badge === 'brandneu' && (
          <div className="absolute top-2 left-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(245,243,255,0.95)', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
              Neu
            </span>
          </div>
        )}
        {existingSiteId && (
          <div className="absolute top-2 right-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(240,253,244,0.95)', color: '#15803D', border: '1px solid #BBF7D0' }}>
              Aktiviert
            </span>
          </div>
        )}
        {template.is_free && (
          <div className="absolute bottom-2 left-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(236,253,245,0.95)', color: '#065F46', border: '1px solid #A7F3D0' }}>
              Kostenlos
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <div className="px-4 py-3 flex-1">
        <p className="font-semibold text-gray-900 text-[14px] leading-snug">{template.title}</p>
        <p className="text-[12px] mt-0.5 font-mono" style={{ color: '#94A3B8' }}>{template.domain}</p>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={onEdit}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: '#111827' }}
        >
          {busy ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          )}
          {busy ? 'Öffnet…' : 'Jetzt bearbeiten'}
        </button>
        <button
          onClick={onPreview}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
          style={{ background: '#F3F4F6', color: '#374151' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#E5E7EB' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#F3F4F6' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          Vorschau
        </button>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SitesPage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [userCompanies, setUserCompanies] = useState<string[]>([])
  const [siteMap, setSiteMap] = useState<Record<string, string>>({}) // template_id → site_id
  const [username, setUsername] = useState<string>('')
  const [firstName, setFirstName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [autoCreating, setAutoCreating] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)

    Promise.all([
      fetch('/api/sites', { signal: controller.signal }).then(r => r.json()),
      fetch('/api/user/profile', { signal: controller.signal }).then(r => r.json()),
      fetch('/api/templates', { signal: controller.signal }).then(r => r.json()),
    ]).then(([sitesData, profile, templatesData]) => {
      clearTimeout(timer)
      const loadedSites = Array.isArray(sitesData) ? sitesData : []
      setSites(loadedSites)
      setUsername(profile?.username ?? '')
      setFirstName(profile?.first_name ?? '')
      setUserCompanies(Array.isArray(profile?.nm_companies) ? profile.nm_companies : [])

      // Build siteMap: template_id → site_id
      const map: Record<string, string> = {}
      for (const s of loadedSites) map[s.template_id] = s.id
      setSiteMap(map)

      setTemplates(Array.isArray(templatesData) ? templatesData : [])
      setLoading(false)

      // Check for template intent cookie
      const intentId = getTemplateIntentCookie()
      if (intentId && isValidTemplateId(intentId)) {
        clearTemplateIntentCookie()
        setAutoCreating(true)
        fetch('/api/sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template_id: intentId }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.id) router.push(`/sites/${data.id}/edit`)
            else setAutoCreating(false)
          })
          .catch(() => setAutoCreating(false))
      }
    }).catch(() => { clearTimeout(timer); setLoading(false) })

    return () => { controller.abort(); clearTimeout(timer) }
  }, [router])

  async function handleEdit(templateId: string) {
    if (busy) return
    const existingId = siteMap[templateId]
    if (existingId) {
      router.push(`/sites/${existingId}/edit`)
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

  const hasSites = sites.length > 0

  function getGreeting() {
    const hour = new Date().getHours()
    const time = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'
    const name = firstName || username
    return name ? `${time}, ${name}` : time
  }

  const visibleTemplates = templates.filter(t =>
    !t.is_coming_soon &&
    (userCompanies.length === 0 || t.is_allrounder || t.nm_companies.some(c => userCompanies.includes(c)))
  )

  const previewTemplate = previewTemplateId ? templates.find(t => t.id === previewTemplateId) : null

  return (
    <>
    {autoCreating && (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
          style={{ background: '#F5F0FB' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="9" x2="9" y2="21"/>
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Dein Template wird eingerichtet…</h2>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>Gleich geht es los!</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: '#7C3AED', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    )}

    <div className="max-w-7xl mx-auto">

      {/* ── Greeting ── */}
      <div className="mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          {loading ? '\u00A0' : getGreeting()}
        </h1>
        <p className="text-base mt-1.5" style={{ color: '#94A3B8' }}>
          {hasSites
            ? 'Verwalte deine Webseite oder starte ein neues Template.'
            : 'Wähle ein Template und starte deine erste Webseite.'}
        </p>
      </div>

      {/* ── Meine Webseiten ── */}
      {(loading || hasSites) && (
        <section className="mb-10">
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

      {/* ── Templates ── */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            Diese Templates stehen dir zur Verfügung.
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse rounded-2xl overflow-hidden bg-white"
                style={{ border: '1.5px solid #E5E7EB' }}>
                <div className="bg-gray-100" style={{ height: 170 }} />
                <div className="p-4 flex flex-col gap-2">
                  <div className="h-4 rounded-full bg-gray-100 w-3/4" />
                  <div className="h-3 rounded-full bg-gray-100 w-1/2" />
                </div>
                <div className="px-4 pb-4">
                  <div className="h-10 rounded-xl bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleTemplates.length === 0 ? (
          <div className="py-14 text-center rounded-3xl" style={{ background: '#FAFAFA', border: '1px solid #E5E7EB' }}>
            <p className="font-semibold text-gray-700 mb-1">Keine Vorlagen verfügbar</p>
            <p className="text-sm" style={{ color: '#9CA3AF' }}>Bitte versuche es später erneut.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleTemplates.map(tpl => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                existingSiteId={siteMap[tpl.id] ?? null}
                busy={busy === tpl.id}
                onEdit={() => handleEdit(tpl.id)}
                onPreview={() => setPreviewTemplateId(tpl.id)}
              />
            ))}
          </div>
        )}
      </section>

    </div>

    {/* ── Preview modal ── */}
    {previewTemplateId && (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.85)' }}>
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 flex-shrink-0"
          style={{ background: '#111', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-sm font-semibold text-white truncate">
              {previewTemplate?.title ?? 'Vorschau'}
            </span>
            {previewTemplate && (
              <span className="text-xs px-2 py-0.5 rounded-full font-mono hidden sm:block"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#9CA3AF' }}>
                {previewTemplate.domain}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <button
              onClick={() => { setPreviewTemplateId(null); handleEdit(previewTemplateId) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
              style={{ background: '#7C3AED' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Jetzt bearbeiten
            </button>
            <button onClick={() => setPreviewTemplateId(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.1)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Schließen
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-white">
          <iframe
            src={`/api/templates/${previewTemplateId}/preview`}
            className="w-full h-full border-0 block"
            title="Vorschau"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    )}
    </>
  )
}
