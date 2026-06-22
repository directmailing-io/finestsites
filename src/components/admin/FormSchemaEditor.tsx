'use client'

import { useState } from 'react'
import type { FormSchema, FormField, FormFieldType } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Kurztext',
  textarea: 'Langer Text',
  email: 'E-Mail',
  tel: 'Telefon',
  number: 'Zahl',
  url: 'URL',
  select: 'Auswahl (Dropdown)',
  radio: 'Auswahl (Radio)',
  checkbox: 'Checkbox',
}

const FIELD_TYPE_COLORS: Record<FormFieldType, { bg: string; text: string }> = {
  text: { bg: '#F3F4F6', text: '#374151' },
  textarea: { bg: '#EFF6FF', text: '#1D4ED8' },
  email: { bg: '#FFF7ED', text: '#C2410C' },
  tel: { bg: '#F0FDF4', text: '#15803D' },
  number: { bg: '#F5F3FF', text: '#6D28D9' },
  url: { bg: '#E0F2FE', text: '#0369A1' },
  select: { bg: '#FEF3C7', text: '#92400E' },
  radio: { bg: '#FCE7F3', text: '#9D174D' },
  checkbox: { bg: '#F0FDF4', text: '#166534' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newField(): FormField {
  return { key: '', label: '', type: 'text', required: false }
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FieldRow({
  field,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  field: FormField
  index: number
  total: number
  onChange: (f: FormField) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const colors = FIELD_TYPE_COLORS[field.type]

  return (
    <div className="rounded-[14px] overflow-hidden transition-all"
      style={{ border: '1px solid #E5E7EB', background: '#fff' }}>

      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}>
        {/* Drag handle / order */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onMove(-1) }}
            disabled={index === 0}
            className="p-0.5 rounded disabled:opacity-25"
            style={{ color: '#9CA3AF' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onMove(1) }}
            disabled={index === total - 1}
            className="p-0.5 rounded disabled:opacity-25"
            style={{ color: '#9CA3AF' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>

        {/* Type badge */}
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: colors.bg, color: colors.text }}>
          {FIELD_TYPE_LABELS[field.type]}
        </span>

        {/* Label / Key */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{field.label || <span className="text-gray-400 italic">Kein Label</span>}</p>
          {field.key && <p className="text-xs font-mono text-gray-400 truncate">{`{{${field.key}}}`}</p>}
        </div>

        {field.required && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: '#FEF2F2', color: '#DC2626' }}>Pflicht</span>
        )}

        {/* Expand chevron */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
          className="flex-shrink-0 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3" style={{ borderTop: '1px solid #F3F4F6' }}>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {/* Label */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Label</label>
              <input
                value={field.label}
                onChange={e => {
                  const label = e.target.value
                  onChange({
                    ...field,
                    label,
                    key: field.key || slugify(label),
                  })
                }}
                placeholder="z. B. E-Mail-Adresse"
                className="w-full px-3 py-2 text-sm rounded-[10px] outline-none transition-all"
                style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
                onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>

            {/* Key */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Key (Feldname)</label>
              <input
                value={field.key}
                onChange={e => onChange({ ...field, key: slugify(e.target.value) })}
                placeholder="z. B. email"
                className="w-full px-3 py-2 text-sm rounded-[10px] outline-none font-mono transition-all"
                style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
                onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Type */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Feldtyp</label>
              <select
                value={field.type}
                onChange={e => onChange({ ...field, type: e.target.value as FormFieldType })}
                className="w-full px-3 py-2 text-sm rounded-[10px] outline-none transition-all appearance-none cursor-pointer"
                style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}>
                {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Placeholder */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Platzhaltertext</label>
              <input
                value={field.placeholder ?? ''}
                onChange={e => onChange({ ...field, placeholder: e.target.value })}
                placeholder="z. B. max@beispiel.de"
                className="w-full px-3 py-2 text-sm rounded-[10px] outline-none transition-all"
                style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
                onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>
          </div>

          {/* Options (for select/radio) */}
          {(field.type === 'select' || field.type === 'radio') && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Optionen (eine pro Zeile)</label>
              <textarea
                value={(field.options ?? []).join('\n')}
                onChange={e => onChange({ ...field, options: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                placeholder={'Option A\nOption B\nOption C'}
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-[10px] outline-none transition-all resize-none"
                style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA', fontFamily: 'monospace' }}
                onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
            </div>
          )}

          {/* Required toggle + delete */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => onChange({ ...field, required: !field.required })}
                className="w-9 h-5 rounded-full transition-all relative"
                style={{ background: field.required ? '#1a1a1a' : '#E5E7EB' }}>
                <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                  style={{ left: field.required ? '18px' : '2px' }} />
              </div>
              <span className="text-xs font-medium text-gray-600">Pflichtfeld</span>
            </label>

            <button
              onClick={onRemove}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[8px] transition-all"
              style={{ color: '#DC2626', background: '#FEF2F2' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FEE2E2')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FEF2F2')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>
              </svg>
              Entfernen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  templateId: string
}

export default function FormSchemaEditor({ templateId }: Props) {
  const [schemas, setSchemas] = useState<FormSchema[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newFormName, setNewFormName] = useState('')
  const [newFormTitle, setNewFormTitle] = useState('')
  const [addError, setAddError] = useState('')

  // Load schemas when component mounts (lazy — only when tab is shown)
  function ensureLoaded() {
    if (loaded) return
    setLoaded(true)
    fetch(`/api/admin/templates/${templateId}/form-schemas`)
      .then(r => r.json())
      .then(data => setSchemas(Array.isArray(data) ? data : []))
      .catch(() => setError('Fehler beim Laden der Formulare.'))
  }

  async function createSchema() {
    setAddError('')
    const name = newFormName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const title = newFormTitle.trim()
    if (!name || !title) { setAddError('Name und Titel sind erforderlich.'); return }

    const res = await fetch(`/api/admin/templates/${templateId}/form-schemas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form_name: name, title }),
    })
    const data = await res.json()
    if (!res.ok) { setAddError(data.error ?? 'Fehler beim Erstellen.'); return }
    setSchemas(prev => [...prev, data])
    setAddingNew(false)
    setNewFormName('')
    setNewFormTitle('')
  }

  async function saveSchema(schema: FormSchema) {
    setSaving(schema.id)
    setError('')
    const res = await fetch(`/api/admin/templates/${templateId}/form-schemas/${schema.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: schema.title,
        fields: schema.fields,
        email_notification_enabled: schema.email_notification_enabled,
        form_name: schema.form_name,
      }),
    })
    setSaving(null)
    if (!res.ok) { setError('Speichern fehlgeschlagen.'); return }
    setSuccess('Gespeichert.')
    setTimeout(() => setSuccess(''), 2500)
  }

  async function deleteSchema(id: string) {
    if (!confirm('Formular und alle Felddefinitionen löschen? (Eingaben werden nicht gelöscht)')) return
    await fetch(`/api/admin/templates/${templateId}/form-schemas/${id}`, { method: 'DELETE' })
    setSchemas(prev => prev.filter(s => s.id !== id))
  }

  function updateField(schemaId: string, index: number, field: FormField) {
    setSchemas(prev => prev.map(s => s.id === schemaId
      ? { ...s, fields: s.fields.map((f, i) => i === index ? field : f) }
      : s
    ))
  }

  function addField(schemaId: string) {
    setSchemas(prev => prev.map(s => s.id === schemaId
      ? { ...s, fields: [...s.fields, newField()] }
      : s
    ))
  }

  function removeField(schemaId: string, index: number) {
    setSchemas(prev => prev.map(s => s.id === schemaId
      ? { ...s, fields: s.fields.filter((_, i) => i !== index) }
      : s
    ))
  }

  function moveField(schemaId: string, index: number, dir: -1 | 1) {
    setSchemas(prev => prev.map(s => {
      if (s.id !== schemaId) return s
      const fields = [...s.fields]
      const target = index + dir
      if (target < 0 || target >= fields.length) return s
      ;[fields[index], fields[target]] = [fields[target], fields[index]]
      return { ...s, fields }
    }))
  }

  return (
    <div onFocus={ensureLoaded}>
      {/* Status messages */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-[12px] text-sm" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 rounded-[12px] text-sm" style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
          {success}
        </div>
      )}

      {/* Info banner */}
      <div className="mb-5 px-4 py-3.5 rounded-[14px] flex gap-3"
        style={{ background: '#F8F9FF', border: '1px solid #E0E7FF' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4338CA" strokeWidth="2" className="flex-shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="#4338CA"/>
        </svg>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold" style={{ color: '#3730A3' }}>Formulare in Templates einbinden</p>
          <p className="text-xs leading-relaxed" style={{ color: '#4338CA' }}>
            Verwende im HTML-Template <code className="bg-indigo-100 px-1 rounded font-mono">{'<form action="/.finestsites/forms/FORM_NAME" method="POST">'}</code> — wobei <code className="bg-indigo-100 px-1 rounded font-mono">FORM_NAME</code> dem Slug des Formulars unten entspricht.
            Verstecktes Honeypot-Feld empfohlen: <code className="bg-indigo-100 px-1 rounded font-mono">{'<input name="_honeypot" style="display:none">'}</code>
          </p>
        </div>
      </div>

      {/* Schemas list */}
      {schemas.length === 0 && !addingNew && (
        <div className="py-10 text-center rounded-[18px]" style={{ border: '2px dashed #E5E7EB' }}>
          <div className="w-11 h-11 rounded-[14px] flex items-center justify-center mx-auto mb-3"
            style={{ background: '#F3F4F6' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Noch kein Formular definiert</p>
          <p className="text-xs text-gray-400 mb-4">Erstelle ein Formular, das Besucher auf der Website ausfüllen können.</p>
          <button onClick={() => setAddingNew(true)}
            className="px-4 py-2 text-sm font-semibold rounded-[10px] text-white"
            style={{ background: '#1a1a1a' }}>
            + Formular erstellen
          </button>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {schemas.map(schema => (
          <div key={schema.id} className="rounded-[18px] overflow-hidden"
            style={{ border: '1px solid #E5E7EB' }}>

            {/* Schema header */}
            <div className="flex items-center gap-3 px-5 py-4"
              style={{ background: '#FAFAFA', borderBottom: '1px solid #E5E7EB' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <input
                    value={schema.title}
                    onChange={e => setSchemas(prev => prev.map(s => s.id === schema.id ? { ...s, title: e.target.value } : s))}
                    className="text-sm font-semibold text-gray-900 bg-transparent outline-none border-b border-transparent transition-all"
                    onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                    onBlur={e => (e.target.style.borderColor = 'transparent')}
                    placeholder="Formular-Titel"
                  />
                </div>
                <code className="text-xs font-mono text-gray-400">
                  /.finestsites/forms/<span className="text-indigo-500">{schema.form_name}</span>
                </code>
              </div>

              {/* Notification toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0">
                <div
                  onClick={() => setSchemas(prev => prev.map(s => s.id === schema.id
                    ? { ...s, email_notification_enabled: !s.email_notification_enabled }
                    : s
                  ))}
                  className="w-8 h-4 rounded-full transition-all relative"
                  style={{ background: schema.email_notification_enabled ? '#1a1a1a' : '#E5E7EB' }}>
                  <div className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all"
                    style={{ left: schema.email_notification_enabled ? '17px' : '2px' }} />
                </div>
                <span className="text-xs text-gray-500">E-Mail</span>
              </label>

              {/* Save */}
              <button
                onClick={() => saveSchema(schema)}
                disabled={saving === schema.id}
                className="px-3 py-1.5 text-xs font-semibold rounded-[8px] text-white transition-all disabled:opacity-60"
                style={{ background: '#1a1a1a' }}>
                {saving === schema.id ? 'Speichert…' : 'Speichern'}
              </button>

              {/* Delete schema */}
              <button onClick={() => deleteSchema(schema.id)}
                className="p-1.5 rounded-[8px] transition-all flex-shrink-0"
                style={{ color: '#9CA3AF' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DC2626'; (e.currentTarget as HTMLElement).style.background = '#FEF2F2' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9CA3AF'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6l-1 14H6L5 6"/>
                </svg>
              </button>
            </div>

            {/* Fields */}
            <div className="p-4 flex flex-col gap-2">
              {schema.fields.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4 italic">Noch keine Felder — füge das erste Feld hinzu.</p>
              )}
              {schema.fields.map((field, idx) => (
                <FieldRow
                  key={idx}
                  field={field}
                  index={idx}
                  total={schema.fields.length}
                  onChange={f => updateField(schema.id, idx, f)}
                  onRemove={() => removeField(schema.id, idx)}
                  onMove={dir => moveField(schema.id, idx, dir)}
                />
              ))}
              <button
                onClick={() => addField(schema.id)}
                className="mt-1 flex items-center gap-2 text-xs font-medium px-3 py-2.5 rounded-[10px] w-full justify-center transition-all"
                style={{ border: '1.5px dashed #D1D5DB', color: '#6B7280', background: '#FAFAFA' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#9CA3AF' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D1D5DB' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Feld hinzufügen
              </button>
            </div>
          </div>
        ))}

        {/* Add new form */}
        {addingNew ? (
          <div className="p-5 rounded-[18px]" style={{ border: '2px solid #1a1a1a' }}>
            <p className="text-sm font-semibold text-gray-900 mb-3">Neues Formular</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Titel</label>
                <input
                  value={newFormTitle}
                  onChange={e => {
                    setNewFormTitle(e.target.value)
                    if (!newFormName) setNewFormName(slugify(e.target.value).replace(/_/g, '-'))
                  }}
                  placeholder="z. B. Kontaktformular"
                  className="px-3 py-2 text-sm rounded-[10px] outline-none"
                  style={{ border: '1.5px solid #E5E7EB' }}
                  onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">URL-Slug</label>
                <input
                  value={newFormName}
                  onChange={e => setNewFormName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="z. B. contact"
                  className="px-3 py-2 text-sm rounded-[10px] outline-none font-mono"
                  style={{ border: '1.5px solid #E5E7EB' }}
                  onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                />
              </div>
            </div>
            {addError && <p className="text-xs text-red-600 mb-3">{addError}</p>}
            <div className="flex gap-2">
              <button onClick={createSchema}
                className="px-4 py-2 text-sm font-semibold rounded-[10px] text-white"
                style={{ background: '#1a1a1a' }}>
                Erstellen
              </button>
              <button onClick={() => { setAddingNew(false); setAddError('') }}
                className="px-4 py-2 text-sm font-medium rounded-[10px]"
                style={{ color: '#6B7280', background: '#F3F4F6' }}>
                Abbrechen
              </button>
            </div>
          </div>
        ) : schemas.length > 0 && (
          <button onClick={() => setAddingNew(true)}
            className="flex items-center gap-2 text-sm font-medium px-4 py-3 rounded-[14px] transition-all"
            style={{ border: '1.5px dashed #D1D5DB', color: '#6B7280' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#9CA3AF'; (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D1D5DB'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Weiteres Formular hinzufügen
          </button>
        )}
      </div>
    </div>
  )
}
