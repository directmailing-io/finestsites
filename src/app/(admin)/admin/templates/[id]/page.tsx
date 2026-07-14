'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { zipSync } from 'fflate'
import { NM_COMPANIES } from '@/lib/constants/nm-companies'
import { PlaceholderSchemaEditor, PlaceholderField } from '@/components/admin/PlaceholderSchemaEditor'
import FormSchemaEditor from '@/components/admin/FormSchemaEditor'
import TemplateAccessPanel from '@/components/admin/TemplateAccessPanel'
import ImageCropModal from '@/components/ImageCropModal'

type Tab = 'info' | 'preview-settings' | 'placeholders' | 'forms' | 'access' | 'detail'

interface DomainSetup {
  status: string
  ssl_status?: string
  configured?: boolean
  fallback_host?: string
  nameservers?: string[]
  zone_id?: string
  ownership_verification?: { type: string; name: string; value: string }
  ssl_records?: Array<{ type: string; name: string; value: string }>
}

interface DetailSection {
  id: string
  heading: string
  text: string
  imageUrl: string
  imagePosition: 'left' | 'right'
}

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fields, setFields] = useState<PlaceholderField[]>([])
  const [bundlePath, setBundlePath] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [form, setForm] = useState({ title: '', description: '', domain: '', status: 'draft' })
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [domainSetup, setDomainSetup] = useState<DomainSetup | null>(null)
  const [settingUpDomain, setSettingUpDomain] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({})
  const [previewSaving, setPreviewSaving] = useState(false)
  const [previewSuccess, setPreviewSuccess] = useState('')
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge')
  const [isTest, setIsTest] = useState(false)
  const [isFree, setIsFree] = useState(false)
  const [badge, setBadge] = useState<string>('')
  const [slug, setSlug] = useState<string>('')
  const [detailColor, setDetailColor] = useState<string>('#8060b0')
  const [detailSections, setDetailSections] = useState<DetailSection[]>([])
  const [sectionUploading, setSectionUploading] = useState<string | null>(null)
  const [nmCompanies, setNmCompanies] = useState<string[]>([])
  const [isAllrounder, setIsAllrounder] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/templates/${id}`)
      .then(r => r.json())
      .then(data => {
        setForm({
          title: data.title ?? '',
          description: data.description ?? '',
          domain: data.domain ?? '',
          status: data.status ?? 'draft',
        })
        const schema = data.placeholderSchema ?? data.placeholder_schema
        setFields(schema?.fields ?? [])
        setPreviewValues(schema?.preview_values ?? {})
        setBundlePath(data.r2BundlePath ?? data.r2_bundle_path ?? null)
        setTags(data.tags ?? [])
        setCoverImage((data.previewImages ?? data.preview_images)?.[0] ?? null)
        setIsTest(data.isTest ?? data.is_test ?? false)
        setIsFree(data.isFree ?? data.is_free ?? false)
        setBadge(data.badge ?? '')
        setSlug(data.slug ?? '')
        setDetailColor(data.detailColor ?? data.detail_color ?? '#8060b0')
        setDetailSections(Array.isArray(data.detailContent ?? data.detail_content) ? (data.detailContent ?? data.detail_content) : [])
        setNmCompanies(Array.isArray(data.nmCompanies ?? data.nm_companies) ? (data.nmCompanies ?? data.nm_companies) : [])
        setIsAllrounder(data.isAllrounder ?? data.is_allrounder ?? false)
        setLoading(false)
      })
  }, [id])

  async function loadDomainSetup() {
    const res = await fetch(`/api/admin/templates/${id}/domain-setup`)
    if (!res.ok) return
    const data = await res.json()
    setDomainSetup(data)
    // Auto-activate: if zone is found in CF but route not yet created → trigger automatically
    if (data.status === 'none' && data.zone_name) {
      triggerSetup()
    }
  }

  async function triggerSetup() {
    setSettingUpDomain(true)
    const res = await fetch(`/api/admin/templates/${id}/domain-setup`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) setDomainSetup(data)
    else setError(data.error ?? 'Fehler beim Domain-Setup.')
    setSettingUpDomain(false)
  }

  useEffect(() => {
    loadDomainSetup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Poll until active: every 15s while waiting for NS propagation, every 10s for zone_missing
  useEffect(() => {
    if (!domainSetup || domainSetup.status === 'active') return
    const interval = domainSetup.status === 'pending_ns' ? 15000
      : domainSetup.status === 'zone_missing' ? 10000
      : 30000
    const t = setInterval(loadDomainSetup, interval)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainSetup?.status])

  async function setupDomain() {
    setSettingUpDomain(true)
    setError('')
    const res = await fetch(`/api/admin/templates/${id}/domain-setup`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Fehler beim Domain-Setup.'); setSettingUpDomain(false); return }
    setDomainSetup(data)
    setSettingUpDomain(false)
  }

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadState('uploading')
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/admin/templates/${id}/upload`, { method: 'POST', body: fd })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Upload fehlgeschlagen.')
      setUploadState('error')
      return
    }
    const { key } = await res.json()
    setBundlePath(key)
    setUploadState('done')
    setSuccess('Datei erfolgreich hochgeladen!')
    setTimeout(() => setSuccess(''), 3000)
  }

  async function handleFolderUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    // Reset so same folder can be re-selected
    e.target.value = ''
    setUploadState('uploading')
    setError('')

    const entries: Record<string, Uint8Array> = {}
    for (const file of Array.from(files)) {
      const raw = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
      // Strip top-level directory prefix (e.g. "my-site/index.html" → "index.html")
      const parts = raw.split('/')
      const normalized = parts.length > 1 ? parts.slice(1).join('/') : raw
      if (!normalized) continue
      entries[normalized] = new Uint8Array(await file.arrayBuffer())
    }

    let zipped: Uint8Array
    try {
      zipped = zipSync(entries)
    } catch {
      setError('Fehler beim Erstellen des ZIP-Archivs.')
      setUploadState('error')
      return
    }

    const zipFile = new File([zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer], 'upload.zip', { type: 'application/zip' })
    const fd = new FormData()
    fd.append('file', zipFile)
    const res = await fetch(`/api/admin/templates/${id}/upload`, { method: 'POST', body: fd })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Upload fehlgeschlagen.')
      setUploadState('error')
      return
    }
    const { key } = await res.json()
    setBundlePath(key)
    setUploadState('done')
    setSuccess('Ordner erfolgreich hochgeladen!')
    setTimeout(() => setSuccess(''), 3000)
  }

  async function handleDownload() {
    const res = await fetch(`/api/admin/templates/${id}/download`)
    if (!res.ok) { setError('Download fehlgeschlagen.'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${form.title || id}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportError('')
    setImportSuccess('')

    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      setImportError('Ungültige JSON-Datei.')
      return
    }

    // Validate top-level shape
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as any).fields)) {
      setImportError('Ungültiges Format. Die Datei muss ein Objekt mit einem "fields"-Array sein.')
      return
    }

    const rawFields: unknown[] = (parsed as any).fields
    const VALID_TYPES = ['text', 'textarea', 'image', 'url', 'email', 'dropdown', 'card_select', 'loop'] as const
    type FType = typeof VALID_TYPES[number]

    const imported: PlaceholderField[] = []
    for (let i = 0; i < rawFields.length; i++) {
      const f = rawFields[i] as any
      if (!f || typeof f !== 'object') { setImportError(`Feld ${i + 1}: muss ein Objekt sein.`); return }
      if (!f.key || typeof f.key !== 'string') { setImportError(`Feld ${i + 1}: "key" fehlt oder ist kein String.`); return }
      if (!f.label || typeof f.label !== 'string') { setImportError(`Feld ${i + 1} ("${f.key}"): "label" fehlt oder ist kein String.`); return }
      if (!VALID_TYPES.includes(f.type)) { setImportError(`Feld "${f.key}": ungültiger type "${f.type}". Erlaubt: ${VALID_TYPES.join(', ')}`); return }

      imported.push({
        key: f.key.trim(),
        label: f.label.trim(),
        type: f.type as FType,
        required: Boolean(f.required ?? false),
        default_value: typeof f.default_value === 'string' ? f.default_value : '',
        placeholder_text: typeof f.placeholder_text === 'string' ? f.placeholder_text : '',
        max_length: typeof f.max_length === 'number' ? f.max_length : null,
        section: typeof f.section === 'string' ? f.section : '',
        order: typeof f.order === 'number' ? f.order : i,
        aspect_ratio: typeof f.aspect_ratio === 'string' ? f.aspect_ratio : 'free',
        options: Array.isArray(f.options) ? f.options.filter((o: unknown) => typeof o === 'string') : [],
        card_options: Array.isArray(f.card_options)
          ? f.card_options.filter((o: unknown) => o && typeof o === 'object').map((o: any) => ({
              value: String(o.value ?? ''),
              label: String(o.label ?? ''),
              description: String(o.description ?? ''),
              card_type: ['text', 'image', 'color'].includes(o.card_type) ? o.card_type : 'text',
              image_url: String(o.image_url ?? ''),
              color: String(o.color ?? '#6366F1'),
            }))
          : [],
        // loop-specific fields
        sub_fields: Array.isArray(f.sub_fields)
          ? f.sub_fields.filter((sf: unknown) => sf && typeof sf === 'object').map((sf: any) => ({
              key: String(sf.key ?? ''),
              label: String(sf.label ?? ''),
              type: ['text', 'textarea', 'image', 'url', 'email', 'dropdown'].includes(sf.type) ? sf.type : 'text',
              required: Boolean(sf.required ?? false),
              placeholder_text: typeof sf.placeholder_text === 'string' ? sf.placeholder_text : '',
              max_length: typeof sf.max_length === 'number' ? sf.max_length : null,
              default_value: typeof sf.default_value === 'string' ? sf.default_value : '',
              aspect_ratio: typeof sf.aspect_ratio === 'string' ? sf.aspect_ratio : 'free',
              options: Array.isArray(sf.options) ? sf.options.filter((o: unknown) => typeof o === 'string') : [],
            }))
          : [],
        min_items: typeof f.min_items === 'number' ? f.min_items : 1,
        max_items: typeof f.max_items === 'number' ? f.max_items : null,
      })
    }

    if (importMode === 'replace') {
      setFields(imported)
    } else {
      // merge: keep existing, add/overwrite by key
      setFields(prev => {
        const map = new Map(prev.map(f => [f.key, f]))
        for (const f of imported) map.set(f.key, f)
        return Array.from(map.values())
      })
    }

    setImportSuccess(`${imported.length} Felder erfolgreich importiert (${importMode === 'replace' ? 'ersetzt' : 'zusammengeführt'}).`)
    setTimeout(() => setImportSuccess(''), 4000)
  }

  async function handleSave(statusOverride?: string) {
    const invalidField = fields.find(f => !f.key || !f.label)
    if (invalidField) { setError('Alle Felder müssen einen Key und eine Bezeichnung haben.'); return }

    if (statusOverride === 'published' && !bundlePath) {
      setError('Bitte lade zuerst eine HTML-Datei hoch, bevor du das Template veröffentlichst.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    const res = await fetch(`/api/admin/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        status: statusOverride ?? form.status,
        placeholder_schema: { version: 1, fields, preview_values: previewValues },
        tags,
        is_test: isTest,
        is_free: isFree,
        badge: badge || null,
        slug: slug || null,
        detail_color: detailColor || null,
        detail_content: detailSections,
        nm_companies: isAllrounder ? [] : nmCompanies,
        is_allrounder: isAllrounder,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Fehler beim Speichern.')
    } else {
      const updated = await res.json()
      setForm(prev => ({ ...prev, status: updated.status }))
      setSuccess(statusOverride === 'published' ? 'Template veröffentlicht!' : 'Änderungen gespeichert.')
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Template wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) return
    await fetch(`/api/admin/templates/${id}`, { method: 'DELETE' })
    router.push('/admin/templates')
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so same file can be selected again
    e.target.value = ''
    // Open crop modal
    const url = URL.createObjectURL(file)
    setCropSrc(url)
  }

  async function handleCropConfirm(blob: Blob) {
    setCropSrc(null)
    setCoverUploading(true)
    setError('')
    const fd = new FormData()
    fd.append('file', new File([blob], 'cover.jpg', { type: 'image/jpeg' }))
    const res = await fetch(`/api/admin/templates/${id}/cover`, { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Bild-Upload fehlgeschlagen.')
    } else {
      setCoverImage(data.url)
    }
    setCoverUploading(false)
  }

  async function handleCoverDelete() {
    setCoverUploading(true)
    await fetch(`/api/admin/templates/${id}/cover`, { method: 'DELETE' })
    setCoverImage(null)
    setCoverUploading(false)
  }

  async function handleSavePreview() {
    setPreviewSaving(true)
    const res = await fetch(`/api/admin/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeholder_schema: { version: 1, fields, preview_values: previewValues },
      }),
    })
    setPreviewSaving(false)
    if (res.ok) {
      setPreviewSuccess('Vorschau-Daten gespeichert.')
      setPreviewRefreshKey(k => k + 1)
      setTimeout(() => setPreviewSuccess(''), 3000)
    }
  }

  const inputStyle = {
    background: '#FFFFFF', border: '1.5px solid #E5E7EB',
    borderRadius: '16px', padding: '10px 14px',
    fontSize: '14px', outline: 'none', width: '100%',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
      </div>
    )
  }

  return (
    <>
    {cropSrc && (
      <ImageCropModal
        imageUrl={cropSrc}
        aspectRatio={1.6}
        outputWidth={1600}
        onConfirm={blob => { URL.revokeObjectURL(cropSrc); handleCropConfirm(blob) }}
        onCancel={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null) }}
      />
    )}
    <div className="max-w-[1200px]">
      <div className="mb-6">
        <button onClick={() => router.push('/admin/templates')}
          className="flex items-center gap-2 text-sm mb-4"
          style={{ color: 'var(--muted-foreground)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Alle Templates
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{form.title || 'Template bearbeiten'}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full mt-1 inline-block"
              style={{
                background: form.status === 'published' ? '#F0FDF4' : '#F3F4F6',
                color: form.status === 'published' ? '#16A34A' : '#6B7280',
              }}>
              {form.status === 'published' ? '● Veröffentlicht' : '○ Entwurf'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPreview(true)}
              className="text-xs px-3 py-2 rounded-[12px] transition-all flex items-center gap-1.5"
              style={{ background: '#EFF6FF', color: '#2563EB' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Vorschau
            </button>
            <button onClick={handleDelete}
              className="text-xs px-3 py-2 rounded-[12px] transition-all"
              style={{ background: '#FEF2F2', color: '#DC2626' }}>
              Löschen
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-[16px] mb-6"
        style={{ background: '#F3F4F6' }}>
        {([
          { key: 'info', label: 'Informationen' },
          { key: 'detail', label: 'Detail-Seite' },
          { key: 'placeholders', label: 'Platzhalter' },
          { key: 'forms', label: 'Formulare' },
          { key: 'access', label: isTest ? '🔒 Zugang' : 'Zugang' },
          { key: 'preview-settings', label: 'Vorschau' },
        ] as { key: Tab; label: string }[]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="flex-1 py-2 text-sm font-medium rounded-[12px] transition-all"
            style={{
              background: activeTab === tab.key ? 'white' : 'transparent',
              color: activeTab === tab.key ? '#1a1a1a' : '#6B7280',
              boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Preview Settings Tab */}
      {activeTab === 'preview-settings' && (
        <div className="flex flex-col gap-6">
          <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
            <div>
              <h2 className="font-medium text-gray-900">Vorschau-Daten</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                Diese Daten werden in der Vorschau für Nutzer angezeigt. Fülle alle Felder so aus, wie sie in der Live-Version aussehen sollen.
              </p>
            </div>

            {fields.length === 0 ? (
              <div className="px-4 py-8 rounded-[14px] text-center text-sm"
                style={{ background: '#F9FAFB', color: '#6B7280' }}>
                Keine Platzhalter-Felder definiert. Gehe zu &quot;Einstellungen&quot; und füge Felder hinzu.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {fields.map(field => (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      {field.label || field.key}
                      <span className="ml-2 text-xs font-normal font-mono px-1.5 py-0.5 rounded"
                        style={{ background: '#F1F5F9', color: '#64748B' }}>
                        {field.type === 'loop' ? `{{#each ${field.key}}}` : `{{${field.key}}}`}
                      </span>
                      {field.type === 'loop' && (
                        <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#E0F2FE', color: '#0369A1' }}>Loop</span>
                      )}
                    </label>
                    {field.type === 'loop' ? (
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          value={previewValues[field.key] ?? ''}
                          onChange={e => setPreviewValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                          rows={4}
                          placeholder={`JSON-Array, z.B.:\n[{"${(field.sub_fields ?? [])[0]?.key || 'name'}": "Max"}, {"${(field.sub_fields ?? [])[0]?.key || 'name'}": "Anna"}]`}
                          style={{ background: '#F8FAFC', border: '1.5px solid #E5E7EB', borderRadius: '14px', padding: '10px 14px', fontSize: '12px', fontFamily: 'monospace', outline: 'none', width: '100%', resize: 'vertical' }}
                          onFocus={e => (e.target.style.borderColor = '#0369A1')}
                          onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                        />
                        {(field.sub_fields ?? []).length > 0 && (
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>
                            Unterfelder: {field.sub_fields!.map(sf => `"${sf.key}"`).join(', ')}
                          </p>
                        )}
                      </div>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={previewValues[field.key] ?? ''}
                        onChange={e => setPreviewValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        rows={3}
                        placeholder={field.default_value ?? field.placeholder_text ?? `Vorschau-Wert für ${field.label || field.key}`}
                        style={{ background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '14px', padding: '10px 14px', fontSize: '14px', outline: 'none', width: '100%', resize: 'vertical' }}
                        onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                        onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                      />
                    ) : field.type === 'dropdown' ? (
                      <select
                        value={previewValues[field.key] ?? ''}
                        onChange={e => setPreviewValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        style={{ background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '14px', padding: '10px 14px', fontSize: '14px', outline: 'none', width: '100%' }}>
                        <option value="">Bitte wählen</option>
                        {(field.options ?? []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'image' ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={previewValues[field.key] ?? ''}
                            onChange={e => setPreviewValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                            placeholder="https://… oder Bild hochladen →"
                            style={{ background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '14px', padding: '10px 14px', fontSize: '14px', outline: 'none', flex: 1 }}
                            onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                            onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                          />
                          <label className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white rounded-[14px] cursor-pointer flex-shrink-0"
                            style={{ background: '#1a1a1a' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                            Hochladen
                            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                              onChange={async e => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                e.target.value = ''
                                const fd = new FormData()
                                fd.append('file', file)
                                const res = await fetch(`/api/admin/templates/${id}/cover`, { method: 'POST', body: fd })
                                if (res.ok) {
                                  const data = await res.json()
                                  setPreviewValues(prev => ({ ...prev, [field.key]: data.url }))
                                }
                              }}
                            />
                          </label>
                        </div>
                        {previewValues[field.key] && (
                          <div className="rounded-[12px] overflow-hidden" style={{ aspectRatio: field.aspect_ratio ?? '16/9', maxWidth: 320, border: '1px solid #E5E7EB' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={previewValues[field.key]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        type={field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text'}
                        value={previewValues[field.key] ?? ''}
                        onChange={e => setPreviewValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.default_value ?? field.placeholder_text ?? `Vorschau-Wert für ${field.label || field.key}`}
                        style={{ background: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '14px', padding: '10px 14px', fontSize: '14px', outline: 'none', width: '100%' }}
                        onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                        onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {previewSuccess && (
              <p className="text-xs font-medium px-3 py-2 rounded-[10px]"
                style={{ background: '#F0FDF4', color: '#16A34A' }}>
                ✓ {previewSuccess}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button onClick={handleSavePreview} disabled={previewSaving || fields.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-[14px] disabled:opacity-60"
                style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.2)' }}>
                {previewSaving && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                Vorschau-Daten speichern
              </button>
              {bundlePath && (
                <button onClick={() => { handleSavePreview().then(() => setShowPreview(true)) }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-[14px]"
                  style={{ background: '#EFF6FF', color: '#2563EB' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Speichern & Vorschau
                </button>
              )}
            </div>
          </div>

          {/* Live preview embedded */}
          {bundlePath && (
            <div className="rounded-[24px] overflow-hidden"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ background: '#1a1a1a' }}>
                <span className="text-xs font-medium text-white">Live-Vorschau</span>
                <button onClick={() => setPreviewRefreshKey(k => k + 1)}
                  className="text-xs px-3 py-1 rounded-[8px] flex items-center gap-1.5"
                  style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
                  </svg>
                  Aktualisieren
                </button>
              </div>
              <iframe
                key={previewRefreshKey}
                src={`/api/admin/templates/${id}/preview`}
                className="w-full border-0"
                style={{ height: '600px', background: 'white' }}
                title="Vorschau"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          )}
        </div>
      )}

      {/* Placeholders Tab */}
      {activeTab === 'placeholders' && (
        <div className="flex flex-col gap-6">

          {/* Import card */}
          <div className="p-5 rounded-[20px] bg-white flex flex-col gap-4"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-medium text-gray-900">JSON-Import</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  Importiere Platzhalter-Felder aus einer JSON-Datei.{' '}
                  <a href="/examples/placeholders-test.json" download
                    className="underline" style={{ color: '#2563EB' }}>
                    Test-Datei herunterladen
                  </a>
                  {' · '}
                  <a href="/examples/placeholders-schema.json" download
                    className="underline" style={{ color: '#6B7280' }}>
                    Schema ansehen
                  </a>
                </p>
              </div>
              {/* Mode toggle */}
              <div className="flex items-center gap-1 p-1 rounded-[10px] flex-shrink-0"
                style={{ background: '#F3F4F6' }}>
                {(['merge', 'replace'] as const).map(m => (
                  <button key={m} onClick={() => setImportMode(m)}
                    className="text-xs px-3 py-1 rounded-[8px] font-medium transition-all"
                    style={{
                      background: importMode === m ? 'white' : 'transparent',
                      color: importMode === m ? '#1a1a1a' : '#6B7280',
                      boxShadow: importMode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}>
                    {m === 'merge' ? 'Zusammenführen' : 'Ersetzen'}
                  </button>
                ))}
              </div>
            </div>

            {importError && (
              <div className="px-4 py-3 text-xs text-red-700 rounded-[12px]"
                style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                ✗ {importError}
              </div>
            )}
            {importSuccess && (
              <div className="px-4 py-3 text-xs text-green-700 rounded-[12px]"
                style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                ✓ {importSuccess}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button onClick={() => importInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-[14px]"
                style={{ background: '#1a1a1a', color: 'white', boxShadow: '0 4px 14px rgba(26,26,26,0.2)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
                JSON hochladen
              </button>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>
                {importMode === 'merge'
                  ? 'Vorhandene Felder bleiben erhalten. Gleiche Keys werden überschrieben.'
                  : 'Alle vorhandenen Felder werden durch den Import ersetzt.'}
              </p>
            </div>
            <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportJson} />
          </div>

          {/* Editor card */}
          <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
            <div>
              <h2 className="font-medium text-gray-900">Platzhalter-Felder</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                Felder die der Nutzer ausfüllt. Eingebettet als <code className="bg-gray-100 px-1 rounded font-mono text-[11px]">{'{{key}}'}</code>
              </p>
            </div>
            <PlaceholderSchemaEditor fields={fields} onChange={setFields} templateId={id} />
            <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: '#F1F5F9' }}>
              <button type="button" onClick={() => handleSave()} disabled={saving}
                className="px-5 py-2.5 text-sm font-medium rounded-[16px]"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail-Seite Tab */}
      {activeTab === 'detail' && (
        <div className="flex flex-col gap-6">
          <div className="p-6 rounded-[24px] bg-white flex flex-col gap-2"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
            <h2 className="font-medium text-gray-900">Detail-Seite Abschnitte</h2>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Wechselnde Bild/Text-Abschnitte für die öffentliche Template-Detailseite (<code className="bg-gray-100 px-1 rounded text-[11px]">/vorlagen/{id}</code>).
              Abschnitte wechseln automatisch die Bildseite (links/rechts).
            </p>
          </div>

          {/* Sections list */}
          <div className="flex flex-col gap-4">
            {detailSections.map((section, i) => (
              <div key={section.id} className="p-5 rounded-[20px] bg-white flex flex-col gap-4"
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
                {/* Section header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: '#F3F4F6', color: '#6B7280' }}>
                    Abschnitt {i + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    {/* Move up */}
                    <button type="button" disabled={i === 0}
                      onClick={() => {
                        const arr = [...detailSections]
                        ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
                        setDetailSections(arr)
                      }}
                      className="p-1.5 rounded-[8px] text-gray-400 disabled:opacity-30"
                      style={{ background: '#F9FAFB' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                    </button>
                    {/* Move down */}
                    <button type="button" disabled={i === detailSections.length - 1}
                      onClick={() => {
                        const arr = [...detailSections]
                        ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
                        setDetailSections(arr)
                      }}
                      className="p-1.5 rounded-[8px] text-gray-400 disabled:opacity-30"
                      style={{ background: '#F9FAFB' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                    </button>
                    {/* Remove */}
                    <button type="button"
                      onClick={() => setDetailSections(detailSections.filter((_, j) => j !== i))}
                      className="p-1.5 rounded-[8px] text-red-400 ml-1"
                      style={{ background: '#FEF2F2' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>

                {/* Heading */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Überschrift</label>
                  <input
                    type="text"
                    value={section.heading}
                    onChange={e => {
                      const arr = [...detailSections]
                      arr[i] = { ...arr[i], heading: e.target.value }
                      setDetailSections(arr)
                    }}
                    placeholder="z. B. Alles bereits fertig geschrieben"
                    style={{ background: '#FAFAFA', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '9px 12px', fontSize: 14, outline: 'none', width: '100%' }}
                    onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                    onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                  />
                </div>

                {/* Text */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Text</label>
                  <textarea
                    value={section.text}
                    onChange={e => {
                      const arr = [...detailSections]
                      arr[i] = { ...arr[i], text: e.target.value }
                      setDetailSections(arr)
                    }}
                    rows={3}
                    placeholder="Beschreibung dieses Abschnitts…"
                    style={{ background: '#FAFAFA', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '9px 12px', fontSize: 14, outline: 'none', width: '100%', resize: 'vertical' }}
                    onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                    onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                  />
                </div>

                {/* Image URL + upload */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Bild</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={section.imageUrl}
                      onChange={e => {
                        const arr = [...detailSections]
                        arr[i] = { ...arr[i], imageUrl: e.target.value }
                        setDetailSections(arr)
                      }}
                      placeholder="https://… oder Bild hochladen →"
                      style={{ background: '#FAFAFA', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '9px 12px', fontSize: 13, outline: 'none', flex: 1 }}
                      onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                    />
                    <label className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[10px] cursor-pointer flex-shrink-0"
                      style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }}>
                      {sectionUploading === section.id ? (
                        <div className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                      )}
                      Hochladen
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          e.target.value = ''
                          setSectionUploading(section.id)
                          const fd = new FormData()
                          fd.append('file', file)
                          const res = await fetch(`/api/admin/templates/${id}/cover`, { method: 'POST', body: fd })
                          setSectionUploading(null)
                          if (res.ok) {
                            const data = await res.json()
                            const arr = [...detailSections]
                            arr[i] = { ...arr[i], imageUrl: data.url }
                            setDetailSections(arr)
                          }
                        }}
                      />
                    </label>
                  </div>
                  {section.imageUrl && (
                    <div className="mt-2 rounded-[10px] overflow-hidden" style={{ maxWidth: 200, border: '1px solid #E5E7EB' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={section.imageUrl} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
                    </div>
                  )}
                </div>

                {/* Image position */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Bildseite</label>
                  <div className="flex gap-2">
                    {(['left', 'right'] as const).map(pos => (
                      <button key={pos} type="button"
                        onClick={() => {
                          const arr = [...detailSections]
                          arr[i] = { ...arr[i], imagePosition: pos }
                          setDetailSections(arr)
                        }}
                        className="flex-1 py-2 text-xs font-medium rounded-[10px] transition-all"
                        style={{
                          background: section.imagePosition === pos ? '#1a1a1a' : '#F3F4F6',
                          color: section.imagePosition === pos ? '#fff' : '#6B7280',
                        }}>
                        {pos === 'left' ? '← Bild links' : 'Bild rechts →'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Add section button */}
            <button type="button"
              onClick={() => setDetailSections([...detailSections, {
                id: crypto.randomUUID(),
                heading: '',
                text: '',
                imageUrl: '',
                imagePosition: detailSections.length % 2 === 0 ? 'left' : 'right',
              }])}
              className="flex items-center justify-center gap-2 py-3.5 text-sm font-medium rounded-[16px] w-full transition-all"
              style={{ border: '2px dashed #E5E7EB', color: '#6B7280', background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1a1a1a'; (e.currentTarget as HTMLElement).style.color = '#1a1a1a' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLElement).style.color = '#6B7280' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Abschnitt hinzufügen
            </button>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 pb-4">
            <button type="button" onClick={() => handleSave()} disabled={saving}
              className="px-5 py-2.5 text-sm font-medium rounded-[16px]"
              style={{ background: '#1a1a1a', color: 'white' }}>
              {saving ? 'Speichert...' : 'Abschnitte speichern'}
            </button>
            {success && <span className="text-sm text-green-600">✓ {success}</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>
      )}

      {/* Forms Tab */}
      {activeTab === 'forms' && (
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-medium text-gray-900">Formulare</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Definiere Formulare, die Website-Besucher ausfüllen können. Eingaben werden im Dashboard unter &quot;Anfragen&quot; angezeigt.
            </p>
          </div>
          <FormSchemaEditor templateId={id} />
        </div>
      )}

      {/* Access Tab */}
      {activeTab === 'access' && (
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-5"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-medium text-gray-900">Zugangssteuerung</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Im Test-Modus siehst nur du und freigeschaltete Nutzer dieses Template in der Bibliothek.
            </p>
          </div>
          {!isTest && (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-[14px]"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
              </svg>
              <p className="text-xs text-green-700">
                Test-Modus ist deaktiviert. Dieses Template ist für alle Nutzer sichtbar. Aktiviere den Test-Modus im Tab &quot;Webseite Informationen&quot; um den Zugang zu steuern.
              </p>
            </div>
          )}
          <TemplateAccessPanel templateId={id} />
        </div>
      )}

      {activeTab === 'info' && (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-6">
        {error && (
          <div className="px-4 py-3 text-sm text-red-600 rounded-[16px]"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>{error}</div>
        )}
        {success && (
          <div className="px-4 py-3 text-sm text-green-700 rounded-[16px]"
            style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>✓ {success}</div>
        )}

        {/* Basic Info */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <h2 className="font-medium text-gray-900">Grunddaten</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Template-Name</label>
            <input value={form.title} onChange={e => setField('title', e.target.value)} style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Beschreibung</label>
            <textarea value={form.description} onChange={e => setField('description', e.target.value)}
              rows={3} style={{ ...inputStyle, resize: 'vertical' }}
              onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: '#F1F5F9', color: '#374151', border: '1px solid #E2E8F0' }}>
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))}
                    className="ml-0.5 hover:text-red-500 transition-colors">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault()
                    const newTag = tagInput.trim()
                    if (!tags.includes(newTag)) setTags([...tags, newTag])
                    setTagInput('')
                  }
                }}
                placeholder="z. B. PM-International + Enter"
                style={{ ...inputStyle, flex: 1 }}
                onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
              <button type="button" onClick={() => {
                const newTag = tagInput.trim()
                if (newTag && !tags.includes(newTag)) setTags([...tags, newTag])
                setTagInput('')
              }}
                className="px-3 py-2 text-sm font-medium rounded-[14px] flex-shrink-0"
                style={{ background: '#F3F4F6', color: '#374151' }}>
                Hinzufügen
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Template-Domain</label>
            <input value={form.domain} onChange={e => setField('domain', e.target.value.toLowerCase())}
              placeholder="z.B. vitaldarm.de"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            {form.domain && (
              <p className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>
                Nutzer-URLs: <code className="font-mono bg-gray-100 px-1 py-0.5 rounded-md">username.{form.domain}</code>
              </p>
            )}
          </div>
        </div>

        {/* Visibility Settings */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-medium text-gray-900">Sichtbarkeit</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Steuere, wer dieses Template sieht und ob es das Plan-Limit zählt.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {/* Test-Modus Toggle */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-[14px]"
              style={{ background: isTest ? '#FFFBEB' : '#FAFAFA', border: `1px solid ${isTest ? '#FDE68A' : '#F1F5F9'}`, transition: 'all 0.2s' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-900">Test-Modus</span>
                  {isTest && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: '#FEF3C7', color: '#B45309' }}>Aktiv</span>
                  )}
                </div>
                <p className="text-xs" style={{ color: '#94A3B8' }}>
                  Nur freigeschaltete Nutzer sehen dieses Template in der Bibliothek.
                </p>
              </div>
              <button type="button" onClick={() => setIsTest(v => !v)}
                className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
                style={{ background: isTest ? '#F59E0B' : '#E2E8F0' }}
                aria-label="Test-Modus umschalten">
                <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
                  style={{ transform: isTest ? 'translateX(20px)' : 'translateX(0)' }} />
              </button>
            </div>

            {/* Kostenlos Toggle */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-[14px]"
              style={{ background: isFree ? '#F0FDF4' : '#FAFAFA', border: `1px solid ${isFree ? '#BBF7D0' : '#F1F5F9'}`, transition: 'all 0.2s' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-900">Kostenlos</span>
                  {isFree && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: '#DCFCE7', color: '#15803D' }}>Aktiv</span>
                  )}
                </div>
                <p className="text-xs" style={{ color: '#94A3B8' }}>
                  Dieses Template zählt nicht gegen das Plan-Limit. Auch Starter-Nutzer können es beliebig oft aktivieren.
                </p>
              </div>
              <button type="button" onClick={() => setIsFree(v => !v)}
                className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
                style={{ background: isFree ? '#22C55E' : '#E2E8F0' }}
                aria-label="Kostenlos umschalten">
                <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
                  style={{ transform: isFree ? 'translateX(20px)' : 'translateX(0)' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Marketing fields */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <h2 className="font-medium text-gray-900">Marketing</h2>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Badge</label>
              <select value={badge} onChange={e => setBadge(e.target.value)}
                className="text-sm rounded-[10px] border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                <option value="">Kein Badge</option>
                <option value="brandneu">Brandneu</option>
                <option value="beliebt">Sehr beliebt</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Slug (URL)</label>
              <input type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="z. B. fitline-landing-page" className="text-sm rounded-[10px] border px-3 py-2" style={{ borderColor: 'var(--border)' }} />
              <p className="text-xs text-gray-400">Wird als /vorlagen/{slug || 'id'} aufgerufen</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Akzentfarbe (Detail-Seite)</label>
              <div className="flex items-center gap-2">
                <input type="color" value={detailColor} onChange={e => setDetailColor(e.target.value)}
                  style={{ width: 40, height: 36, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
                <input type="text" value={detailColor} onChange={e => setDetailColor(e.target.value)}
                  className="text-sm rounded-[10px] border px-3 py-2 w-32" style={{ borderColor: 'var(--border)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* NM Company Targeting */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-medium text-gray-900">NM Unternehmen</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Für welche Network-Marketing-Unternehmen ist dieses Template gedacht? Oder als Allrounder markieren.
            </p>
          </div>

          {/* Allrounder toggle */}
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-[14px]"
            style={{ background: isAllrounder ? '#EFF6FF' : '#FAFAFA', border: `1px solid ${isAllrounder ? '#BFDBFE' : '#F1F5F9'}`, transition: 'all 0.2s' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-gray-900">Allrounder</span>
                {isAllrounder && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#DBEAFE', color: '#1D4ED8' }}>Aktiv</span>
                )}
              </div>
              <p className="text-xs" style={{ color: '#94A3B8' }}>
                Für alle Unternehmen geeignet. Wird bei jedem Unternehmens-Filter angezeigt.
              </p>
            </div>
            <button type="button" onClick={() => setIsAllrounder(v => !v)}
              className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
              style={{ background: isAllrounder ? '#2563EB' : '#E2E8F0' }}
              aria-label="Allrounder umschalten">
              <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
                style={{ transform: isAllrounder ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
          </div>

          {/* Company checkboxes */}
          {!isAllrounder && (
            <div className="flex flex-wrap gap-2">
              {NM_COMPANIES.map(company => {
                const isActive = nmCompanies.includes(company)
                return (
                  <button
                    key={company}
                    type="button"
                    onClick={() => setNmCompanies(prev =>
                      prev.includes(company) ? prev.filter(c => c !== company) : [...prev, company]
                    )}
                    className="px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all"
                    style={{
                      background: isActive ? '#111827' : '#F3F4F6',
                      color: isActive ? '#fff' : '#374151',
                      border: isActive ? '1.5px solid #111827' : '1.5px solid transparent',
                    }}
                  >
                    {company}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Cover Image */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-medium text-gray-900">Titelbild</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Wird in der Webseiten-Bibliothek und auf der Detail-Seite angezeigt. Empfohlen: 1600×1000px, JPG oder WebP.
            </p>
          </div>

          {coverImage ? (
            <div className="flex flex-col gap-3">
              {/* Clean image preview — natural 16:10 ratio, no browser chrome */}
              <div className="rounded-[16px] overflow-hidden"
                style={{ aspectRatio: '16/10', background: '#F1F5F9', border: '1px solid #E5E7EB', maxWidth: '360px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImage} alt="Titelbild"
                  style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => coverInputRef.current?.click()} disabled={coverUploading}
                  className="text-xs px-3 py-1.5 rounded-[10px] font-medium"
                  style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }}>
                  Ersetzen
                </button>
                <button onClick={handleCoverDelete} disabled={coverUploading}
                  className="text-xs px-3 py-1.5 rounded-[10px] font-medium"
                  style={{ background: '#FEF2F2', color: '#DC2626' }}>
                  Entfernen
                </button>
                {coverUploading && <div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-10 rounded-[16px] text-center cursor-pointer"
              style={{ border: '2px dashed #E5E7EB', background: '#FAFAFA' }}
              onClick={() => coverInputRef.current?.click()}>
              {coverUploading ? (
                <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
              ) : (
                <>
                  <div className="w-12 h-12 rounded-[14px] flex items-center justify-center"
                    style={{ background: '#F3F4F6' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Titelbild hochladen</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>JPG, PNG oder WebP, max. 10 MB</p>
                  </div>
                </>
              )}
            </div>
          )}

          <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={handleCoverUpload} />
        </div>

        {/* HTML File Upload */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-medium text-gray-900">Website-Datei (HTML oder ZIP)</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Lade eine einzelne <strong>.html</strong>-Datei oder ein <strong>.zip</strong>-Archiv mit <code className="bg-gray-100 px-1 rounded font-mono">index.html</code> + Assets hoch. Verwende <code className="bg-gray-100 px-1 rounded font-mono">{'{{schluessel}}'}</code> als Platzhalter.
            </p>
          </div>

          {bundlePath ? (
            <div className="flex items-center justify-between px-4 py-3 rounded-[16px]"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                  style={{ background: '#16A34A' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M9 12l2 2 4-4"/>
                    <circle cx="12" cy="12" r="9"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">Datei hochgeladen</p>
                  <p className="text-xs font-mono text-green-700 mt-0.5 break-all">{bundlePath}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                <button onClick={handleDownload}
                  className="text-xs px-3 py-1.5 rounded-[10px] font-medium flex items-center gap-1.5"
                  style={{ background: 'white', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  Exportieren
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                  className="text-xs px-3 py-1.5 rounded-[10px] font-medium"
                  style={{ background: 'white', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                  Ersetzen
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-8 rounded-[16px] text-center cursor-pointer"
              style={{ border: '2px dashed #E5E7EB', background: '#FAFAFA' }}
              onClick={() => fileInputRef.current?.click()}>
              <div className="w-12 h-12 rounded-[14px] flex items-center justify-center"
                style={{ background: '#F3F4F6' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Klicken zum Hochladen</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>.html oder .zip mit index.html und Assets</p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm,.zip"
            className="hidden"
            onChange={handleFileUpload}
          />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <input ref={folderInputRef} type="file" {...{ webkitdirectory: '', directory: '' } as any} multiple className="hidden" onChange={handleFolderUpload} />

          {uploadState === 'uploading' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-[16px]"
              style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <div className="w-4 h-4 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin flex-shrink-0" />
              <p className="text-sm text-blue-700">Datei wird hochgeladen...</p>
            </div>
          )}

          {uploadState !== 'uploading' && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-[16px] transition-all"
                style={{ background: '#1a1a1a', color: 'white', boxShadow: '0 4px 14px rgba(26,26,26,0.2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
                {bundlePath ? 'Datei ersetzen' : 'HTML / ZIP hochladen'}
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-[16px] transition-all"
                style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                </svg>
                Ordner hochladen
              </button>
            </div>
          )}
        </div>

        {/* Domain Setup */}
        {form.domain && (
          <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-medium text-gray-900">SSL & Domain-Setup</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  Nutzer-URLs: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">username.{form.domain}</code>
                </p>
              </div>
              {/* Status badge */}
              {domainSetup && domainSetup.status !== 'none' && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0" style={{
                  background: domainSetup.status === 'active' ? '#F0FDF4' : domainSetup.status === 'pending_ns' ? '#EFF6FF' : '#FFFBEB',
                  color: domainSetup.status === 'active' ? '#16A34A' : domainSetup.status === 'pending_ns' ? '#1D4ED8' : '#92400E',
                }}>
                  {domainSetup.status === 'active' ? '● SSL aktiv' : domainSetup.status === 'pending_ns' ? '○ NS ausstehend' : '○ Ausstehend'}
                </span>
              )}
            </div>

            {/* Zone created — waiting for nameserver propagation */}
            {domainSetup?.status === 'pending_ns' && (
              <div className="flex flex-col gap-3">
                <div className="px-4 py-4 rounded-[14px]"
                  style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <p className="font-semibold text-blue-800 mb-1 text-sm">Nameserver bei deinem Registrar eintragen</p>
                  <p className="text-xs text-blue-700 mb-3">
                    Die Cloudflare-Zone für <strong>{form.domain}</strong> wurde angelegt. Trage jetzt diese zwei Nameserver bei deinem Registrar ein (Checkdomain, INWX o.&nbsp;a.). Danach aktiviert sich alles automatisch.
                  </p>
                  <div className="flex flex-col gap-2 mb-3">
                    {(domainSetup.nameservers ?? []).map((ns) => (
                      <div key={ns} className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-white border border-blue-200 rounded-[8px] px-3 py-2 font-mono text-blue-900">
                          {ns}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(ns)}
                          className="text-xs px-2.5 py-2 rounded-[8px] font-medium flex-shrink-0"
                          style={{ background: '#DBEAFE', color: '#1D4ED8' }}
                          title="Kopieren">
                          Kopieren
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-600">
                    Die Seite prüft alle 15 Sekunden ob die Nameserver propagiert sind und aktiviert sich dann automatisch. Propagation dauert typisch 5–30 Minuten.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={setupDomain} disabled={settingUpDomain}
                    className="px-4 py-2 text-sm font-medium text-white rounded-[12px] flex items-center gap-2 disabled:opacity-60"
                    style={{ background: '#1a1a1a' }}>
                    {settingUpDomain
                      ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />Prüfe…</>
                      : 'Jetzt prüfen'}
                  </button>
                  <button onClick={async () => {
                    setSettingUpDomain(true)
                    await fetch(`/api/admin/templates/${id}/domain-setup`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ forceActive: true }),
                    })
                    await loadDomainSetup()
                    setSettingUpDomain(false)
                  }} disabled={settingUpDomain}
                    className="px-4 py-2 text-sm font-medium rounded-[12px] disabled:opacity-60"
                    style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                    Manuell eingerichtet ✓
                  </button>
                </div>
              </div>
            )}

            {/* Domain not found in Cloudflare */}
            {domainSetup?.status === 'zone_missing' && (
              <div className="flex flex-col gap-3">
                <div className="px-4 py-3 rounded-[14px] text-sm"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <p className="font-semibold text-red-800 mb-1">Domain noch nicht in Cloudflare</p>
                  <p className="text-xs text-red-700 mb-2">
                    <strong>{form.domain}</strong> muss deinem Cloudflare-Account hinzugefügt werden. Danach erkennt die Plattform sie automatisch.
                  </p>
                  <ol className="text-xs text-red-700 flex flex-col gap-1 list-decimal list-inside">
                    <li>Öffne <strong>dash.cloudflare.com</strong> → &quot;Add a site&quot; → <code className="bg-red-100 px-1 rounded">{form.domain}</code></li>
                    <li>Free Plan wählen. Cloudflare erkennt DNS-Einträge automatisch.</li>
                    <li>Nameserver bei deinem Registrar auf die von Cloudflare umstellen</li>
                    <li>Seite lädt sich alle 10 Sek. automatisch neu, oder manuell unten klicken.</li>
                  </ol>
                </div>
                <div className="flex gap-2">
                  <button onClick={setupDomain} disabled={settingUpDomain}
                    className="px-4 py-2 text-sm font-medium text-white rounded-[12px] flex items-center gap-2 disabled:opacity-60"
                    style={{ background: '#1a1a1a' }}>
                    {settingUpDomain
                      ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />Prüfe...</>
                      : 'Jetzt prüfen'}
                  </button>
                  <button onClick={async () => {
                    setSettingUpDomain(true)
                    await fetch(`/api/admin/templates/${id}/domain-setup`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ forceActive: true }),
                    })
                    await loadDomainSetup()
                    setSettingUpDomain(false)
                  }} disabled={settingUpDomain}
                    className="px-4 py-2 text-sm font-medium rounded-[12px] disabled:opacity-60"
                    style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                    Manuell eingerichtet ✓
                  </button>
                </div>
              </div>
            )}

            {/* Activating automatically */}
            {(!domainSetup || domainSetup.status === 'none') && settingUpDomain && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-[14px] text-sm"
                style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <div className="w-4 h-4 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin flex-shrink-0" />
                <p className="text-blue-700">Worker Route wird automatisch eingerichtet…</p>
              </div>
            )}

            {/* Not yet set up — zone not yet checked */}
            {(!domainSetup || domainSetup.status === 'none') && !settingUpDomain && (
              <div className="flex flex-col gap-3">
                <div className="px-4 py-3 rounded-[14px] text-sm"
                  style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <p className="font-semibold text-blue-800 mb-1">Prüfe Cloudflare-Account…</p>
                  <p className="text-xs text-blue-700">
                    Sobald <strong>{form.domain}</strong> in deinem Cloudflare-Account ist, wird die Worker Route automatisch eingerichtet.
                  </p>
                </div>
                <button onClick={setupDomain}
                  className="self-start px-4 py-2 text-sm font-medium rounded-[12px]"
                  style={{ background: '#F3F4F6', color: '#374151' }}>
                  Manuell einrichten
                </button>
              </div>
            )}

            {/* Active — all good */}
            {domainSetup?.status === 'active' && (
              <div className="px-4 py-3 rounded-[14px] text-sm flex items-start gap-3"
                style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" className="flex-shrink-0 mt-0.5">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                <div>
                  <p className="font-semibold text-green-800">SSL-Zertifikat aktiv</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    Alle Subdomains von <strong>{form.domain}</strong> sind automatisch mit HTTPS geschützt. Jeder neue Nutzer bekommt sofort eine funktionierende URL.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.85)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-[60px] flex-shrink-0"
              style={{ background: '#1a1a1a' }}>
              <span className="text-sm font-medium text-white">
                Vorschau: {form.title || 'Template'}
              </span>
              <button onClick={() => setShowPreview(false)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-[10px]"
                style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
                Schließen
              </button>
            </div>
            {/* iframe */}
            <iframe
              src={`/api/admin/templates/${id}/preview`}
              className="w-full border-0 flex-1"
              style={{ height: 'calc(100vh - 60px)', background: 'white' }}
              title="Template-Vorschau"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-3 pb-8">
          <button type="button" onClick={() => handleSave()} disabled={saving}
            className="px-5 py-2.5 text-sm font-medium rounded-[16px]"
            style={{ background: '#F3F4F6', color: '#374151' }}>
            {saving ? 'Speichert...' : 'Speichern'}
          </button>
          {form.status !== 'published' && (
            <button type="button" onClick={() => handleSave('published')} disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white rounded-[16px]"
              style={{ background: '#16A34A', boxShadow: '0 4px 14px rgba(22,163,74,0.30)' }}>
              Veröffentlichen
            </button>
          )}
          {form.status === 'published' && (
            <button type="button" onClick={() => handleSave('draft')} disabled={saving}
              className="px-6 py-2.5 text-sm font-medium rounded-[16px]"
              style={{ background: '#FEF9C3', color: '#92400E' }}>
              Depublizieren
            </button>
          )}
        </div>
        </div>

      </div>
      )}
    </div>
    </>
  )
}
