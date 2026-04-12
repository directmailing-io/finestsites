'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardOption {
  value: string
  label: string
  description: string
  card_type: 'text' | 'image' | 'color'
  image_url: string
  color: string
}

export interface PlaceholderField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'image' | 'url' | 'email' | 'dropdown' | 'card_select'
  required: boolean
  default_value: string
  placeholder_text: string
  max_length: number | null
  options: string[]         // for dropdown
  card_options: CardOption[] // for card_select
  section: string
  order: number
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<PlaceholderField['type'], string> = {
  text: 'Text (einzeilig)',
  textarea: 'Text (mehrzeilig)',
  image: 'Bild-Upload',
  url: 'URL / Link',
  email: 'E-Mail',
  dropdown: 'Dropdown-Auswahl',
  card_select: 'Card-Auswahl',
}

const TYPE_COLORS: Record<PlaceholderField['type'], { bg: string; text: string }> = {
  text:        { bg: '#EFF6FF', text: '#1D4ED8' },
  textarea:    { bg: '#F5F3FF', text: '#7C3AED' },
  image:       { bg: '#F0FDF4', text: '#16A34A' },
  url:         { bg: '#FEF9C3', text: '#92400E' },
  email:       { bg: '#FDF2F8', text: '#DB2777' },
  dropdown:    { bg: '#F3F4F6', text: '#374151' },
  card_select: { bg: '#FFF7ED', text: '#C2410C' },
}

const TYPE_ICONS: Record<PlaceholderField['type'], string> = {
  text: 'T',
  textarea: '¶',
  image: '🖼',
  url: '🔗',
  email: '@',
  dropdown: '▾',
  card_select: '◫',
}

function newField(order: number): PlaceholderField {
  return {
    key: '', label: '', type: 'text', required: false,
    default_value: '', placeholder_text: '',
    max_length: null, options: [], card_options: [], section: '', order,
  }
}

function newCardOption(): CardOption {
  return { value: '', label: '', description: '', card_type: 'text', image_url: '', color: '#6366F1' }
}

// ─── Card Option Editor ───────────────────────────────────────────────────────

function CardOptionEditor({
  option, index, onUpdate, onRemove,
}: {
  option: CardOption
  index: number
  onUpdate: (patch: Partial<CardOption>) => void
  onRemove: () => void
}) {
  const inputStyle = {
    background: '#F9FAFB', border: '1px solid #E5E7EB',
    borderRadius: '10px', padding: '7px 10px',
    fontSize: '12px', outline: 'none', width: '100%',
  }

  return (
    <div className="rounded-[14px] p-3 flex flex-col gap-2.5"
      style={{ background: '#FAFAFA', border: '1px solid #F0F0F0' }}>

      {/* Card header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Card {index + 1}</span>
        <button type="button" onClick={onRemove}
          className="text-xs px-2 py-1 rounded-[8px] transition-all"
          style={{ background: '#FEF2F2', color: '#DC2626' }}>
          ✕ Entfernen
        </button>
      </div>

      {/* Card type selector */}
      <div className="flex gap-2">
        {(['text', 'image', 'color'] as const).map(ct => (
          <button key={ct} type="button"
            onClick={() => onUpdate({ card_type: ct })}
            className="flex-1 py-1.5 text-xs font-medium rounded-[10px] transition-all"
            style={{
              background: option.card_type === ct ? '#1a1a1a' : '#F3F4F6',
              color: option.card_type === ct ? 'white' : '#6B7280',
            }}>
            {ct === 'text' ? 'Text' : ct === 'image' ? 'Bild' : 'Farbe'}
          </button>
        ))}
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Value (für {'{{#if}}'})</label>
          <input value={option.value}
            onChange={e => onUpdate({ value: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })}
            placeholder="z.B. modern" style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Label (Anzeige)</label>
          <input value={option.label}
            onChange={e => onUpdate({ label: e.target.value })}
            placeholder="z.B. Modern" style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
        </div>
        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-xs text-gray-500">Beschreibung (optional)</label>
          <input value={option.description}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="z.B. Klares minimalistisches Design" style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
        </div>

        {option.card_type === 'image' && (
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs text-gray-500">Bild-URL</label>
            <input value={option.image_url}
              onChange={e => onUpdate({ image_url: e.target.value })}
              placeholder="https://..." style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
          </div>
        )}

        {option.card_type === 'color' && (
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs text-gray-500">Farbe</label>
            <div className="flex items-center gap-2">
              <input type="color" value={option.color}
                onChange={e => onUpdate({ color: e.target.value })}
                className="w-10 h-9 rounded-[10px] border-0 cursor-pointer p-0.5"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }} />
              <input value={option.color}
                onChange={e => onUpdate({ color: e.target.value })}
                placeholder="#6366F1" style={{ ...inputStyle, width: 'auto', flex: 1 }}
                onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="mt-1">
        <label className="text-xs text-gray-400 mb-1.5 block">Vorschau</label>
        <div className="inline-flex flex-col items-center gap-1.5 px-3 py-2 rounded-[12px] min-w-[80px] text-center"
          style={{ border: '2px solid #E5E7EB', background: 'white' }}>
          {option.card_type === 'color' && option.color && (
            <div className="w-8 h-8 rounded-full" style={{ background: option.color }} />
          )}
          {option.card_type === 'image' && option.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={option.image_url} alt="" className="w-16 h-12 object-cover rounded-[8px]" />
          )}
          {option.card_type === 'image' && !option.image_url && (
            <div className="w-16 h-10 rounded-[8px] flex items-center justify-center text-xs text-gray-400"
              style={{ background: '#F3F4F6' }}>Bild</div>
          )}
          <span className="text-xs font-medium text-gray-800 leading-tight">
            {option.label || 'Label'}
          </span>
          {option.description && (
            <span className="text-xs text-gray-400 leading-tight">{option.description}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

interface Props {
  fields: PlaceholderField[]
  onChange: (fields: PlaceholderField[]) => void
}

export function PlaceholderSchemaEditor({ fields, onChange }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  function addField() {
    const updated = [...fields, newField(fields.length)]
    onChange(updated)
    setExpandedIdx(updated.length - 1)
  }

  function removeField(idx: number) {
    onChange(fields.filter((_, i) => i !== idx))
    if (expandedIdx === idx) setExpandedIdx(null)
  }

  function updateField(idx: number, patch: Partial<PlaceholderField>) {
    onChange(fields.map((f, i) => i === idx ? { ...f, ...patch } : f))
  }

  function moveField(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= fields.length) return
    const updated = [...fields]
    ;[updated[idx], updated[target]] = [updated[target], updated[idx]]
    onChange(updated)
  }

  function addCardOption(fieldIdx: number) {
    const field = fields[fieldIdx]
    updateField(fieldIdx, { card_options: [...(field.card_options ?? []), newCardOption()] })
  }

  function updateCardOption(fieldIdx: number, optIdx: number, patch: Partial<CardOption>) {
    const field = fields[fieldIdx]
    const updated = (field.card_options ?? []).map((c, i) => i === optIdx ? { ...c, ...patch } : c)
    updateField(fieldIdx, { card_options: updated })
  }

  function removeCardOption(fieldIdx: number, optIdx: number) {
    const field = fields[fieldIdx]
    updateField(fieldIdx, { card_options: (field.card_options ?? []).filter((_, i) => i !== optIdx) })
  }

  const inputStyle = {
    background: '#FFFFFF', border: '1.5px solid #E5E7EB',
    borderRadius: '12px', padding: '8px 12px',
    fontSize: '13px', outline: 'none', width: '100%',
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Syntax hint */}
      <div className="px-3 py-2.5 rounded-[12px] text-xs"
        style={{ background: '#F8F9FF', border: '1px solid #E0E7FF', color: '#4338CA' }}>
        <span className="font-semibold">Template-Syntax:</span>
        {' '}<code className="bg-indigo-100 px-1 rounded">{'{{key}}'}</code> → Wert,{' '}
        <code className="bg-indigo-100 px-1 rounded">{'{{#if key=wert}}'}</code>…<code className="bg-indigo-100 px-1 rounded">{'{{/if}}'}</code> → bedingte Sektion
      </div>

      {fields.map((field, idx) => {
        const isExpanded = expandedIdx === idx
        const color = TYPE_COLORS[field.type]
        const isValid = field.key && field.label

        return (
          <div key={idx} className="rounded-[20px] overflow-hidden"
            style={{ border: `1.5px solid ${isExpanded ? '#1a1a1a' : '#E5E7EB'}`, background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'border-color 0.15s' }}>

            {/* ── Header row ── */}
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}>

              <span className="w-7 h-7 rounded-[8px] flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: color.bg, color: color.text }}>
                {TYPE_ICONS[field.type]}
              </span>

              <div className="flex-1 min-w-0">
                {field.key ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">{`{{${field.key}}}`}</code>
                    {field.label && <span className="text-sm text-gray-700 font-medium">{field.label}</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: color.bg, color: color.text }}>
                      {TYPE_LABELS[field.type]}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Neues Feld konfigurieren…</span>
                )}
              </div>

              {field.required && (
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: '#FEF2F2', color: '#DC2626' }}>Pflicht</span>
              )}

              <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={() => moveField(idx, -1)} disabled={idx === 0}
                  className="p-1.5 rounded-[8px] disabled:opacity-25" style={{ color: '#9CA3AF' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                </button>
                <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1}
                  className="p-1.5 rounded-[8px] disabled:opacity-25" style={{ color: '#9CA3AF' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                <button onClick={() => removeField(idx)}
                  className="p-1.5 rounded-[8px]" style={{ color: '#9CA3AF' }}
                  onMouseEnter={e => ((e.target as HTMLElement).style.color = '#DC2626')}
                  onMouseLeave={e => ((e.target as HTMLElement).style.color = '#9CA3AF')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
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

            {/* ── Expanded editor ── */}
            {isExpanded && (
              <div className="px-4 pb-5 pt-1 border-t" style={{ borderColor: '#F3F4F6' }}>
                <div className="grid grid-cols-2 gap-3 mt-3">

                  {/* Key */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Placeholder-Key *</label>
                    <input value={field.key}
                      onChange={e => updateField(idx, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                      placeholder="z.B. design_stil"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                    {field.key && (
                      <code className="text-xs text-gray-400">{`{{${field.key}}}`}</code>
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Bezeichnung (für User) *</label>
                    <input value={field.label}
                      onChange={e => updateField(idx, { label: e.target.value })}
                      placeholder="z.B. Design-Stil"
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
                      {(Object.keys(TYPE_LABELS) as PlaceholderField['type'][]).map(t => (
                        <option key={t} value={t}>{TYPE_LABELS[t]}</option>
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

                  {/* Placeholder text (not for card_select, image) */}
                  {!['card_select', 'image'].includes(field.type) && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-600">Beispieltext im Feld</label>
                      <input value={field.placeholder_text}
                        onChange={e => updateField(idx, { placeholder_text: e.target.value })}
                        placeholder="z.B. Max Mustermann"
                        style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                        onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                    </div>
                  )}

                  {/* Default value (not for card_select, image) */}
                  {!['card_select', 'image'].includes(field.type) && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-600">Standardwert</label>
                      <input value={field.default_value}
                        onChange={e => updateField(idx, { default_value: e.target.value })}
                        placeholder="Wenn Feld leer bleibt…"
                        style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                        onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                    </div>
                  )}

                  {/* Max length (text/textarea only) */}
                  {['text', 'textarea', 'url', 'email'].includes(field.type) && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-600">Max. Zeichen</label>
                      <input type="number" value={field.max_length ?? ''}
                        onChange={e => updateField(idx, { max_length: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Kein Limit" min={1} max={10000}
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
                      <div className="w-4 h-4 rounded-[4px] flex items-center justify-center flex-shrink-0"
                        style={{ background: field.required ? '#DC2626' : '#E5E7EB' }}>
                        {field.required && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        )}
                      </div>
                      {field.required ? 'Pflichtfeld' : 'Optional'}
                    </button>
                  </div>
                </div>

                {/* ── Dropdown options ── */}
                {field.type === 'dropdown' && (
                  <div className="mt-4 flex flex-col gap-2">
                    <label className="text-xs font-medium text-gray-600">Auswahloptionen (eine pro Zeile)</label>
                    <textarea
                      value={field.options.join('\n')}
                      onChange={e => updateField(idx, { options: e.target.value.split('\n') })}
                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                      rows={4}
                      style={{ ...inputStyle, resize: 'vertical' }}
                      onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                    <p className="text-xs text-gray-400">
                      Im Template: <code className="bg-gray-100 px-1 rounded">{`{{#if ${field.key || 'key'}=option1}}`}</code>…<code className="bg-gray-100 px-1 rounded">{`{{/if}}`}</code>
                    </p>
                  </div>
                )}

                {/* ── Card options ── */}
                {field.type === 'card_select' && (
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-600">
                        Cards ({field.card_options?.length ?? 0})
                      </label>
                      <button type="button" onClick={() => addCardOption(idx)}
                        className="text-xs px-3 py-1.5 rounded-[10px] font-medium transition-all"
                        style={{ background: '#1a1a1a', color: 'white' }}>
                        + Card hinzufügen
                      </button>
                    </div>

                    {(field.card_options ?? []).length === 0 && (
                      <div className="text-center py-6 text-sm text-gray-400 rounded-[14px]"
                        style={{ border: '2px dashed #E5E7EB' }}>
                        Noch keine Cards — klicke auf &ldquo;Card hinzufügen&rdquo;
                      </div>
                    )}

                    {(field.card_options ?? []).map((opt, oi) => (
                      <CardOptionEditor
                        key={oi}
                        option={opt}
                        index={oi}
                        onUpdate={patch => updateCardOption(idx, oi, patch)}
                        onRemove={() => removeCardOption(idx, oi)}
                      />
                    ))}

                    {(field.card_options ?? []).length > 0 && (
                      <p className="text-xs text-gray-400">
                        Im Template: <code className="bg-gray-100 px-1 rounded">{`{{#if ${field.key || 'key'}=${field.card_options[0]?.value || 'wert'}}}`}</code>…<code className="bg-gray-100 px-1 rounded">{`{{/if}}`}</code>
                      </p>
                    )}
                  </div>
                )}

                {!isValid && (
                  <p className="text-xs mt-3 text-orange-600">
                    ⚠ Key und Bezeichnung sind Pflicht.
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
        style={{ border: '1.5px dashed #D1D5DB', color: '#6B7280', background: 'transparent' }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = '#1a1a1a'; el.style.color = '#1a1a1a'; el.style.background = '#F9FAFB'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.borderColor = '#D1D5DB'; el.style.color = '#6B7280'; el.style.background = 'transparent'
        }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Feld hinzufügen
      </button>
    </div>
  )
}
