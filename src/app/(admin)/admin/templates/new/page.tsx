'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlaceholderSchemaEditor, PlaceholderField } from '@/components/admin/PlaceholderSchemaEditor'

export default function NewTemplatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<PlaceholderField[]>([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    domain: '',
  })

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.domain) { setError('Titel und Domain sind Pflichtfelder.'); return }

    // Validate all fields have key and label
    const invalidField = fields.find(f => !f.key || !f.label)
    if (invalidField) { setError('Alle Felder müssen einen Key und eine Bezeichnung haben.'); return }

    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        placeholder_schema: { version: 1, fields },
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Fehler beim Erstellen.')
      setLoading(false)
      return
    }

    const template = await res.json()
    router.push(`/admin/templates/${template.id}`)
  }

  const inputStyle = {
    background: '#FFFFFF',
    border: '1.5px solid #E5E7EB',
    borderRadius: '16px',
    padding: '10px 14px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-sm mb-4 transition-all"
          style={{ color: 'var(--muted-foreground)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Zurück
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">Neues Template</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Definiere die Grunddaten und Platzhalter-Felder.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && (
          <div className="px-4 py-3 text-sm text-red-600 rounded-[16px]"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <h2 className="font-medium text-gray-900">Grunddaten</h2>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Template-Name *</label>
            <input value={form.title} onChange={e => setField('title', e.target.value)}
              placeholder="z.B. FitLine Pro" required style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Beschreibung</label>
            <textarea value={form.description} onChange={e => setField('description', e.target.value)}
              placeholder="Kurze Beschreibung des Templates..." rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Template-Domain *</label>
            <input value={form.domain} onChange={e => setField('domain', e.target.value.toLowerCase())}
              placeholder="z.B. vitaldarm.de" required style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            {form.domain && (
              <p className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>
                Nutzer-URL: <code className="font-mono">username.{form.domain}</code>
              </p>
            )}
            {/* Setup-Checkliste */}
            <div className="mt-1 p-3.5 rounded-[14px] flex flex-col gap-2"
              style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
              <p className="text-xs font-semibold" style={{ color: '#0369A1' }}>
                Voraussetzungen für diese Domain:
              </p>
              <ol className="flex flex-col gap-1.5 text-xs" style={{ color: '#0C4A6E' }}>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                    style={{ background: '#0284C7', color: 'white' }}>1</span>
                  <span>Domain bei Registrar kaufen (GoDaddy, all-inkl, checkdomain …)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                    style={{ background: '#0284C7', color: 'white' }}>2</span>
                  <span>Nameserver beim Registrar auf Cloudflare umstellen — CF generiert die NS-Adressen automatisch nach Zone-Erstellung</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                    style={{ background: '#0284C7', color: 'white' }}>3</span>
                  <span>Warten bis Cloudflare die Zone als <strong>Active</strong> anzeigt (~5–30 Min)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                    style={{ background: '#0284C7', color: 'white' }}>4</span>
                  <span>Template hier speichern, dann auf der Template-Detailseite <strong>&bdquo;Domain Setup&ldquo;</strong> klicken &mdash; Wildcard-DNS und Worker Route werden automatisch angelegt</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Placeholder Fields */}
        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-medium text-gray-900">Platzhalter-Felder</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Diese Felder sieht der Nutzer im Formular. Im Template werden sie als {`{{key}}`} eingebettet.
            </p>
          </div>
          <PlaceholderSchemaEditor fields={fields} onChange={setFields} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2.5 text-sm font-medium rounded-[16px] transition-all"
            style={{ background: '#F3F4F6', color: '#374151' }}>
            Abbrechen
          </button>
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 text-sm font-medium text-white rounded-[16px] transition-all"
            style={{
              background: loading ? '#9CA3AF' : '#1a1a1a',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(26,26,26,0.25)',
            }}>
            {loading ? 'Wird gespeichert...' : 'Template erstellen'}
          </button>
        </div>
      </form>
    </div>
  )
}
