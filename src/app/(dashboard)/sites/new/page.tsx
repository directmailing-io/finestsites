'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Template {
  id: string
  title: string
  description: string | null
  domain: string
  preview_images: string[] | null
  tags: string[] | null
  is_free?: boolean
}

interface Site {
  template_id: string
  id: string
}

export default function NewSitePage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [activatedMap, setActivatedMap] = useState<Record<string, string>>({}) // templateId → siteId
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/templates').then(r => r.json()),
      fetch('/api/sites').then(r => r.json()),
    ]).then(([templatesData, sitesData]) => {
      setTemplates(Array.isArray(templatesData) ? templatesData : [])
      const map: Record<string, string> = {}
      if (Array.isArray(sitesData)) {
        for (const s of sitesData as Site[]) {
          map[s.template_id] = s.id
        }
      }
      setActivatedMap(map)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleSelect(templateId: string) {
    if (busy) return
    // Already activated → go directly to editor
    if (activatedMap[templateId]) {
      router.push(`/sites/${activatedMap[templateId]}/edit`)
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
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Welche Vorlage passt zu dir?
        </h1>
        <p className="text-base mt-2" style={{ color: '#94A3B8' }}>
          Wähle eine Vorlage und starte sofort mit deiner Webseite.
        </p>
      </div>

      {/* ── Template list ── */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex gap-4 p-4 rounded-2xl bg-white"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
              <div className="flex-shrink-0 rounded-xl bg-gray-100" style={{ width: 140, aspectRatio: '4/3' }} />
              <div className="flex-1 flex flex-col gap-3 py-1">
                <div className="h-4 rounded-full bg-gray-100 w-1/2" />
                <div className="h-3 rounded-full bg-gray-100 w-full" />
                <div className="h-3 rounded-full bg-gray-100 w-3/4" />
                <div className="mt-auto h-10 rounded-xl bg-gray-100 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="py-20 text-center rounded-3xl" style={{ background: '#FAFAFA', border: '1px solid #E5E7EB' }}>
          <p className="font-semibold text-gray-700 mb-1">Keine Vorlagen verfügbar</p>
          <p className="text-sm text-gray-400">Bitte versuche es später erneut.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {templates.filter(tpl => !activatedMap[tpl.id]).map(tpl => {
            const isBusy = busy === tpl.id
            const preview = tpl.preview_images?.[0] ?? null

            return (
              <div key={tpl.id}
                className="flex rounded-2xl bg-white overflow-hidden"
                style={{
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 6px 24px rgba(0,0,0,0.06)',
                  border: '1px solid #F1F5F9',
                  minHeight: 220,
                }}>

                {/* Image — left side */}
                <div className="flex-shrink-0 relative overflow-hidden bg-gray-100" style={{ width: '42%' }}>
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt={tpl.title}
                      className="absolute inset-0 w-full h-full object-cover object-top" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'linear-gradient(160deg, #F8FAFC 0%, #F1F5F9 100%)' }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                      </svg>
                    </div>
                  )}
                  {tpl.is_free && (
                    <div className="absolute top-3 left-3">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.95)', color: '#1D4ED8' }}>
                        Gratis
                      </span>
                    </div>
                  )}
                </div>

                {/* Content — right side */}
                <div className="flex-1 flex flex-col gap-4 p-6 min-w-0">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-[17px] leading-snug mb-3">
                      {tpl.title}
                    </h3>
                    {tpl.description && (
                      <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
                        {tpl.description}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleSelect(tpl.id)}
                    disabled={!!busy}
                    className="w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                    style={{
                      background: isBusy ? '#E5E7EB' : '#1a1a1a',
                      color: isBusy ? '#9CA3AF' : '#fff',
                    }}
                  >
                    {isBusy ? (
                      <>
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin" />
                        Wird geöffnet…
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 5v14M5 12h14"/>
                        </svg>
                        Webseite bearbeiten und veröffentlichen
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
