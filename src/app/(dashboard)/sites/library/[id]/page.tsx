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
const TAG_LABEL: Record<string, string> = {
  fitline: 'FitLine',
  pminternational: 'PM International',
  sonstiges: 'Sonstiges',
  demo: 'Demo',
}

const FEATURES = [
  { icon: '📱', text: 'Funktioniert auf Handy, Tablet & PC' },
  { icon: '⚡', text: 'In wenigen Minuten online' },
  { icon: '🔒', text: 'SSL & DSGVO-konform' },
  { icon: '✏️', text: 'Jederzeit bearbeitbar' },
]

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

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl animate-pulse">
        <div className="h-4 w-28 bg-gray-100 rounded-full mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          <div>
            <div className="rounded-2xl bg-gray-100 mb-4" style={{ aspectRatio: '4/3' }} />
            <div className="h-6 w-1/2 bg-gray-100 rounded-full mb-3" />
            <div className="h-3 w-full bg-gray-100 rounded-full mb-2" />
            <div className="h-3 w-3/4 bg-gray-100 rounded-full" />
          </div>
          <div className="rounded-2xl bg-gray-100 h-64" />
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-gray-500 mb-4">Vorlage nicht gefunden.</p>
        <Link href="/sites/library" className="text-sm font-medium text-gray-700 underline underline-offset-2">
          ← Zurück zur Übersicht
        </Link>
      </div>
    )
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const plan = profile?.plan ?? 'starter'
  const limit = PLAN_LIMITS[plan] ?? 1
  const siteCount = profile?.paid_sites_count ?? 0
  const atLimit = !template.is_free && siteCount >= limit
  const isActivated = !!userSite
  const isLive = userSite?.status === 'published'
  const username = profile?.username ?? null
  const previewDomain = username ? `${username}.${template.domain}` : template.domain
  const images = template.preview_images?.length ? template.preview_images : null
  const visibleTags = (template.tags ?? []).filter(t => t !== 'demo')

  // Truncate description
  const desc = template.description ?? ''
  const shortDesc = desc.length > 200 ? desc.slice(0, 200).trim() + '…' : desc

  return (
    <div style={{ maxWidth: 980 }}>

      {/* ── Back ────────────────────────────────────────────────── */}
      <Link href="/sites/library"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-6">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Alle Vorlagen
      </Link>

      {/* ── ACTIVATED BANNER ────────────────────────────────────── */}
      {isActivated && (
        <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl mb-6"
          style={{ background: isLive ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${isLive ? '#BBF7D0' : '#FDE68A'}` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: isLive ? '#DCFCE7' : '#FEF3C7' }}>
              {isLive ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: isLive ? '#15803D' : '#92400E' }}>
                {isLive ? 'Diese Webseite ist live' : 'Vorlage bereits aktiviert — Entwurf'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: isLive ? '#16A34A' : '#92400E', opacity: 0.8 }}>
                {isLive ? `Erreichbar unter ${previewDomain}` : 'Noch nicht veröffentlicht'}
              </p>
            </div>
          </div>
          <Link href={`/sites/${userSite!.id}/edit`}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#1a1a1a' }}>
            Bearbeiten →
          </Link>
        </div>
      )}

      {/* ── Main layout ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">

        {/* ── LEFT: Image + info ──────────────────────────────── */}
        <div className="flex flex-col gap-6">

          {/* Preview image */}
          <div className="rounded-2xl overflow-hidden bg-gray-50"
            style={{ border: '1px solid #E5E7EB' }}>
            {images ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[activeImage]}
                  alt={template.title}
                  className="w-full block"
                  style={{ objectFit: 'cover', objectPosition: 'top', maxHeight: 500 }}
                />
                {/* Thumbnail strip */}
                {images.length > 1 && (
                  <div className="flex gap-2 p-3 border-t border-gray-100">
                    {images.map((img, i) => (
                      <button key={i} onClick={() => setActiveImage(i)}
                        className="rounded-lg overflow-hidden flex-shrink-0 transition-all"
                        style={{
                          width: 60, height: 40,
                          outline: activeImage === i ? '2px solid #1a1a1a' : '2px solid transparent',
                          outlineOffset: 2,
                          opacity: activeImage === i ? 1 : 0.5,
                        }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="w-full h-full object-cover object-top" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center" style={{ height: 320 }}>
                <p className="text-sm text-gray-300">Vorschau wird bald verfügbar</p>
              </div>
            )}
          </div>

          {/* Title + tags */}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {template.is_free && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
                  style={{ background: '#ECFDF5', color: '#065F46' }}>
                  Kostenlos
                </span>
              )}
              {visibleTags.map(tag => (
                <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                  style={{ background: '#F3F4F6', color: '#6B7280' }}>
                  {TAG_LABEL[tag] ?? tag}
                </span>
              ))}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{template.title}</h1>
            <p className="text-sm font-mono text-gray-400">{previewDomain}</p>
          </div>

          {/* Description */}
          {shortDesc && (
            <p className="text-base text-gray-600 leading-relaxed">{shortDesc}</p>
          )}

          {/* Features */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                <span className="text-lg leading-none">{icon}</span>
                <span className="text-xs font-medium text-gray-700 leading-snug">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Sticky CTA ───────────────────────────────── */}
        <div style={{ position: 'sticky', top: 24, alignSelf: 'start' }}>
          <div className="rounded-2xl bg-white flex flex-col gap-5 p-6"
            style={{ border: '1px solid #E5E7EB', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

            {/* ── State A: Already activated ── */}
            {isActivated && (
              <>
                <div className="flex items-center gap-3 p-4 rounded-xl"
                  style={{ background: isLive ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${isLive ? '#BBF7D0' : '#FDE68A'}` }}>
                  <span className="relative flex h-3 w-3 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                      style={{ background: isLive ? '#22C55E' : '#F59E0B' }} />
                    <span className="relative inline-flex rounded-full h-3 w-3"
                      style={{ background: isLive ? '#22C55E' : '#F59E0B' }} />
                  </span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: isLive ? '#15803D' : '#92400E' }}>
                      {isLive ? 'Live & sichtbar' : 'Entwurf'}
                    </p>
                    <p className="text-xs mt-0.5 font-mono" style={{ color: isLive ? '#16A34A' : '#B45309' }}>
                      {previewDomain}
                    </p>
                  </div>
                </div>

                <Link href={`/sites/${userSite!.id}/edit`}
                  className="flex items-center justify-center gap-2 py-4 px-5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#1a1a1a' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Webseite bearbeiten
                </Link>

                {isLive && (
                  <a href={`https://${previewDomain}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-medium transition-colors hover:bg-gray-100"
                    style={{ background: '#F3F4F6', color: '#374151' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                    </svg>
                    Webseite ansehen
                  </a>
                )}
              </>
            )}

            {/* ── State B: At limit → Upgrade ── */}
            {!isActivated && atLimit && (
              <>
                <div>
                  <p className="text-base font-bold text-gray-900 mb-1">Tarif-Upgrade nötig</p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Du hast bereits {siteCount} von {limit} möglichen Webseiten. Mit einem Upgrade schaltest du mehr frei.
                  </p>
                </div>

                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
                  <div className="p-4" style={{ background: '#F9FAFB' }}>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Pro enthält</p>
                    {['3 Webseiten gleichzeitig', 'Alle Vorlagen', 'Eigene Domain', 'Prioritäts-Support'].map(f => (
                      <div key={f} className="flex items-center gap-2 mb-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round"/>
                        </svg>
                        <span className="text-xs text-gray-700">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link href="/billing"
                  className="flex items-center justify-center gap-2 py-4 px-5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#1a1a1a' }}>
                  Tarif upgraden →
                </Link>
              </>
            )}

            {/* ── State C: Ready to activate ── */}
            {!isActivated && !atLimit && (
              <>
                <div>
                  <p className="text-base font-bold text-gray-900 mb-1">
                    {template.is_free ? 'Kostenlos aktivieren' : 'Vorlage aktivieren'}
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Einmal aktivieren, dann deine Daten eintragen — in wenigen Minuten bist du online.
                  </p>
                </div>

                {/* Domain preview */}
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                  </svg>
                  <span className="text-xs font-mono text-gray-500 truncate">{previewDomain}</span>
                </div>

                {/* Activate button */}
                <button
                  onClick={handleActivate}
                  disabled={activating}
                  className="flex items-center justify-center gap-2 py-4 px-5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-60"
                  style={{ background: '#1a1a1a', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
                  {activating ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Wird aktiviert…
                    </>
                  ) : (
                    <>
                      Webseite aktivieren
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </>
                  )}
                </button>

                {activateError && (
                  <p className="text-xs text-center text-red-600 font-medium">{activateError}</p>
                )}

                {/* Preview link */}
                <button onClick={() => setShowPreview(true)}
                  className="flex items-center justify-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  Live-Vorschau ansehen
                </button>
              </>
            )}

            {/* Quota footer */}
            {profile && !isActivated && (
              <div className="pt-4 flex items-center justify-between text-xs text-gray-400"
                style={{ borderTop: '1px solid #F3F4F6' }}>
                <span>Tarif: <span className="font-medium text-gray-600 capitalize">{plan}</span></span>
                <span>{siteCount} / {limit === Infinity ? '∞' : limit} Webseiten</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Preview modal ──────────────────────────────────────── */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
            style={{ background: '#111', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-white">{template.title}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#9CA3AF' }}>
                {previewDomain}
              </span>
            </div>
            <button onClick={() => setShowPreview(false)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.1)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Schließen
            </button>
          </div>
          <div className="flex-1 overflow-hidden bg-white">
            <iframe
              src={`/api/templates/${id}/preview`}
              className="w-full h-full border-0 block"
              title="Vorschau"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}

    </div>
  )
}
