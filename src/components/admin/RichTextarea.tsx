'use client'

import { useRef, useState, useCallback, KeyboardEvent } from 'react'

interface RichTextareaProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  rows?: number
}

export default function RichTextarea({ value, onChange, placeholder, rows = 10 }: RichTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [linkMode, setLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [savedSel, setSavedSel] = useState<{ start: number; end: number } | null>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)

  // Wrap currently selected text in the textarea
  const wrapSelection = useCallback((before: string, after: string, fallback = '') => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end) || fallback
    const newVal = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(newVal)
    const cursor = start + before.length + selected.length
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + before.length, cursor)
    }, 0)
  }, [value, onChange])

  function handleBold() {
    wrapSelection('**', '**', 'Fett')
  }

  function handleLinkClick() {
    const el = ref.current
    if (!el) return
    setSavedSel({ start: el.selectionStart, end: el.selectionEnd })
    setLinkUrl('')
    setLinkMode(true)
    setTimeout(() => linkInputRef.current?.focus(), 50)
  }

  function confirmLink() {
    if (!savedSel || !linkUrl.trim()) { cancelLink(); return }
    const el = ref.current
    if (!el) return
    const { start, end } = savedSel
    const selected = value.slice(start, end) || 'Hier klicken'
    const url = /^https?:\/\//i.test(linkUrl.trim()) ? linkUrl.trim() : `https://${linkUrl.trim()}`
    const markup = `[${selected}](${url})`
    const newVal = value.slice(0, start) + markup + value.slice(end)
    onChange(newVal)
    cancelLink()
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + markup.length, start + markup.length)
    }, 50)
  }

  function cancelLink() {
    setLinkMode(false)
    setLinkUrl('')
    setSavedSel(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault()
      handleBold()
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      handleLinkClick()
    }
  }

  const toolbarBtnStyle = (active?: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 28,
    borderRadius: 6,
    border: '1px solid #E5E7EB',
    background: active ? '#F3F4F6' : '#fff',
    color: '#374151',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'monospace',
    transition: 'background 0.15s',
    flexShrink: 0,
  })

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <button
          type="button"
          title="Fett (⌘B)"
          onMouseDown={e => { e.preventDefault(); handleBold() }}
          style={toolbarBtnStyle()}
        >
          B
        </button>
        <button
          type="button"
          title="Link einfügen (⌘K)"
          onMouseDown={e => { e.preventDefault(); handleLinkClick() }}
          style={toolbarBtnStyle(linkMode)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </button>
        <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 6 }}>
          **fett** · [Text](URL)
        </span>
      </div>

      {/* Link prompt */}
      {linkMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
          padding: '8px 10px', borderRadius: 10,
          background: '#F0F9FF', border: '1px solid #BAE6FD',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0369A1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <input
            ref={linkInputRef}
            type="url"
            placeholder="https://finestsites.io/..."
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); confirmLink() }
              if (e.key === 'Escape') cancelLink()
            }}
            style={{
              flex: 1, minWidth: 0,
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, color: '#0C4A6E', fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={confirmLink}
            style={{
              padding: '3px 10px', borderRadius: 6, border: 'none',
              background: '#0369A1', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}
          >
            Einfügen
          </button>
          <button
            type="button"
            onClick={cancelLink}
            style={{
              padding: '3px 8px', borderRadius: 6, border: '1px solid #BAE6FD',
              background: 'transparent', color: '#0369A1',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className="w-full text-sm px-4 py-3 rounded-xl outline-none resize-none font-mono"
        style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA', lineHeight: 1.7 }}
        onFocus={e => (e.target.style.borderColor = '#111')}
        onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
      />
    </div>
  )
}
