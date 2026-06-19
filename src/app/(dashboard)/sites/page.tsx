'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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

        {/* Status badge */}
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

// ── Page ────────────────────────────────────────────────────────────────────

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [username, setUsername] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/sites').then(r => r.json()),
      fetch('/api/user/profile').then(r => r.json()),
    ]).then(([sitesData, profile]) => {
      setSites(Array.isArray(sitesData) ? sitesData : [])
      setUsername(profile?.username ?? '')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const hasSites = sites.length > 0
  const greeting = username ? `Hallo, ${username}` : 'Willkommen'

  return (
    <div className="max-w-7xl mx-auto">

      {/* ── Hero / Greeting ── */}
      <div className="mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          {greeting}
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

      {/* ── Neue Webseite erstellen CTA ── */}
      {!loading && (
        <div className={hasSites ? 'mt-2' : ''}>
          <Link
            href="/sites/new"
            className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-semibold text-[15px] transition-all active:scale-[0.98]"
            style={{
              background: hasSites ? '#F8FAFC' : '#1a1a1a',
              color: hasSites ? '#374151' : '#fff',
              border: hasSites ? '1.5px dashed #E2E8F0' : 'none',
              boxShadow: hasSites ? 'none' : '0 4px 20px rgba(0,0,0,0.15)',
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
  )
}
