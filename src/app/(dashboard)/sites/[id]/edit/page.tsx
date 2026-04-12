'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardOption {
  value: string; label: string; description: string
  card_type: 'text' | 'image' | 'color'; image_url: string; color: string
}

interface FieldSchema {
  key: string; label: string; type: string; required: boolean
  placeholder_text: string; default_value: string; max_length: number | null
  options: string[]; card_options: CardOption[]; section: string
}

interface SiteData {
  id: string; status: string
  templates: { id: string; title: string; domain: string; r2_bundle_path: string | null; placeholder_schema: { fields: FieldSchema[] } }
  users?: { username: string }
  data: Record<string, string>
}

// ─── Field Renderers ──────────────────────────────────────────────────────────

function CardSelectField({ field, value, onChange }: {
  field: FieldSchema; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {(field.card_options ?? []).map(opt => {
        const selected = value === opt.value
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className="flex flex-col items-center gap-2 p-3 rounded-[16px] transition-all text-center"
            style={{
              border: `2px solid ${selected ? '#1a1a1a' : '#E5E7EB'}`,
              background: selected ? '#F9FAFB' : 'white',
              boxShadow: selected ? '0 0 0 3px rgba(26,26,26,0.08)' : 'none',
            }}>
            {opt.card_type === 'color' && opt.color && (
              <div className="w-10 h-10 rounded-full"
                style={{ background: opt.color, boxShadow: `0 0 0 3px ${opt.color}22` }} />
            )}
            {opt.card_type === 'image' && opt.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={opt.image_url} alt={opt.label}
                className="w-full h-20 object-cover rounded-[10px]" />
            )}
            {opt.card_type === 'image' && !opt.image_url && (
              <div className="w-full h-16 rounded-[10px] flex items-center justify-center"
                style={{ background: '#F3F4F6' }}>
                <span className="text-xs text-gray-400">Bild</span>
              </div>
            )}
            <span className="text-sm font-semibold text-gray-900 leading-tight">{opt.label}</span>
            {opt.description && (
              <span className="text-xs leading-tight" style={{ color: 'var(--muted-foreground)' }}>
                {opt.description}
              </span>
            )}
            {selected && (
              <div className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: '#1a1a1a' }}>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

function FieldRenderer({ field, value, onChange }: {
  field: FieldSchema; value: string; onChange: (v: string) => void
}) {
  const inputStyle = {
    background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '14px',
    padding: '10px 14px', fontSize: '14px', outline: 'none', width: '100%',
  }

  switch (field.type) {
    case 'textarea':
      return (
        <textarea value={value} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder_text || field.label}
          rows={4} maxLength={field.max_length ?? undefined}
          style={{ ...inputStyle, resize: 'vertical' }}
          onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
      )

    case 'image':
      return (
        <div className="flex flex-col gap-2">
          {value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Vorschau"
              className="w-24 h-24 object-cover rounded-[14px]"
              style={{ border: '2px solid #E5E7EB' }} />
          )}
          <input value={value} onChange={e => onChange(e.target.value)}
            placeholder="Bild-URL eingeben (https://...)"
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Lade dein Bild auf imgbb.com oder Cloudinary hoch und füge die URL ein.
          </p>
        </div>
      )

    case 'dropdown':
      return (
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="">— bitte wählen —</option>
          {(field.options ?? []).filter(Boolean).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )

    case 'card_select':
      return <CardSelectField field={field} value={value} onChange={onChange} />

    case 'url':
      return (
        <input type="url" value={value} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder_text || 'https://'}
          maxLength={field.max_length ?? undefined}
          style={inputStyle}
          onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
      )

    case 'email':
      return (
        <input type="email" value={value} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder_text || 'name@beispiel.de'}
          maxLength={field.max_length ?? undefined}
          style={inputStyle}
          onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
      )

    default: // text
      return (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder_text || field.label}
          maxLength={field.max_length ?? undefined}
          style={inputStyle}
          onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
      )
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SiteEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [site, setSite] = useState<SiteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [publishedUrl, setPublishedUrl] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [previewKey, setPreviewKey] = useState(0)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/sites/${id}`)
      .then(r => r.json())
      .then((data: SiteData) => {
        setSite(data)
        // Initialize values: DB data → or default_value
        const init: Record<string, string> = {}
        const fields = data.templates?.placeholder_schema?.fields ?? []
        for (const f of fields) {
          init[f.key] = data.data?.[f.key] ?? f.default_value ?? ''
        }
        setValues(init)
        setLoading(false)
        // Set first section as active
        const sections = [...new Set(fields.map(f => f.section || '').filter(Boolean))]
        if (sections.length > 0) setActiveSection(sections[0])
      })
      .catch(() => setLoading(false))
  }, [id])

  const updatePreview = useCallback((vals: Record<string, string>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPreviewKey(k => k + 1)
    }, 600)
  }, [])

  function handleChange(key: string, val: string) {
    const next = { ...values, [key]: val }
    setValues(next)
    updatePreview(next)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await fetch(`/api/sites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Fehler beim Speichern.')
    } else {
      setSuccess('Gespeichert!')
      setTimeout(() => setSuccess(''), 2000)
    }
    setSaving(false)
  }

  async function handlePublish() {
    // Save first
    await fetch(`/api/sites/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    setPublishing(true)
    setError('')
    const res = await fetch(`/api/sites/${id}/publish`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Fehler beim Veröffentlichen.')
    } else {
      setPublishedUrl(data.url)
      setSite(prev => prev ? { ...prev, status: 'published' } : prev)
      setSuccess('Website veröffentlicht!')
    }
    setPublishing(false)
  }

  async function handleUnpublish() {
    await fetch(`/api/sites/${id}/publish`, { method: 'DELETE' })
    setSite(prev => prev ? { ...prev, status: 'draft' } : prev)
    setPublishedUrl('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
      </div>
    )
  }

  if (!site) {
    return <div className="p-8 text-center text-gray-500">Website nicht gefunden.</div>
  }

  const fields = site.templates?.placeholder_schema?.fields ?? []
  const sections = [...new Set(fields.map(f => f.section || 'Allgemein'))]
  const previewDataB64 = Buffer.from(JSON.stringify(values)).toString('base64')
  const previewUrl = `/api/preview/${id}?data=${encodeURIComponent(previewDataB64)}`

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 64px)' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/sites')}
            className="p-2 rounded-[12px] transition-all"
            style={{ background: '#F3F4F6', color: '#374151' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900 leading-tight">
              {site.templates?.title}
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              username.{site.templates?.domain}
            </p>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full"
            style={{
              background: site.status === 'published' ? '#F0FDF4' : '#F3F4F6',
              color: site.status === 'published' ? '#16A34A' : '#6B7280',
            }}>
            {site.status === 'published' ? '● Live' : '○ Entwurf'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {success && (
            <span className="text-xs text-green-700 font-medium px-3 py-1.5 rounded-[10px]"
              style={{ background: '#F0FDF4' }}>✓ {success}</span>
          )}
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-[14px] transition-all"
            style={{ background: '#F3F4F6', color: '#374151' }}>
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
          {site.status !== 'published' ? (
            <button onClick={handlePublish} disabled={publishing}
              className="px-5 py-2 text-sm font-semibold text-white rounded-[14px] transition-all"
              style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.25)' }}>
              {publishing ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Veröffentlichen…
                </span>
              ) : 'Veröffentlichen →'}
            </button>
          ) : (
            <button onClick={handleUnpublish}
              className="px-4 py-2 text-sm font-medium rounded-[14px]"
              style={{ background: '#FEF9C3', color: '#92400E' }}>
              Offline nehmen
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-[14px] text-sm text-red-600"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {publishedUrl && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-[14px] text-sm flex items-center justify-between"
          style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A' }}>
          <span className="font-medium">✓ Deine Website ist live!</span>
          <a href={publishedUrl} target="_blank" rel="noopener noreferrer"
            className="font-mono text-xs hover:underline">{publishedUrl}</a>
        </div>
      )}

      {/* ── Main split layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Form ── */}
        <div className="w-96 flex-shrink-0 flex flex-col border-r overflow-hidden"
          style={{ borderColor: 'var(--border)' }}>

          {/* Section tabs */}
          {sections.length > 1 && (
            <div className="flex gap-1 px-4 py-3 border-b overflow-x-auto flex-shrink-0"
              style={{ borderColor: 'var(--border)', background: '#FAFAFA' }}>
              {sections.map(sec => (
                <button key={sec} onClick={() => setActiveSection(sec)}
                  className="text-xs font-medium px-3 py-1.5 rounded-[10px] whitespace-nowrap transition-all flex-shrink-0"
                  style={{
                    background: activeSection === sec ? '#1a1a1a' : 'transparent',
                    color: activeSection === sec ? 'white' : '#6B7280',
                  }}>
                  {sec}
                </button>
              ))}
            </div>
          )}

          {/* Fields */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
            {fields.length === 0 && (
              <div className="text-center py-12 text-sm text-gray-400">
                Dieses Template hat keine Felder.
              </div>
            )}

            {fields
              .filter(f => !activeSection || (f.section || 'Allgemein') === activeSection || sections.length === 1)
              .map(field => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    {field.label}
                    {field.required && <span className="text-red-500 text-base leading-none">*</span>}
                  </label>
                  <FieldRenderer
                    field={field}
                    value={values[field.key] ?? ''}
                    onChange={val => handleChange(field.key, val)}
                  />
                </div>
              ))}
          </div>
        </div>

        {/* ── Right: Preview ── */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#F3F4F6' }}>
          <div className="flex items-center justify-between px-4 py-2 border-b bg-white flex-shrink-0"
            style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-medium text-gray-500">Live-Vorschau</span>
            <button onClick={() => setPreviewKey(k => k + 1)}
              className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] transition-all"
              style={{ background: '#F3F4F6', color: '#6B7280' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              Aktualisieren
            </button>
          </div>

          {site.templates?.r2_bundle_path ? (
            <iframe
              ref={iframeRef}
              key={previewKey}
              src={previewUrl}
              className="flex-1 w-full border-0"
              title="Website-Vorschau"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-4"
                style={{ background: '#FEF3C7' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.5">
                  <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
              </div>
              <h3 className="font-semibold text-gray-700 mb-1">Noch keine Vorschau</h3>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Dieses Template hat noch keine HTML-Datei. <br />
                Der Admin muss sie im Template-Editor hochladen.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
