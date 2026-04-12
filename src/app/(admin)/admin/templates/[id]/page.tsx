'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { PlaceholderSchemaEditor, PlaceholderField } from '@/components/admin/PlaceholderSchemaEditor'

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fields, setFields] = useState<PlaceholderField[]>([])
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
        setLoading(false)
      })
    // loading starts
  }, [id])

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave(publish?: boolean) {
    const invalidField = fields.find(f => !f.key || !f.label)
    if (invalidField) { setError('Alle Felder müssen einen Key und eine Bezeichnung haben.'); return }

    setSaving(true)
    setError('')
    setSuccess('')

    const res = await fetch(`/api/admin/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        status: publish ? 'published' : form.status,
        placeholder_schema: { version: 1, fields },
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Fehler beim Speichern.')
    } else {
      const updated = await res.json()
      setForm(prev => ({ ...prev, status: updated.status }))
      setSuccess(publish ? 'Template veröffentlicht!' : 'Änderungen gespeichert.')
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
              {form.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
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
            <label className="text-sm font-medium text-gray-700">Domain</label>
            <input value={form.domain} onChange={e => setField('domain', e.target.value.toLowerCase())}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            {form.domain && (
              <p className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>
                Nutzer-URL: <code className="font-mono">username.{form.domain}</code>
              </p>
            )}
          </div>
        </div>

        <div className="p-6 rounded-[24px] bg-white flex flex-col gap-4"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-medium text-gray-900">Platzhalter-Felder</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {fields.length} Feld(er) definiert
            </p>
          </div>
          <PlaceholderSchemaEditor fields={fields} onChange={setFields} />
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button type="button" onClick={() => handleSave(false)} disabled={saving}
            className="px-5 py-2.5 text-sm font-medium rounded-[16px]"
            style={{ background: '#F3F4F6', color: '#374151' }}>
            {saving ? 'Speichert...' : 'Speichern'}
          </button>
          {form.status !== 'published' && (
            <button type="button" onClick={() => handleSave(true)} disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white rounded-[16px]"
              style={{ background: '#16A34A', boxShadow: '0 4px 14px rgba(22,163,74,0.30)' }}>
              Veröffentlichen
            </button>
          )}
          {form.status === 'published' && (
            <button type="button"
              onClick={() => { setForm(f => ({ ...f, status: 'draft' })); handleSave(false) }}
              disabled={saving}
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
