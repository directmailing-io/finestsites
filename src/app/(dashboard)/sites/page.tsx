'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getTemplateIntentCookie, clearTemplateIntentCookie, isValidTemplateId } from '@/lib/cookies/template-intent'

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

// ── SiteCard ────────────────────────────────────────────────────────────────

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
      {/* Image — clicks to editor */}
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

        {/* Unread badge */}
        {(site.unread_submissions ?? 0) > 0 && (
          <div className="absolute top-3 left-3">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
              style={{ background: '#EF4444', boxShadow: '0 2px 8px rgba(239,68,68,0.4)' }}>
              {site.unread_submissions} neue Anfrage{site.unread_submissions === 1 ? '' : 'n'}
            </span>
          </div>
        )}

        {/* Hover: "Bearbeiten" pill */}
        <div className="absolute inset-0 flex items-center justify-center
          bg-black/0 group-hover:bg-black/15 transition-colors duration-300 pointer-events-none">
          <span className="text-[12px] font-semibold text-white bg-black/55 backdrop-blur-sm
            px-3.5 py-1.5 rounded-full opacity-0 group-hover:opacity-100
            transition-all duration-200 translate-y-1 group-hover:translate-y-0">
            ✏️ Bearbeiten
          </span>
        </div>
      </Link>

      {/* Info row — separate from <Link> so we can nest links freely */}
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

// ── Page ────────────────────────────────────────────────────────────────────

export default function SitesPage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [username, setUsername] = useState<string>('')
  const [firstName, setFirstName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [autoCreating, setAutoCreating] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000) // 10s timeout

    Promise.all([
      fetch('/api/sites', { signal: controller.signal }).then(r => r.json()),
      fetch('/api/user/profile', { signal: controller.signal }).then(r => r.json()),
    ]).then(([sitesData, profile]) => {
      clearTimeout(timer)
      const loadedSites = Array.isArray(sitesData) ? sitesData : []
      setSites(loadedSites)
      setUsername(profile?.username ?? '')
      setFirstName(profile?.first_name ?? '')
      setLoading(false)

      // Check for template intent cookie — auto-create site if present
      const intentId = getTemplateIntentCookie()
      if (intentId && isValidTemplateId(intentId)) {
        clearTemplateIntentCookie() // Clear immediately to prevent double-creation
        setAutoCreating(true)
        fetch('/api/sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template_id: intentId }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.id) {
              router.push(`/sites/${data.id}/edit`)
            } else {
              setAutoCreating(false)
            }
          })
          .catch(() => setAutoCreating(false))
      }
    }).catch(() => { clearTimeout(timer); setLoading(false) })

    return () => { controller.abort(); clearTimeout(timer) }
  }, [router])

  const hasSites = sites.length > 0

  function getGreeting() {
    const hour = new Date().getHours()
    const time = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'
    const name = firstName || username
    return name ? `${time}, ${name}` : time
  }

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

      {/* ── Hero / Greeting ── */}
      <div className="mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          {loading ? '\u00A0' : getGreeting()}
        </h1>
        <p className="text-base mt-1.5" style={{ color: '#94A3B8' }}>
          {hasSites
            ? 'Verwalte deine Webseite oder erstelle eine neue.'
            : 'Erstelle jetzt deine erste Webseite.'}
        </p>
      </div>

      {/* ── Meine Webseiten ── */}
      {(loading || hasSites) && (
        <section className="mb-8">
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

      {/* ── Welcome state for users with no sites ── */}
      {!loading && !hasSites && (
        <div className="text-center py-12 px-6">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
            style={{ background: '#F5F3FF' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="9" x2="9" y2="21"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Deine erste Webseite wartet
          </h2>
          <p className="text-sm mb-6 max-w-xs mx-auto leading-relaxed" style={{ color: '#6B7280' }}>
            Wähle ein Template, fülle deine Daten ein und schalte deine Seite online. Kostenlos ausprobieren, erst zahlen wenn du live gehst.
          </p>
        </div>
      )}

      {/* ── Neue Webseite erstellen CTA ── */}
      {!loading && (
        <div className="mt-4">
          <Link
            href="/sites/new"
            className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-semibold text-[15px] transition-all active:scale-[0.98]"
            style={{
              background: '#1a1a1a',
              color: '#fff',
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Neue Webseite erstellen
          </Link>
        </div>
      )}

      {/* ── Empty state (loading placeholder) ── */}
      {loading && !hasSites && (
        <div className="animate-pulse">
          <div className="h-14 rounded-2xl bg-gray-100 w-full" />
        </div>
      )}

    </div>
    </>
  )
}
