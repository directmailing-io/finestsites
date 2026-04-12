'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Template {
  id: string
  title: string
  description: string
  domain: string
  preview_images: string[]
  placeholder_schema: { fields: { key: string; label: string; type: string }[] }
}

export default function NewSitePage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(data => { setTemplates(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function selectTemplate(templateId: string) {
    setCreating(templateId)
    setError('')
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Fehler'); setCreating(null); return }
    router.push(`/sites/${data.id}/edit`)
  }

  const fieldCount = (t: Template) => t.placeholder_schema?.fields?.length ?? 0

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <button onClick={() => router.push('/sites')}
          className="flex items-center gap-2 text-sm mb-4"
          style={{ color: 'var(--muted-foreground)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Meine Seiten
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">Neue Website erstellen</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Wähle ein Template — deine Seite wird innerhalb von Minuten live sein.
        </p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-[16px] text-sm text-red-600"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 rounded-[24px] animate-pulse" style={{ background: '#F3F4F6' }} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-4"
            style={{ background: '#F3F4F6' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
            </svg>
          </div>
          <h3 className="font-semibold text-gray-700 mb-1">Noch keine Templates</h3>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Der Admin muss zuerst Templates veröffentlichen.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map(t => (
            <div key={t.id}
              className="group rounded-[24px] bg-white flex flex-col overflow-hidden transition-all duration-200"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.14)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)')}>

              {/* Preview area */}
              <div className="h-40 flex items-center justify-center relative"
                style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #faf0ff 100%)' }}>
                {t.preview_images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.preview_images[0]} alt={t.title}
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 opacity-40">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.5">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                    </svg>
                    <span className="text-xs font-medium text-indigo-400">{t.domain}</span>
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <span className="text-xs font-mono px-2 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.9)', color: '#374151', backdropFilter: 'blur(4px)' }}>
                    {t.domain}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{t.title}</h3>
                  {t.description && (
                    <p className="text-sm leading-relaxed line-clamp-2"
                      style={{ color: 'var(--muted-foreground)' }}>
                      {t.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: '#F0F4FF', color: '#4338CA' }}>
                    {fieldCount(t)} Felder
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: '#F0FDF4', color: '#16A34A' }}>
                    username.{t.domain}
                  </span>
                </div>

                <button
                  onClick={() => selectTemplate(t.id)}
                  disabled={creating === t.id}
                  className="mt-auto w-full py-2.5 text-sm font-semibold text-white rounded-[16px] transition-all"
                  style={{
                    background: creating === t.id ? '#9CA3AF' : '#1a1a1a',
                    boxShadow: creating === t.id ? 'none' : '0 4px 14px rgba(26,26,26,0.25)',
                  }}>
                  {creating === t.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Wird erstellt…
                    </span>
                  ) : 'Dieses Template wählen →'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
