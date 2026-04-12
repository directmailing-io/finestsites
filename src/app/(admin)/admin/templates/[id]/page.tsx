'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { PlaceholderSchemaEditor, PlaceholderField } from '@/components/admin/PlaceholderSchemaEditor'

const WORKER_URL = 'finestsites-worker.finestsites.workers.dev'

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

        {/* Domain Setup Guide */}
        {form.domain && (
          <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
            <div>
              <h2 className="font-medium text-gray-900">Domain-Konfiguration</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                Damit <code className="bg-gray-100 px-1.5 py-0.5 rounded-md font-mono text-xs">username.{form.domain}</code> funktioniert, musst du folgende DNS-Einträge setzen:
              </p>
            </div>

            <div className="rounded-[16px] overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Typ</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Wert</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wide">TTL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3"><span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: '#F3E8FF', color: '#7C3AED' }}>CNAME</span></td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-900 font-bold">*</td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-700 break-all">{WORKER_URL}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">Auto</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="px-4 py-3 rounded-[14px] text-sm"
                style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <p className="font-semibold text-green-800 mb-1">✓ Einmalig einrichten — danach läuft alles automatisch</p>
                <p className="text-xs text-green-700">
                  Sobald dieser DNS-Eintrag gesetzt ist, bekommt <strong>jeder User</strong> automatisch eine funktionierende HTTPS-Subdomain — kein weiterer Aufwand pro Nutzer.
                </p>
              </div>

              <div className="px-4 py-3 rounded-[14px] text-sm"
                style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <p className="font-semibold text-blue-800 mb-1.5">Schritt-für-Schritt (Cloudflare DNS)</p>
                <ol className="list-decimal list-inside text-xs flex flex-col gap-1 text-blue-700">
                  <li>Öffne <strong>dash.cloudflare.com</strong> → deine Domain <strong>{form.domain}</strong></li>
                  <li>Klicke links auf <strong>DNS → Records</strong></li>
                  <li>Klicke <strong>Add record</strong></li>
                  <li>Typ: <code className="bg-blue-100 px-1 rounded">CNAME</code> · Name: <code className="bg-blue-100 px-1 rounded">*</code> · Ziel: <code className="bg-blue-100 px-1 rounded">{WORKER_URL}</code></li>
                  <li>Proxy-Status: <strong>Proxied (orange Wolke ☁)</strong> — wichtig für HTTPS!</li>
                  <li>Klicke <strong>Save</strong></li>
                </ol>
                <p className="text-xs text-blue-600 mt-2 pt-2" style={{ borderTop: '1px solid #BFDBFE' }}>
                  Die orange Wolke bedeutet: Cloudflare schaltet sich dazwischen und stellt automatisch ein kostenloses SSL-Zertifikat aus. Grüne Haken bei allen Nutzern, keine Kosten.
                </p>
              </div>

              <div className="px-4 py-3 rounded-[14px] text-xs"
                style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                <p className="font-semibold mb-1">Andere DNS-Anbieter (IONOS, Strato, etc.) — nicht empfohlen</p>
                <p>Wildcard-HTTPS ist dort ohne ein kostenpflichtiges Zertifikat (~80€/Jahr) nicht möglich. Empfehlung: Domain zu Cloudflare migrieren (kostenlos).</p>
              </div>
            </div>
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
