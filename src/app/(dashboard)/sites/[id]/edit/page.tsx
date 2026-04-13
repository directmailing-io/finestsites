'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import ImageCropModal from '@/components/ImageCropModal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardOption {
  value: string; label: string; description: string
  card_type: 'text' | 'image' | 'color'; image_url: string; color: string
}

interface FieldSchema {
  key: string; label: string; type: string; required: boolean
  placeholder_text: string; default_value: string; max_length: number | null
  options: string[]; card_options: CardOption[]; section: string
  aspect_ratio?: string
}

interface SiteData {
  id: string; status: string
  username: string | null
  templates: { id: string; title: string; domain: string; r2_bundle_path: string | null; placeholder_schema: { fields: FieldSchema[] } }
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

function ImageField({ field, value, onChange }: {
  field: FieldSchema; value: string; onChange: (v: string) => void
}) {
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const arStr = (field as any).aspect_ratio ?? 'free'
  const aspectRatioNum = arStr === '1/1' ? 1 : arStr === '4/3' ? 4/3 : arStr === '16/9' ? 16/9 : arStr === '3/2' ? 3/2 : arStr === '9/16' ? 9/16 : undefined

  async function handleCropConfirm(blob: Blob) {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setUploading(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', blob, 'image.jpg')
      const res = await fetch('/api/upload/image', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setUploadError(data.error ?? 'Upload fehlgeschlagen'); return }
      onChange(data.url)
    } catch { setUploadError('Upload fehlgeschlagen') }
    finally { setUploading(false) }
  }

  return (
    <div className="flex flex-col gap-3">
      {cropSrc && (
        <ImageCropModal imageUrl={cropSrc} aspectRatio={aspectRatioNum}
          onConfirm={handleCropConfirm}
          onCancel={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null) }} />
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { setCropSrc(URL.createObjectURL(f)) }; e.target.value = '' }} />

      {value ? (
        <div className="flex flex-col gap-2">
          <div className="relative rounded-[16px] overflow-hidden" style={{ background: '#F3F4F6' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Hochgeladenes Bild" className="w-full object-cover rounded-[16px]"
              style={{ aspectRatio: arStr !== 'free' ? arStr : undefined, maxHeight: '280px', objectFit: 'cover' }} />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-[14px] transition-all"
              style={{ background: '#1a1a1a', color: 'white' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              Bild ersetzen
            </button>
            <button type="button" onClick={() => onChange('')}
              className="px-4 py-2.5 text-sm font-semibold rounded-[14px]"
              style={{ background: '#FEF2F2', color: '#DC2626' }}>
              Entfernen
            </button>
          </div>
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-[20px] cursor-pointer transition-all active:scale-[0.98]"
          style={{ border: '2px dashed #D1D5DB', background: '#FAFAFA', minHeight: '160px', padding: '32px 24px' }}
          onClick={() => fileInputRef.current?.click()}>
          {uploading ? (
            <div className="w-8 h-8 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#F3F4F6' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-gray-700">Bild hochladen</p>
                <p className="text-sm text-gray-400 mt-1">Tippen um ein Foto auszuwählen</p>
                {arStr !== 'free' && (
                  <p className="text-xs font-medium mt-2 px-3 py-1 rounded-full inline-block" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                    Format: {arStr}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {uploadError && <p className="text-sm text-red-500 font-medium">{uploadError}</p>}
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
      return <ImageField field={field} value={value} onChange={onChange} />

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
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingSite, setDeletingSite] = useState(false)
  const [showFullPreview, setShowFullPreview] = useState(false)

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

  const updatePreview = useCallback((_vals: Record<string, string>) => {
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
    setSuccess('Seite offline genommen.')
  }

  async function handleDeleteSite() {
    setDeletingSite(true)
    const res = await fetch(`/api/sites/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/sites')
    } else {
      setDeletingSite(false)
      setShowDeleteModal(false)
      setError('Fehler beim Löschen der Website.')
    }
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

  function getSectionCompletion(sec: string) {
    const secFields = fields.filter(f => (f.section || 'Allgemein') === sec)
    const filled = secFields.filter(f => f.required ? !!values[f.key] : true).length
    return { filled, total: secFields.length, complete: secFields.filter(f => f.required).every(f => !!values[f.key]) }
  }

  const currentSectionIdx = activeSection ? sections.indexOf(activeSection) : 0
  const isLastSection = currentSectionIdx === sections.length - 1
  const isFirstSection = currentSectionIdx === 0

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 64px)', background: '#F8FAFC' }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 bg-white border-b" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={() => router.push('/sites')} className="w-9 h-9 flex items-center justify-center rounded-[12px] flex-shrink-0" style={{ background: '#F3F4F6' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-gray-900 leading-tight truncate">{site.templates?.title}</h1>
            <p className="text-xs font-mono truncate" style={{ color: '#9CA3AF' }}>{site.username}.{site.templates?.domain}</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0"
            style={{ background: site.status === 'published' ? '#DCFCE7' : '#F3F4F6', color: site.status === 'published' ? '#16A34A' : '#6B7280' }}>
            {site.status === 'published' ? '● Live' : '○ Entwurf'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {success && <span className="hidden sm:flex text-xs text-green-700 font-medium px-2.5 py-1 rounded-[8px]" style={{ background: '#F0FDF4' }}>✓ {success}</span>}
          <button onClick={() => { setShowFullPreview(true); setPreviewKey(k => k + 1) }}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-[12px] transition-all"
            style={{ background: '#EFF6FF', color: '#2563EB' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Vorschau
          </button>
          {site.status !== 'published' ? (
            <button onClick={handlePublish} disabled={publishing}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-[12px] text-white"
              style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.2)', opacity: publishing ? 0.7 : 1 }}>
              {publishing ? <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : null}
              {publishing ? 'Bitte warten…' : 'Veröffentlichen'}
            </button>
          ) : (
            <button onClick={handleUnpublish}
              className="text-xs font-medium px-3 py-2 rounded-[12px]"
              style={{ background: '#FEF9C3', color: '#92400E' }}>
              Offline nehmen
            </button>
          )}
          <button onClick={() => setShowDeleteModal(true)}
            className="w-9 h-9 flex items-center justify-center rounded-[12px] flex-shrink-0"
            style={{ background: '#FEF2F2', color: '#DC2626' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>

      {/* ── Banner messages ── */}
      {error && (
        <div className="mx-4 mt-3 px-4 py-3 rounded-[14px] text-sm text-red-600" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>{error}</div>
      )}
      {publishedUrl && (
        <div className="mx-4 mt-3 px-4 py-3 rounded-[14px] text-sm flex items-center justify-between gap-3" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <span className="font-medium text-green-800">✓ Deine Website ist live!</span>
          <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-green-700 hover:underline truncate">{publishedUrl}</a>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-6 pb-16">

          {/* Section navigation pills */}
          {sections.length > 1 && (
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
              {sections.map((sec, idx) => {
                const isActive = activeSection === sec
                const isDone = getSectionCompletion(sec).complete && !isActive
                return (
                  <button key={sec} onClick={() => setActiveSection(sec)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-[14px] transition-all whitespace-nowrap flex-shrink-0 text-sm font-semibold"
                    style={{
                      background: isActive ? '#1a1a1a' : isDone ? '#F0FDF4' : 'white',
                      color: isActive ? 'white' : isDone ? '#16A34A' : '#6B7280',
                      border: isActive ? 'none' : isDone ? '1.5px solid #BBF7D0' : '1.5px solid #E5E7EB',
                      boxShadow: isActive ? '0 4px 14px rgba(26,26,26,0.15)' : 'none',
                    }}>
                    {isDone && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>}
                    {!isDone && <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: isActive ? 'rgba(255,255,255,0.2)' : '#F3F4F6', color: isActive ? 'white' : '#9CA3AF' }}>{idx + 1}</span>}
                    {sec}
                  </button>
                )
              })}
            </div>
          )}

          {/* Section heading */}
          {sections.length > 1 && activeSection && (
            <div className="mb-5">
              <p className="text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>Schritt {currentSectionIdx + 1} von {sections.length}</p>
              <h2 className="text-2xl font-bold text-gray-900">{activeSection}</h2>
            </div>
          )}

          {/* Fields */}
          <div className="flex flex-col gap-4">
            {fields.length === 0 && (
              <div className="text-center py-16 text-sm text-gray-400 bg-white rounded-[20px]">Dieses Template hat keine Felder.</div>
            )}
            {fields
              .filter(f => !activeSection || (f.section || 'Allgemein') === activeSection || sections.length === 1)
              .sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0))
              .map(field => (
                <div key={field.key} className="bg-white rounded-[20px] p-5"
                  style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #F0F0F0' }}>
                  <div className="mb-3">
                    <label className="text-base font-bold text-gray-900">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.placeholder_text && (
                      <p className="text-sm text-gray-400 mt-0.5">{field.placeholder_text}</p>
                    )}
                  </div>
                  <FieldRenderer field={field} value={values[field.key] ?? ''} onChange={v => handleChange(field.key, v)} />
                </div>
              ))}
          </div>

          {/* Navigation buttons */}
          {sections.length > 1 && (
            <div className="flex items-center justify-between mt-8">
              {!isFirstSection ? (
                <button onClick={() => { setActiveSection(sections[currentSectionIdx - 1]); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-[16px]"
                  style={{ background: 'white', color: '#374151', border: '1.5px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                  Zurück
                </button>
              ) : <div />}
              {!isLastSection ? (
                <button onClick={async () => {
                  await handleSave()
                  setActiveSection(sections[currentSectionIdx + 1])
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                  className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-[16px]"
                  style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.2)' }}>
                  Weiter
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              ) : (
                <button onClick={handlePublish} disabled={publishing || site.status === 'published'}
                  className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-[16px]"
                  style={{ background: site.status === 'published' ? '#16A34A' : '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.2)', opacity: publishing ? 0.7 : 1 }}>
                  {site.status === 'published' ? '● Bereits live' : (publishing ? 'Bitte warten…' : '🚀 Jetzt veröffentlichen')}
                </button>
              )}
            </div>
          )}

          {/* Save button when only one section */}
          {sections.length <= 1 && (
            <div className="flex items-center gap-3 mt-8">
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-3 text-sm font-semibold rounded-[16px]"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ── Fullscreen Preview ── */}
      {showFullPreview && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.9)' }}>
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: '#1a1a1a' }}>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-white">{site.templates?.title}</span>
              <div className="flex items-center gap-1 p-0.5 rounded-[10px]" style={{ background: 'rgba(255,255,255,0.1)' }}>
                {([
                  { key: 'desktop' as const, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
                  { key: 'tablet' as const, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg> },
                  { key: 'mobile' as const, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg> },
                ]).map(d => (
                  <button key={d.key} onClick={() => setDeviceView(d.key)}
                    className="p-1.5 rounded-[8px] transition-all"
                    style={{ background: deviceView === d.key ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'white' }}>
                    {d.icon}
                  </button>
                ))}
              </div>
              <button onClick={() => setPreviewKey(k => k + 1)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-[8px]"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                Neu laden
              </button>
            </div>
            <button onClick={() => setShowFullPreview(false)}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-[12px] font-medium"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              Schließen
            </button>
          </div>
          <div className="flex-1 overflow-auto flex justify-center items-start p-4">
            {site.templates?.r2_bundle_path ? (
              <div className="bg-white rounded-[12px] overflow-hidden transition-all duration-300"
                style={{
                  width: deviceView === 'desktop' ? '100%' : deviceView === 'tablet' ? '768px' : '390px',
                  maxWidth: '100%',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
                }}>
                <iframe ref={iframeRef} key={previewKey} src={previewUrl}
                  className="w-full border-0 block" style={{ height: '800px' }}
                  title="Website-Vorschau" sandbox="allow-scripts allow-same-origin"
                  onLoad={() => {
                    try {
                      const iframe = iframeRef.current
                      if (iframe?.contentDocument?.documentElement) {
                        const h = iframe.contentDocument.documentElement.scrollHeight
                        if (h > 100) iframe.style.height = h + 'px'
                      }
                    } catch { /* cross-origin */ }
                  }} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-white text-center py-20">
                <p className="text-lg font-semibold">Noch keine Vorschau verfügbar</p>
                <p className="text-sm opacity-60">Der Admin muss zuerst eine HTML-Datei hochladen.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-[24px] p-6 flex flex-col gap-4 w-full max-w-sm" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0" style={{ background: '#FEF2F2' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900">Website löschen?</h2>
            </div>
            <p className="text-sm" style={{ color: '#6B7280' }}>Alle eingegebenen Inhalte gehen dauerhaft verloren.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-sm font-medium rounded-[12px]" style={{ background: '#F3F4F6', color: '#374151' }}>Abbrechen</button>
              <button onClick={handleDeleteSite} disabled={deletingSite}
                className="px-4 py-2 text-sm font-semibold text-white rounded-[12px] flex items-center gap-2"
                style={{ background: '#DC2626', opacity: deletingSite ? 0.7 : 1 }}>
                {deletingSite && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
