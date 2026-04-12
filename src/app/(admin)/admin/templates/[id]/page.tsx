'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { PlaceholderSchemaEditor, PlaceholderField } from '@/components/admin/PlaceholderSchemaEditor'

interface DomainSetup {
  status: string
  ssl_status?: string
  configured?: boolean
  fallback_host?: string
  ownership_verification?: { type: string; name: string; value: string }
  ssl_records?: Array<{ type: string; name: string; value: string }>
}

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fields, setFields] = useState<PlaceholderField[]>([])
  const [bundlePath, setBundlePath] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [form, setForm] = useState({ title: '', description: '', domain: '', status: 'draft' })
  const [domainSetup, setDomainSetup] = useState<DomainSetup | null>(null)
  const [settingUpDomain, setSettingUpDomain] = useState(false)

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
        setFields(data.placeholder_schema?.fields ?? [])
        setBundlePath(data.r2_bundle_path ?? null)
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

  // Poll every 10s when zone not yet found; stop when active
  useEffect(() => {
    if (!domainSetup || domainSetup.status === 'active') return
    const t = setInterval(loadDomainSetup, domainSetup.status === 'zone_missing' ? 10000 : 30000)
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
        placeholder_schema: { version: 1, fields },
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
    <div className="max-w-3xl">
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
          <button onClick={handleDelete}
            className="text-xs px-3 py-2 rounded-[12px] transition-all"
            style={{ background: '#FEF2F2', color: '#DC2626' }}>
            Löschen
          </button>
        </div>
      </div>

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
              <button onClick={() => fileInputRef.current?.click()}
                className="text-xs px-3 py-1.5 rounded-[10px] font-medium ml-3 flex-shrink-0"
                style={{ background: 'white', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                Ersetzen
              </button>
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

          {uploadState === 'uploading' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-[16px]"
              style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <div className="w-4 h-4 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin flex-shrink-0" />
              <p className="text-sm text-blue-700">Datei wird hochgeladen...</p>
            </div>
          )}

          {uploadState !== 'uploading' && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-[16px] transition-all self-start"
              style={{ background: '#1a1a1a', color: 'white', boxShadow: '0 4px 14px rgba(26,26,26,0.2)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
              </svg>
              {bundlePath ? 'Neue Datei hochladen' : 'HTML / ZIP hochladen'}
            </button>
          )}
        </div>

        {/* Placeholder Fields */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-medium text-gray-900">Platzhalter-Felder</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Diese Felder füllt der Nutzer aus. Im HTML werden sie als <code className="bg-gray-100 px-1 rounded font-mono">{'{{key}}'}</code> eingebettet.
            </p>
          </div>
          <PlaceholderSchemaEditor fields={fields} onChange={setFields} />
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
                  background: domainSetup.status === 'active' ? '#F0FDF4' : '#FFFBEB',
                  color: domainSetup.status === 'active' ? '#16A34A' : '#92400E',
                }}>
                  {domainSetup.status === 'active' ? '● SSL aktiv' : '○ Ausstehend'}
                </span>
              )}
            </div>

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
                    <li>Free Plan wählen — Cloudflare erkennt DNS-Einträge automatisch</li>
                    <li>Nameserver bei deinem Registrar auf die von Cloudflare umstellen</li>
                    <li>Seite lädt sich alle 10 Sek. automatisch neu — oder manuell unten klicken</li>
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

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end pb-8">
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
  )
}
