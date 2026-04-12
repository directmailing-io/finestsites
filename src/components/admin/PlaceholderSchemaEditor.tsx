'use client'

import { useState } from 'react'

export interface PlaceholderField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'image' | 'url' | 'email' | 'select'
  required: boolean
  default_value: string
  placeholder_text: string
  max_length: number | null
  options: string[]
  section: string
  order: number
}

interface Props {
  fields: PlaceholderField[]
  onChange: (fields: PlaceholderField[]) => void
}

const TYPE_LABELS: Record<string, string> = {
  text: 'Text (einzeilig)',
  textarea: 'Text (mehrzeilig)',
  image: 'Bild-Upload',
  url: 'URL / Link',
  email: 'E-Mail',
  select: 'Auswahl',
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  text: { bg: '#EFF6FF', text: '#1D4ED8' },
  textarea: { bg: '#F5F3FF', text: '#7C3AED' },
  image: { bg: '#F0FDF4', text: '#16A34A' },
  url: { bg: '#FEF9C3', text: '#92400E' },
  email: { bg: '#FDF2F8', text: '#DB2777' },
  select: { bg: '#F3F4F6', text: '#374151' },
}

function newField(order: number): PlaceholderField {
  return {
    key: '', label: '', type: 'text', required: false,
    default_value: '', placeholder_text: '',
    max_length: null, options: [], section: '', order,
  }
}

export function PlaceholderSchemaEditor({ fields, onChange }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  function addField() {
    const updated = [...fields, newField(fields.length)]
    onChange(updated)
    setExpandedIdx(updated.length - 1)
  }

  function removeField(idx: number) {
    const updated = fields.filter((_, i) => i !== idx)
    onChange(updated)
    if (expandedIdx === idx) setExpandedIdx(null)
  }

  function updateField(idx: number, patch: Partial<PlaceholderField>) {
    const updated = fields.map((f, i) => i === idx ? { ...f, ...patch } : f)
    onChange(updated)
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    const updated = [...fields]
    ;[updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]]
    onChange(updated)
  }

  function moveDown(idx: number) {
    if (idx === fields.length - 1) return
    const updated = [...fields]
    ;[updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]]
    onChange(updated)
  }

  const inputStyle = {
    background: '#FFFFFF',
    border: '1.5px solid #E5E7EB',
    borderRadius: '12px',
    padding: '8px 12px',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, idx) => {
        const isExpanded = expandedIdx === idx
        const typeColor = TYPE_COLORS[field.type] ?? TYPE_COLORS.text
        const isValid = field.key && field.label

        return (
          <div key={idx} className="rounded-[20px] overflow-hidden"
            style={{ border: '1.5px solid #E5E7EB', background: '#FFFFFF',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

            {/* Field header */}
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}>

              {/* Type badge */}
              <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
                style={{ background: typeColor.bg, color: typeColor.text }}>
                {TYPE_LABELS[field.type]}
              </span>

              {/* Key + Label preview */}
              <div className="flex-1 min-w-0">
                {field.key ? (
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-gray-500">{`{{${field.key}}}`}</code>
                    {field.label && <span className="text-sm text-gray-700">— {field.label}</span>}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Neues Feld (noch konfigurieren)</span>
                )}
              </div>

              {/* Required badge */}
              {field.required && (
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: '#FEF2F2', color: '#DC2626' }}>
                  Pflicht
                </span>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={() => moveUp(idx)} disabled={idx === 0}
                  className="p-1.5 rounded-[8px] transition-all disabled:opacity-30"
                  style={{ color: '#9CA3AF' }} title="Nach oben">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 15l-6-6-6 6"/>
                  </svg>
                </button>
                <button onClick={() => moveDown(idx)} disabled={idx === fields.length - 1}
                  className="p-1.5 rounded-[8px] transition-all disabled:opacity-30"
                  style={{ color: '#9CA3AF' }} title="Nach unten">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                <button onClick={() => removeField(idx)}
                  className="p-1.5 rounded-[8px] transition-all"
                  style={{ color: '#9CA3AF' }} title="Entfernen"
                  onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
                  </svg>
                </button>
                <button onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  className="p-1.5 rounded-[8px]" style={{ color: '#9CA3AF' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Expanded editor */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: '#F3F4F6' }}>
                <div className="grid grid-cols-2 gap-3 mt-3">

                  {/* Key */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Placeholder-Key *</label>
                    <input value={field.key}
                      onChange={e => updateField(idx, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                      placeholder="z.B. first_name"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                    {field.key && (
                      <code className="text-xs text-gray-400 mt-0.5">{`{{${field.key}}}`}</code>
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Bezeichnung (für User) *</label>
                    <input value={field.label}
                      onChange={e => updateField(idx, { label: e.target.value })}
                      placeholder="z.B. Vorname"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                  </div>

                  {/* Type */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Feldtyp</label>
                    <select value={field.type}
                      onChange={e => updateField(idx, { type: e.target.value as PlaceholderField['type'] })}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      {Object.entries(TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Section */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Abschnitt (optional)</label>
                    <input value={field.section}
                      onChange={e => updateField(idx, { section: e.target.value })}
                      placeholder="z.B. Persönliche Infos"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                  </div>

                  {/* Placeholder text */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Beispieltext im Feld</label>
                    <input value={field.placeholder_text}
                      onChange={e => updateField(idx, { placeholder_text: e.target.value })}
                      placeholder="z.B. Max"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                  </div>

                  {/* Default value */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Standardwert</label>
                    <input value={field.default_value}
                      onChange={e => updateField(idx, { default_value: e.target.value })}
                      placeholder="Wenn Feld leer bleibt..."
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                  </div>

                  {/* Max length (not for image type) */}
                  {field.type !== 'image' && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-600">Max. Zeichen</label>
                      <input type="number" value={field.max_length ?? ''}
                        onChange={e => updateField(idx, { max_length: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Kein Limit"
                        min={1} max={10000}
                        style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                        onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                    </div>
                  )}

                  {/* Required toggle */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Pflichtfeld</label>
                    <button type="button"
                      onClick={() => updateField(idx, { required: !field.required })}
                      className="flex items-center gap-2 px-3 py-2 rounded-[12px] text-sm transition-all text-left"
                      style={{
                        background: field.required ? '#FEF2F2' : '#F9FAFB',
                        border: `1.5px solid ${field.required ? '#FECACA' : '#E5E7EB'}`,
                        color: field.required ? '#DC2626' : '#6B7280',
                      }}>
                      <div className="w-4 h-4 rounded-[4px] flex items-center justify-center"
                        style={{ background: field.required ? '#DC2626' : '#E5E7EB' }}>
                        {field.required && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        )}
                      </div>
                      {field.required ? 'Pflichtfeld (muss ausgefüllt werden)' : 'Optional'}
                    </button>
                  </div>

                  {/* Options for select type */}
                  {field.type === 'select' && (
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-xs font-medium text-gray-600">Auswahloptionen (eine pro Zeile)</label>
                      <textarea
                        value={field.options.join('\n')}
                        onChange={e => updateField(idx, { options: e.target.value.split('\n').filter(Boolean) })}
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical' }}
                        onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                        onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                    </div>
                  )}
                </div>

                {!isValid && (
                  <p className="text-xs mt-3 text-orange-600">
                    Key und Bezeichnung sind Pflichtfelder für dieses Feld.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add field button */}
      <button type="button" onClick={addField}
        className="flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-[20px] transition-all w-full"
        style={{
          border: '1.5px dashed #D1D5DB',
          color: '#6B7280',
          background: 'transparent',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#1a1a1a'
          ;(e.currentTarget as HTMLElement).style.color = '#1a1a1a'
          ;(e.currentTarget as HTMLElement).style.background = '#F9FAFB'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#D1D5DB'
          ;(e.currentTarget as HTMLElement).style.color = '#6B7280'
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
        }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Feld hinzufügen
      </button>
    </div>
  )
}
