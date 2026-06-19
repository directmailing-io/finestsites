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

export interface LoopSubField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'image' | 'url' | 'email' | 'dropdown'
  required?: boolean
  placeholder_text?: string
  max_length?: number | null
  default_value?: string
  aspect_ratio?: string
  options?: string[]
}

export interface PlaceholderField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'richtext' | 'image' | 'url' | 'email' | 'dropdown' | 'card_select' | 'loop'
  required: boolean
  default_value: string
  placeholder_text: string
  max_length: number | null
  options: string[]
  card_options: CardOption[]
  section: string
  order: number
  aspect_ratio?: string
  sub_fields?: LoopSubField[]
  min_items?: number
  max_items?: number | null
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<PlaceholderField['type'], string> = {
  text:        'Text (einzeilig)',
  textarea:    'Text (mehrzeilig)',
  richtext:    'Rich-Text (WYSIWYG)',
  image:       'Bild-Upload',
  url:         'URL / Link',
  email:       'E-Mail',
  dropdown:    'Dropdown-Auswahl',
  card_select: 'Card-Auswahl',
  loop:        'Loop (Liste)',
}

const TYPE_COLORS: Record<PlaceholderField['type'], { bg: string; text: string }> = {
  text:        { bg: '#EFF6FF', text: '#1D4ED8' },
  textarea:    { bg: '#F5F3FF', text: '#7C3AED' },
  richtext:    { bg: '#EDE9FE', text: '#5B21B6' },
  image:       { bg: '#F0FDF4', text: '#16A34A' },
  url:         { bg: '#FEF9C3', text: '#92400E' },
  email:       { bg: '#FDF2F8', text: '#DB2777' },
  dropdown:    { bg: '#F3F4F6', text: '#374151' },
  card_select: { bg: '#FFF7ED', text: '#C2410C' },
  loop:        { bg: '#F0F9FF', text: '#0369A1' },
}

const TYPE_ICONS: Record<PlaceholderField['type'], string> = {
  text:        'T',
  textarea:    '¶',
  richtext:    'Aa',
  image:       '🖼',
  url:         '🔗',
  email:       '@',
  dropdown:    '▾',
  card_select: '◫',
  loop:        '↻',
}

const SUB_TYPE_LABELS: Record<LoopSubField['type'], string> = {
  text:     'Text',
  textarea: 'Mehrzeilig',
  image:    'Bild',
  url:      'URL',
  email:    'E-Mail',
  dropdown: 'Dropdown',
}

function newField(order: number): PlaceholderField {
  return {
    key: '', label: '', type: 'text', required: false,
    default_value: '', placeholder_text: '',
    max_length: null, options: [], card_options: [], section: '', order, aspect_ratio: 'free',
    sub_fields: [], min_items: 1, max_items: null,
  }
}

function newCardOption(): CardOption {
  return { value: '', label: '', description: '', card_type: 'text', image_url: '', color: '#6366F1' }
}

function newSubField(): LoopSubField {
  return { key: '', label: '', type: 'text', required: false, placeholder_text: '', max_length: null, default_value: '', aspect_ratio: 'free', options: [] }
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

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Card {index + 1}</span>
        <button type="button" onClick={onRemove}
          className="text-xs px-2 py-1 rounded-[8px] transition-all"
          style={{ background: '#FEF2F2', color: '#DC2626' }}>
          ✕ Entfernen
        </button>
      </div>

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

// ─── Sub-Field Editor (for loop fields) ───────────────────────────────────────

function SubFieldEditor({
  subField, index, onUpdate, onRemove, onMove, isFirst, isLast,
}: {
  subField: LoopSubField
  index: number
  onUpdate: (patch: Partial<LoopSubField>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  isFirst: boolean
  isLast: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const inputStyle = {
    background: '#F9FAFB', border: '1px solid #E5E7EB',
    borderRadius: '10px', padding: '6px 10px',
    fontSize: '12px', outline: 'none', width: '100%',
  }

  return (
    <div className="rounded-[14px] overflow-hidden"
      style={{ border: `1px solid ${expanded ? '#0369A1' : '#E0F2FE'}`, background: 'white' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
        style={{ background: '#F0F9FF' }}
        onClick={() => setExpanded(e => !e)}>

        <span className="w-5 h-5 rounded-[6px] flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: '#BAE6FD', color: '#0369A1' }}>{index + 1}</span>

        <div className="flex-1 min-w-0">
          {subField.key ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <code className="text-xs font-mono text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                {`{{this.${subField.key}}}`}
              </code>
              {subField.label && <span className="text-xs text-gray-700 font-medium">{subField.label}</span>}
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#E0F2FE', color: '#0369A1' }}>
                {SUB_TYPE_LABELS[subField.type]}
              </span>
              {subField.required && (
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#DC2626' }}>Pflicht</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">Unterfeld konfigurieren…</span>
          )}
        </div>

        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst}
            className="p-1 rounded-[6px] disabled:opacity-25" style={{ color: '#9CA3AF' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast}
            className="p-1 rounded-[6px] disabled:opacity-25" style={{ color: '#9CA3AF' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <button type="button" onClick={onRemove}
            className="p-1 rounded-[6px]" style={{ color: '#9CA3AF' }}
            onMouseEnter={e => ((e.target as HTMLElement).style.color = '#DC2626')}
            onMouseLeave={e => ((e.target as HTMLElement).style.color = '#9CA3AF')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
          </button>
          <button type="button" onClick={() => setExpanded(e => !e)}
            className="p-1 rounded-[6px]" style={{ color: '#9CA3AF' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-3 pb-3 pt-2.5 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Feld-Key *</label>
              <input value={subField.key}
                onChange={e => onUpdate({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                placeholder="z.B. name" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#0369A1')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
              {subField.key && <code className="text-xs text-gray-400">{`{{this.${subField.key}}}`}</code>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Bezeichnung *</label>
              <input value={subField.label}
                onChange={e => onUpdate({ label: e.target.value })}
                placeholder="z.B. Name" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#0369A1')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Typ</label>
              <select value={subField.type}
                onChange={e => onUpdate({ type: e.target.value as LoopSubField['type'] })}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                {(Object.keys(SUB_TYPE_LABELS) as LoopSubField['type'][]).map(t => (
                  <option key={t} value={t}>{SUB_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Pflichtfeld</label>
              <button type="button"
                onClick={() => onUpdate({ required: !subField.required })}
                className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs transition-all text-left"
                style={{
                  background: subField.required ? '#FEF2F2' : '#F9FAFB',
                  border: `1px solid ${subField.required ? '#FECACA' : '#E5E7EB'}`,
                  color: subField.required ? '#DC2626' : '#6B7280',
                }}>
                <div className="w-3.5 h-3.5 rounded-[3px] flex items-center justify-center flex-shrink-0"
                  style={{ background: subField.required ? '#DC2626' : '#E5E7EB' }}>
                  {subField.required && (
                    <svg width="8" height="7" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
                {subField.required ? 'Pflicht' : 'Optional'}
              </button>
            </div>

            {subField.type !== 'image' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Beispieltext</label>
                <input value={subField.placeholder_text ?? ''}
                  onChange={e => onUpdate({ placeholder_text: e.target.value })}
                  placeholder="z.B. Max Mustermann" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#0369A1')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
              </div>
            )}

            {['text', 'textarea', 'richtext', 'url', 'email'].includes(subField.type) && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Max. Zeichen</label>
                <input type="number" value={subField.max_length ?? ''}
                  onChange={e => onUpdate({ max_length: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Kein Limit" min={1} style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#0369A1')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
              </div>
            )}
          </div>

          {subField.type === 'image' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Seitenverhältnis</label>
              <div className="flex gap-1.5 flex-wrap">
                {(['free', '1/1', '4/3', '16/9', '3/2', '9/16'] as const).map(ar => (
                  <button key={ar} type="button"
                    onClick={() => onUpdate({ aspect_ratio: ar })}
                    className="px-2.5 py-1 text-xs font-medium rounded-[8px] transition-all"
                    style={{
                      background: (subField.aspect_ratio ?? 'free') === ar ? '#0369A1' : '#F3F4F6',
                      color: (subField.aspect_ratio ?? 'free') === ar ? 'white' : '#6B7280',
                    }}>
                    {ar === 'free' ? 'Frei' : ar}
                  </button>
                ))}
              </div>
            </div>
          )}

          {subField.type === 'dropdown' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Optionen (eine pro Zeile)</label>
              <textarea
                value={(subField.options ?? []).join('\n')}
                onChange={e => onUpdate({ options: e.target.value.split('\n') })}
                placeholder="Option 1&#10;Option 2"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={e => (e.target.style.borderColor = '#0369A1')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            </div>
          )}
        </div>
      )}
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

  function addSubField(fieldIdx: number) {
    const field = fields[fieldIdx]
    updateField(fieldIdx, { sub_fields: [...(field.sub_fields ?? []), newSubField()] })
  }

  function updateSubField(fieldIdx: number, subIdx: number, patch: Partial<LoopSubField>) {
    const field = fields[fieldIdx]
    const updated = (field.sub_fields ?? []).map((sf, i) => i === subIdx ? { ...sf, ...patch } : sf)
    updateField(fieldIdx, { sub_fields: updated })
  }

  function removeSubField(fieldIdx: number, subIdx: number) {
    const field = fields[fieldIdx]
    updateField(fieldIdx, { sub_fields: (field.sub_fields ?? []).filter((_, i) => i !== subIdx) })
  }

  function moveSubField(fieldIdx: number, subIdx: number, dir: -1 | 1) {
    const field = fields[fieldIdx]
    const subs = [...(field.sub_fields ?? [])]
    const target = subIdx + dir
    if (target < 0 || target >= subs.length) return
    ;[subs[subIdx], subs[target]] = [subs[target], subs[subIdx]]
    updateField(fieldIdx, { sub_fields: subs })
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
        <code className="bg-indigo-100 px-1 rounded">{'{{#if key=wert}}'}</code>…<code className="bg-indigo-100 px-1 rounded">{'{{/if}}'}</code> → bedingt,{' '}
        <code className="bg-indigo-100 px-1 rounded">{'{{#each key}}'}</code>…<code className="bg-indigo-100 px-1 rounded">{'{{this.feld}}'}</code>…<code className="bg-indigo-100 px-1 rounded">{'{{/each}}'}</code> → Loop
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
                    <code className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">
                      {field.type === 'loop' ? `{{#each ${field.key}}}` : `{{${field.key}}}`}
                    </code>
                    {field.label && <span className="text-sm text-gray-700 font-medium">{field.label}</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: color.bg, color: color.text }}>
                      {TYPE_LABELS[field.type]}
                    </span>
                    {field.type === 'loop' && (field.sub_fields?.length ?? 0) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#E0F2FE', color: '#0369A1' }}>
                        {field.sub_fields!.length} Unterfelder
                      </span>
                    )}
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
                      placeholder="z.B. team_mitglieder"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                    {field.key && (
                      <code className="text-xs text-gray-400">
                        {field.type === 'loop' ? `{{#each ${field.key}}}…{{/each}}` : `{{${field.key}}}`}
                      </code>
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Bezeichnung (für User) *</label>
                    <input value={field.label}
                      onChange={e => updateField(idx, { label: e.target.value })}
                      placeholder="z.B. Team-Mitglieder"
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
                      placeholder="z.B. Team"
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                  </div>

                  {/* Loop: min/max items */}
                  {field.type === 'loop' && (
                    <>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">Min. Einträge</label>
                        <input type="number" value={field.min_items ?? 1}
                          onChange={e => updateField(idx, { min_items: e.target.value ? parseInt(e.target.value) : 1 })}
                          min={0} max={20}
                          style={inputStyle}
                          onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                          onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">Max. Einträge</label>
                        <input type="number" value={field.max_items ?? ''}
                          onChange={e => updateField(idx, { max_items: e.target.value ? parseInt(e.target.value) : null })}
                          min={1} max={100} placeholder="Kein Limit"
                          style={inputStyle}
                          onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
                          onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                      </div>
                    </>
                  )}

                  {/* Aspect ratio — only for image fields */}
                  {field.type === 'image' && (
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-xs font-medium text-gray-600">Seitenverhältnis (Zuschnitt)</label>
                      <div className="flex gap-2 flex-wrap">
                        {(['free', '1/1', '4/3', '16/9', '3/2', '9/16'] as const).map(ar => (
                          <button key={ar} type="button"
                            onClick={() => updateField(idx, { aspect_ratio: ar })}
                            className="px-3 py-1.5 text-xs font-medium rounded-[10px] transition-all"
                            style={{
                              background: (field.aspect_ratio ?? 'free') === ar ? '#1a1a1a' : '#F3F4F6',
                              color: (field.aspect_ratio ?? 'free') === ar ? 'white' : '#6B7280',
                            }}>
                            {ar === 'free' ? 'Frei' : ar}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Placeholder text (not for card_select, image, loop) */}
                  {!['card_select', 'image', 'loop'].includes(field.type) && (
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

                  {/* Default value (not for card_select, image, loop) */}
                  {!['card_select', 'image', 'loop'].includes(field.type) && (
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
                  {['text', 'textarea', 'richtext', 'url', 'email'].includes(field.type) && (
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

                  {/* Required toggle (not for loop) */}
                  {field.type !== 'loop' && (
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
                  )}
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

                {/* ── Loop sub-fields ── */}
                {field.type === 'loop' && (
                  <div className="mt-4 flex flex-col gap-3">

                    {/* Info banner */}
                    <div className="px-3 py-2.5 rounded-[12px] text-xs flex gap-2"
                      style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1' }}>
                      <span className="flex-shrink-0">ℹ</span>
                      <span>
                        User können mehrere Einträge hinzufügen. Im Template:{' '}
                        <code className="bg-sky-100 px-1 rounded">{`{{#each ${field.key || 'key'}}}`}</code>
                        {' '}…{' '}
                        <code className="bg-sky-100 px-1 rounded">{'{{this.feldname}}'}</code>
                        {' '}…{' '}
                        <code className="bg-sky-100 px-1 rounded">{'{{/each}}'}</code>
                        {'. '}Index via <code className="bg-sky-100 px-1 rounded">{'{{@index}}'}</code>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-600">
                        Unterfelder ({field.sub_fields?.length ?? 0})
                      </label>
                      <button type="button" onClick={() => addSubField(idx)}
                        className="text-xs px-3 py-1.5 rounded-[10px] font-medium transition-all"
                        style={{ background: '#0369A1', color: 'white' }}>
                        + Unterfeld hinzufügen
                      </button>
                    </div>

                    {(field.sub_fields ?? []).length === 0 && (
                      <div className="text-center py-6 text-sm text-gray-400 rounded-[14px]"
                        style={{ border: '2px dashed #BAE6FD' }}>
                        Noch keine Unterfelder — klicke auf &ldquo;Unterfeld hinzufügen&rdquo;
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      {(field.sub_fields ?? []).map((sf, si) => (
                        <SubFieldEditor
                          key={si}
                          subField={sf}
                          index={si}
                          onUpdate={patch => updateSubField(idx, si, patch)}
                          onRemove={() => removeSubField(idx, si)}
                          onMove={dir => moveSubField(idx, si, dir)}
                          isFirst={si === 0}
                          isLast={si === (field.sub_fields?.length ?? 0) - 1}
                        />
                      ))}
                    </div>
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
