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
}

interface UserSite {
  id: string
  template_id: string
  status: string
}

interface UserProfile {
  plan: string
  sites_count: number
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
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [activeImage, setActiveImage] = useState(0)

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
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: id }),
    })
    const data = await res.json()
    if (res.ok) {
      router.push(`/sites/${data.id}/edit`)
    } else {
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
  const siteCount = profile?.sites_count ?? 0
  const atLimit = siteCount >= limit
  const isActivated = !!userSite

  const images = template.preview_images && template.preview_images.length > 0
    ? template.preview_images
    : null

  return (
    <div className="max-w-5xl">
      {/* Back */}
      <Link href="/sites/library"
        className="inline-flex items-center gap-2 text-sm mb-6 transition-colors"
        style={{ color: '#64748B' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Alle Templates
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        {/* Left: Preview */}
        <div className="flex flex-col gap-4">
          {/* Preview area */}
          <div className="rounded-[20px] overflow-hidden"
            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.10)', border: '1px solid #E2E8F0' }}>
            {/* Browser chrome */}
            <div className="flex items-center justify-between px-4 py-2.5"
              style={{ background: '#E8ECF0', borderBottom: '1px solid #DDE3EA' }}>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background: '#FC6058' }} />
                <span className="w-3 h-3 rounded-full" style={{ background: '#FEC02F' }} />
                <span className="w-3 h-3 rounded-full" style={{ background: '#2ACA44' }} />
              </div>
              <div className="flex-1 mx-4 h-5 rounded flex items-center px-3 max-w-xs"
                style={{ background: '#F8FAFC', border: '1px solid #D1D9E0' }}>
                <span className="text-[10px] font-mono truncate" style={{ color: '#94A3B8' }}>
                  username.{template.domain}
                </span>
              </div>
              {/* Device toggle */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-[8px]" style={{ background: '#D1D9E0' }}>
                <button onClick={() => setPreviewMode('desktop')}
                  className="p-1 rounded-[6px] transition-all"
                  style={{ background: previewMode === 'desktop' ? 'white' : 'transparent', color: previewMode === 'desktop' ? '#1a1a1a' : '#94A3B8' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </button>
                <button onClick={() => setPreviewMode('mobile')}
                  className="p-1 rounded-[6px] transition-all"
                  style={{ background: previewMode === 'mobile' ? 'white' : 'transparent', color: previewMode === 'mobile' ? '#1a1a1a' : '#94A3B8' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/>
                  </svg>
                </button>
              </div>
            </div>

            {images ? (
              <div className="relative overflow-hidden" style={{ background: '#F8FAFC', minHeight: 280 }}>
                <div className="flex items-center justify-center p-4"
                  style={{ background: previewMode === 'mobile' ? '#E8ECF0' : '#F8FAFC' }}>
                  <div style={{
                    maxWidth: previewMode === 'mobile' ? 380 : '100%',
                    width: '100%',
                    transition: 'max-width 0.3s ease',
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={images[activeImage]}
                      alt={template.title}
                      className="w-full h-auto rounded-[8px]"
                      style={{ boxShadow: previewMode === 'mobile' ? '0 4px 20px rgba(0,0,0,0.15)' : 'none' }}
                    />
                  </div>
                </div>

                {/* Image thumbnails */}
                {images.length > 1 && (
                  <div className="flex gap-2 px-4 pb-4">
                    {images.map((img, i) => (
                      <button key={i} onClick={() => setActiveImage(i)}
                        className="relative rounded-[8px] overflow-hidden flex-shrink-0 transition-all"
                        style={{
                          width: 64, height: 40,
                          border: `2px solid ${activeImage === i ? '#1a1a1a' : '#E2E8F0'}`,
                        }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-4"
                style={{ background: 'linear-gradient(160deg, #F8FAFC 0%, #EEF2F7 100%)' }}>
                <div className="opacity-30">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1">
                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color: '#CBD5E1' }}>Noch keine Vorschau verfügbar</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Info + CTA */}
        <div className="flex flex-col gap-5">
          {/* Title & description */}
          <div className="p-5 rounded-[20px] bg-white flex flex-col gap-3"
            style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{template.title}</h1>
              <p className="text-xs font-mono mt-0.5" style={{ color: '#94A3B8' }}>username.{template.domain}</p>
            </div>

            {template.description && (
              <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
                {template.description}
              </p>
            )}

            {/* Tags */}
            {template.tags && template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {template.tags.map(tag => (
                  <span key={tag} className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                    style={{ background: '#F1F5F9', color: '#475569' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* CTA card */}
          <div className="p-5 rounded-[20px] bg-white flex flex-col gap-4"
            style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>

            {isActivated ? (
              <>
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[12px]"
                  style={{ background: '#F0FDF4', border: '1px solid rgba(22,163,74,0.2)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  <span className="text-sm font-medium text-green-700">Bereits aktiviert</span>
                </div>
                <Link href={`/sites/${userSite!.id}/edit`}
                  className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white rounded-[14px] transition-all text-center"
                  style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.20)' }}>
                  Website bearbeiten →
                </Link>
              </>
            ) : atLimit ? (
              <>
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Plan-Limit erreicht</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>
                    Mit deinem aktuellen Tarif ({plan}) kannst du maximal {limit === Infinity ? '∞' : limit} Website{limit !== 1 ? 'n' : ''} aktivieren.
                    Upgrade für mehr.
                  </p>
                </div>
                <Link href="/billing"
                  className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-[14px] transition-all text-center"
                  style={{ background: '#1a1a1a', color: 'white', boxShadow: '0 4px 14px rgba(26,26,26,0.20)' }}>
                  Tarif upgraden →
                </Link>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Diese Website aktivieren</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>
                    Aktiviere das Template und passe es mit deinen eigenen Inhalten an.
                  </p>
                </div>
                <button onClick={handleActivate} disabled={activating}
                  className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white rounded-[14px] transition-all disabled:opacity-70"
                  style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.20)' }}>
                  {activating ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Wird aktiviert…
                    </>
                  ) : 'Diese Webseite jetzt aktivieren →'}
                </button>
              </>
            )}
          </div>

          {/* Plan info */}
          {profile && (
            <div className="px-4 py-3 rounded-[14px] text-xs" style={{ background: '#F8FAFC', color: '#94A3B8' }}>
              Aktueller Tarif: <span className="font-semibold capitalize text-gray-700">{plan}</span>
              {' · '}
              {siteCount}/{limit === Infinity ? '∞' : limit} Webseiten aktiv
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
