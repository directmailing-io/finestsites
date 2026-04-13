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
  activated?: boolean
  activatedSiteId?: string
}

function TemplateCard({ tpl, onActivate }: { tpl: Template; onActivate: (id: string) => void }) {
  const preview = tpl.preview_images?.[0] ?? null

  return (
    <div
      className="group relative flex flex-col rounded-[20px] bg-white overflow-hidden transition-all duration-200"
      style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)' }}>

      {/* Preview image */}
      <Link href={`/sites/library/${tpl.id}`} className="block relative overflow-hidden flex-shrink-0"
        style={{ background: '#F1F5F9' }}>
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0"
          style={{ background: '#E8ECF0', borderBottom: '1px solid #DDE3EA' }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FC6058' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FEC02F' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#2ACA44' }} />
          <div className="flex-1 mx-2 h-4 rounded-sm flex items-center px-2"
            style={{ background: '#F8FAFC', border: '1px solid #D1D9E0' }}>
            <span className="text-[9px] font-mono truncate" style={{ color: '#94A3B8' }}>
              username.{tpl.domain}
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden" style={{ aspectRatio: '16/10' }}>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={tpl.title}
              className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{ background: 'linear-gradient(160deg, #F8FAFC 0%, #EEF2F7 100%)' }}>
              <div className="flex flex-col items-center gap-2 opacity-40">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </div>
            </div>
          )}

          {/* Activated badge */}
          {tpl.activated && (
            <div className="absolute top-2.5 left-2.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{
                  background: 'rgba(22,163,74,0.15)',
                  color: '#15803D',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(22,163,74,0.3)',
                }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#16A34A' }} />
                Aktiviert
              </span>
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-all duration-200 scale-95 group-hover:scale-100 text-xs font-semibold text-white px-4 py-2 rounded-full"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}>
              Details ansehen
            </span>
          </div>
        </div>
      </Link>

      {/* Card body */}
      <div className="px-4 py-3.5 flex flex-col gap-2.5">
        <div>
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{tpl.title}</p>
          {tpl.description && (
            <p className="text-xs mt-0.5 line-clamp-2 leading-relaxed" style={{ color: '#94A3B8' }}>
              {tpl.description}
            </p>
          )}
        </div>

        {/* Tags */}
        {tpl.tags && tpl.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tpl.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: '#F1F5F9', color: '#64748B' }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-0.5" style={{ borderTop: '1px solid #F1F5F9' }}>
          <Link href={`/sites/library/${tpl.id}`}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-[8px] font-medium transition-colors duration-150"
            style={{ color: '#64748B', background: '#F8FAFC' }}>
            Vorschau
          </Link>
          {tpl.activated ? (
            <Link href={`/sites/${tpl.activatedSiteId}/edit`}
              className="ml-auto flex items-center gap-1 text-xs px-3 py-1.5 rounded-[8px] font-semibold transition-all duration-150"
              style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid rgba(22,163,74,0.2)' }}>
              Bearbeiten →
            </Link>
          ) : (
            <button onClick={() => onActivate(tpl.id)}
              className="ml-auto flex items-center gap-1 text-xs px-3 py-1.5 rounded-[8px] font-semibold text-white transition-all duration-150"
              style={{ background: '#1a1a1a' }}>
              Aktivieren
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LibraryPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [userSites, setUserSites] = useState<Array<{ template_id: string; id: string }>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activating, setActivating] = useState(false)
  const [limitError, setLimitError] = useState('')

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
    const result = templates.map(t => ({
      ...t,
      activated: siteMap.has(t.id),
      activatedSiteId: siteMap.get(t.id),
    }))
    // Sort: activated first
    return result.sort((a, b) => (b.activated ? 1 : 0) - (a.activated ? 1 : 0))
  }, [templates, userSites])

  const filtered = useMemo(() => {
    if (!search.trim()) return enriched
    const q = search.toLowerCase()
    return enriched.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q))
    )
  }, [enriched, search])

  async function handleActivate(templateId: string) {
    setActivating(true)
    setLimitError('')
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (res.status === 403) {
        setLimitError(data.error ?? 'Plan-Limit erreicht.')
      }
      setActivating(false)
      return
    }
    router.push(`/sites/${data.id}/edit`)
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Webseiten-Bibliothek</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            {loading ? '…' : `${templates.length} Template${templates.length !== 1 ? 's' : ''} verfügbar`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2" width="16" height="16"
          viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Templates durchsuchen…"
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-[14px] outline-none transition-all"
          style={{
            background: 'white',
            border: '1.5px solid #E2E8F0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
          onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
          onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
        />
      </div>

      {limitError && (
        <div className="mb-4 px-4 py-3 rounded-[14px] text-sm flex items-center justify-between"
          style={{ background: '#FEF9C3', border: '1px solid #FDE68A', color: '#92400E' }}>
          <span>{limitError}</span>
          <a href="/billing" className="font-semibold underline ml-2">Tarif upgraden →</a>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-[20px] overflow-hidden" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
              <div className="animate-pulse" style={{ aspectRatio: '16/10', background: '#E2E8F0' }} />
              <div className="p-4 flex flex-col gap-3 animate-pulse">
                <div className="h-3.5 rounded-full bg-gray-200 w-2/3" />
                <div className="h-2.5 rounded-full bg-gray-100 w-full" />
                <div className="h-7 rounded-[8px] bg-gray-100 mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-[24px]"
          style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)', border: '1px solid #E2E8F0' }}>
          <h3 className="font-semibold text-gray-800 text-lg mb-2">Keine Templates gefunden</h3>
          <p className="text-sm" style={{ color: '#94A3B8' }}>Versuche einen anderen Suchbegriff.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(tpl => (
            <TemplateCard key={tpl.id} tpl={tpl} onActivate={handleActivate} />
          ))}
        </div>
      )}

      {activating && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-[20px] p-6 flex items-center gap-4"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
            <span className="text-sm font-medium text-gray-700">Website wird aktiviert…</span>
          </div>
        </div>
      )}
    </div>
  )
}
