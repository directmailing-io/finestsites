'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Template {
  id: string
  title: string
  description: string | null
  domain: string
  preview_images: string[] | null
  tags: string[] | null
  is_free?: boolean
}

interface UserSite {
  id: string
  template_id: string
  status: string
}

interface UserProfile {
  plan: string
  sites_count: number
  paid_sites_count: number
  username: string | null
}

const PLAN_LIMITS: Record<string, number> = { starter: 1, pro: 3, unlimited: Infinity }

export default function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [template, setTemplate] = useState<Template | null>(null)
  const [userSite, setUserSite] = useState<UserSite | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState('')
  const [activeImage, setActiveImage] = useState(0)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/templates').then(r => r.json()),
      fetch('/api/sites').then(r => r.json()),
      fetch('/api/user/profile').then(r => r.json()),
    ]).then(([tpls, sites, prof]) => {
      const tpl = Array.isArray(tpls) ? tpls.find((t: Template) => t.id === id) : null
      setTemplate(tpl ?? null)
      const site = Array.isArray(sites) ? sites.find((s: UserSite) => s.template_id === id) : null
      setUserSite(site ?? null)
      setProfile(prof)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  async function handleActivate() {
    setActivating(true)
    setActivateError('')
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: id }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/sites/${data.id}/edit`)
      } else {
        setActivateError(data.error ?? 'Aktivierung fehlgeschlagen.')
        setActivating(false)
      }
    } catch {
      setActivateError('Netzwerkfehler. Bitte erneut versuchen.')
      setActivating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-gray-500">Template nicht gefunden.</p>
        <Link href="/sites/library" className="mt-4 text-sm text-blue-600 hover:underline">
          ← Zurück zur Bibliothek
        </Link>
      </div>
    )
  }

  const plan = profile?.plan ?? 'starter'
  const limit = PLAN_LIMITS[plan] ?? 1
  const siteCount = profile?.paid_sites_count ?? profile?.sites_count ?? 0
  // Free templates never count toward the limit
  const atLimit = !template?.is_free && siteCount >= limit
  const isActivated = !!userSite
  const username = profile?.username ?? null
  const previewUrl = username ? `${username}.${template.domain}` : template.domain

  const images = template.preview_images && template.preview_images.length > 0
    ? template.preview_images
    : null

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Back */}
      <Link href="/sites/library"
        className="inline-flex items-center gap-2 text-sm mb-8 transition-colors"
        style={{ color: '#64748B' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Alle Templates
      </Link>

      {/* Hero section */}
      <div className="rounded-[24px] overflow-hidden mb-6"
        style={{ boxShadow: '0 8px 48px rgba(0,0,0,0.12)', border: '1px solid #E2E8F0', background: '#0F172A' }}>

        {/* Preview image */}
        {images ? (
          <div className="relative" style={{ background: '#0F172A' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[activeImage]}
              alt={template.title}
              className="w-full block"
              style={{ maxHeight: 480, objectFit: 'cover', objectPosition: 'top' }}
            />
            {/* Gradient overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(15,23,42,0.6), transparent)' }} />

            {/* Thumbnail strip if multiple images */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setActiveImage(i)}
                    className="rounded-[6px] overflow-hidden transition-all"
                    style={{
                      width: 52, height: 34,
                      border: `2px solid ${activeImage === i ? 'white' : 'rgba(255,255,255,0.3)'}`,
                      opacity: activeImage === i ? 1 : 0.7,
                    }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center"
            style={{ height: 320, background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>
            <div className="w-20 h-20 rounded-[20px] flex items-center justify-center mb-4"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.6)" strokeWidth="1">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>Vorschau wird bald verfügbar</p>
          </div>
        )}
      </div>

      {/* Main content: left info + right CTA */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

        {/* Left: title, description, tags, features */}
        <div className="flex flex-col gap-5">
          {/* Title + URL */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{template.title}</h1>
                {template.is_free && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full mt-2"
                    style={{ background: '#DBEAFE', color: '#1D4ED8', border: '1px solid rgba(29,78,216,0.2)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    Kostenlos — zählt nicht zum Plan-Limit
                  </span>
                )}
              </div>
              {isActivated && (
                <span className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mt-0.5"
                  style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid rgba(22,163,74,0.2)' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  Aktiviert
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span className="text-sm font-mono" style={{ color: '#64748B' }}>{previewUrl}</span>
            </div>
          </div>

          {/* Description */}
          {template.description && (
            <p className="text-base leading-relaxed" style={{ color: '#475569' }}>
              {template.description}
            </p>
          )}

          {/* Tags */}
          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {template.tags.map(tag => (
                <span key={tag}
                  className="text-xs font-medium px-3 py-1 rounded-full"
                  style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* What's included */}
          <div className="p-5 rounded-[20px]" style={{ background: '#FAFAFA', border: '1px solid #F1F5F9' }}>
            <p className="text-sm font-semibold text-gray-900 mb-3">Was du bekommst</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                'Professionelles Design',
                'Mobiloptimierte Darstellung',
                'SSL-verschlüsselt (HTTPS)',
                'Eigene Subdomain',
                'Direkt bearbeitbar',
                'Sofort veröffentlichbar',
              ].map(feat => (
                <div key={feat} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: '#F0FDF4' }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  </div>
                  <span className="text-sm" style={{ color: '#475569' }}>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: sticky CTA */}
        <div className="flex flex-col gap-4">
          <div className="p-6 rounded-[24px] bg-white flex flex-col gap-5"
            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #F1F5F9', position: 'sticky', top: 24 }}>

            {isActivated ? (
              <>
                <div>
                  <p className="text-lg font-bold text-gray-900 mb-1">Du nutzt dieses Template</p>
                  <p className="text-sm" style={{ color: '#94A3B8' }}>
                    Deine Website ist unter{' '}
                    <span className="font-mono font-medium" style={{ color: '#475569' }}>{previewUrl}</span>
                    {' '}erreichbar.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-[14px]"
                  style={{ background: '#F0FDF4', border: '1px solid rgba(22,163,74,0.2)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-green-800">Bereits aktiviert</p>
                    <p className="text-xs mt-0.5" style={{ color: '#4ADE80' }}>
                      {userSite?.status === 'published' ? 'Live und sichtbar' : 'Entwurf — noch nicht live'}
                    </p>
                  </div>
                </div>
                <Link href={`/sites/${userSite!.id}/edit`}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold text-white rounded-[16px] transition-all text-center"
                  style={{ background: '#1a1a1a', boxShadow: '0 4px 20px rgba(26,26,26,0.25)' }}>
                  Website bearbeiten →
                </Link>
              </>
            ) : atLimit ? (
              <>
                <div>
                  <p className="text-lg font-bold text-gray-900 mb-1">Upgrade für mehr Websites</p>
                  <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
                    Mit deinem <span className="font-semibold capitalize text-gray-800">{plan}</span>-Tarif kannst du maximal{' '}
                    <span className="font-semibold text-gray-800">{limit === Infinity ? '∞' : limit}</span> Website{limit !== 1 ? 'n' : ''} aktivieren.
                    Du hast bereits {siteCount} aktiv.
                  </p>
                </div>
                {/* Upgrade teaser */}
                <div className="p-4 rounded-[14px]" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <p className="text-xs font-semibold text-gray-900 mb-2">Pro-Tarif enthält:</p>
                  {['3 gleichzeitige Websites', 'Alle Templates', 'Prioritäts-Support'].map(f => (
                    <div key={f} className="flex items-center gap-2 mb-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                      <span className="text-xs" style={{ color: '#475569' }}>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/billing"
                  className="flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold rounded-[16px] transition-all text-center"
                  style={{ background: '#1a1a1a', color: 'white', boxShadow: '0 4px 20px rgba(26,26,26,0.25)' }}>
                  Tarif upgraden →
                </Link>
              </>
            ) : (
              <>
                <div>
                  <p className="text-lg font-bold text-gray-900 mb-1">Jetzt starten</p>
                  <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
                    Aktiviere das Template und passe es in wenigen Minuten mit deinen Inhalten an.
                  </p>
                </div>

                {/* URL preview */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-[12px]"
                  style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" className="flex-shrink-0">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span className="text-xs font-mono flex-1 truncate" style={{ color: '#475569' }}>
                    {previewUrl}
                  </span>
                </div>

                <button onClick={handleActivate} disabled={activating}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold text-white rounded-[16px] transition-all disabled:opacity-70"
                  style={{ background: '#1a1a1a', boxShadow: '0 4px 20px rgba(26,26,26,0.25)' }}>
                  {activating ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Wird aktiviert…
                    </>
                  ) : 'Diese Webseite aktivieren →'}
                </button>
                {activateError && (
                  <p className="text-xs text-center font-medium" style={{ color: '#DC2626' }}>{activateError}</p>
                )}
                <button onClick={() => setShowPreview(true)}
                  className="flex items-center justify-center gap-1.5 text-xs font-medium"
                  style={{ color: '#64748B' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  Live-Vorschau ansehen
                </button>
              </>
            )}

            {/* Plan info */}
            {profile && (
              <div className="pt-3 flex items-center justify-between"
                style={{ borderTop: '1px solid #F1F5F9' }}>
                <span className="text-xs" style={{ color: '#94A3B8' }}>
                  Tarif: <span className="font-semibold capitalize" style={{ color: '#475569' }}>{plan}</span>
                </span>
                <span className="text-xs" style={{ color: '#94A3B8' }}>
                  {siteCount}/{limit === Infinity ? '∞' : limit} Webseiten
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }}>
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
            style={{ background: '#1E293B', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: '#FC6058' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#FEC02F' }} />
                <div className="w-3 h-3 rounded-full" style={{ background: '#2ACA44' }} />
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-[8px]"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span className="text-[11px] font-mono" style={{ color: '#94A3B8' }}>{previewUrl}</span>
              </div>
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>{template.title} — Vorschau</span>
            </div>
            <button onClick={() => setShowPreview(false)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs font-medium"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Schließen
            </button>
          </div>
          <div className="flex-1 overflow-hidden bg-white">
            <iframe
              src={`/api/templates/${id}/preview`}
              className="w-full h-full border-0 block"
              title="Template-Vorschau"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  )
}
