'use client'

/**
 * RichTextField — laypeople-friendly WYSIWYG editor.
 * Toolbar: Bold, Italic, Underline (via mark), Bullet list, Numbered list, Link, Clear.
 * Output: clean HTML (paragraphs + inline formatting + lists).
 *
 * The field stores HTML in the underlying data string. The template engine
 * substitutes this HTML directly into the page where the placeholder lives.
 */

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState, useCallback, useRef } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  maxLength?: number | null
  /** Enable AI compliance check (EU Health Claims Regulation) */
  complianceCheck?: boolean
  /** True when the text has been approved and should be shown as read-only */
  complianceApproved?: boolean
  /** Called when compliance check passes — parent should set the approved flag */
  onComplianceApproved?: (approvedHtml: string) => void
  /** Called when user clicks "Bearbeiten" — parent should clear the approved flag */
  onComplianceRevoked?: () => void
}

type CheckState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; checkedHash: string }
  | { status: 'issues'; checkedHash: string; issues: Array<{ quote: string; reason: string }>; suggested_html: string }
  | { status: 'error'; message: string }

function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h.toString(36)
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function hashText(html: string): string {
  return hash(stripHtml(html))
}

export function RichTextField({
  value, onChange, placeholder, maxLength,
  complianceCheck, complianceApproved, onComplianceApproved, onComplianceRevoked,
}: Props) {
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [checkState, setCheckState] = useState<CheckState>({ status: 'idle' })
  const resultRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        blockquote: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder: placeholder ?? 'Hier schreiben…' }),
    ],
    content: value || '',
    editorProps: { attributes: { class: 'rt-content' } },
    onUpdate: ({ editor }) => {
      if (!initializedRef.current) return
      const html = editor.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const incoming = value || '<p></p>'
    if (current !== incoming && current.replace(/<p><\/p>/g, '') !== incoming.replace(/<p><\/p>/g, '')) {
      editor.commands.setContent(incoming, { emitUpdate: false })
    }
    initializedRef.current = true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor])

  const addLink = useCallback(() => {
    if (!editor) return
    const url = linkUrl.trim()
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      const full = /^https?:\/\//i.test(url) ? url : `https://${url}`
      editor.chain().focus().extendMarkRange('link').setLink({ href: full }).run()
    }
    setLinkUrl('')
    setShowLinkInput(false)
  }, [editor, linkUrl])

  const runComplianceCheck = useCallback(async () => {
    if (!editor) return
    const html = editor.getHTML()
    setCheckState({ status: 'loading' })
    try {
      const res = await fetch('/api/check-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCheckState({ status: 'error', message: data.error ?? 'Prüfung fehlgeschlagen' })
        return
      }
      const h = hashText(html)
      if (data.ok) {
        setCheckState({ status: 'ok', checkedHash: h })
        onComplianceApproved?.(html)
      } else {
        setCheckState({
          status: 'issues',
          checkedHash: h,
          issues: data.issues ?? [],
          suggested_html: data.suggested_html ?? '',
        })
      }
    } catch (e) {
      setCheckState({ status: 'error', message: e instanceof Error ? e.message : 'Netzwerk-Fehler' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, onComplianceApproved])

  const applySuggestion = useCallback(() => {
    if (!editor || checkState.status !== 'issues') return
    const suggestedHtml = checkState.suggested_html
    editor.commands.setContent(suggestedHtml)
    onChange(suggestedHtml)
    const h = hashText(suggestedHtml)
    setCheckState({ status: 'ok', checkedHash: h })
    onComplianceApproved?.(suggestedHtml)
  }, [editor, checkState, onChange, onComplianceApproved])

  // Scroll result into view on mobile when issues appear
  useEffect(() => {
    if (checkState.status === 'issues' && resultRef.current) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkState.status])

  const currentHash = editor ? hashText(editor.getHTML()) : hashText(value || '')
  const lastCheckedHash = checkState.status === 'ok' || checkState.status === 'issues' ? checkState.checkedHash : null
  const needsRecheck = lastCheckedHash !== null && lastCheckedHash !== currentHash

  // ── Approved / locked view ──────────────────────────────────────────────────
  if (complianceCheck && complianceApproved) {
    return (
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 15px',
          background: 'rgba(194,166,203,0.07)',
          border: '1.5px solid rgba(194,166,203,0.3)',
          borderRadius: 13, marginBottom: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#3D2645' }}>EU-Health-Claims-Check bestanden</div>
            <div style={{ fontSize: 11.5, color: '#9C7DAA', marginTop: 2 }}>Freigegeben zur Veröffentlichung.</div>
          </div>
          <button onClick={onComplianceRevoked} style={{
            fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 8,
            border: '1.5px solid rgba(194,166,203,0.35)', background: '#fff', color: '#9C7DAA',
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'background 0.15s',
          }}>
            Bearbeiten
          </button>
        </div>
        <div style={{
          border: '1.5px solid #E5E7EB', borderRadius: 14, padding: '14px 16px',
          background: '#FAFAFA', fontSize: 14, color: '#374151', lineHeight: '1.6',
        }} dangerouslySetInnerHTML={{ __html: value || '' }} />
      </div>
    )
  }

  if (!editor) {
    return (
      <div className="w-full rounded-2xl bg-white"
        style={{ border: '1.5px solid #E5E7EB', minHeight: 200, padding: 16 }}>
        <p className="text-sm text-gray-300">Editor lädt…</p>
      </div>
    )
  }

  const isActive = (m: string) => editor.isActive(m)
  const textLength = editor.state.doc.textContent.length
  const overLimit = maxLength != null && textLength > maxLength
  const isScanning = checkState.status === 'loading'

  const btn = (active: boolean) => ({
    background: active ? '#1a1a1a' : 'transparent',
    color: active ? '#fff' : '#374151',
  })

  return (
    <div>
      {/* ── Editor ── */}
      <div className={`rt-wrap${isScanning ? ' rt-wrap--scan' : ''}`}>
        {/* Toolbar */}
        <div className="rt-toolbar">
          <button type="button" title="Fett (Cmd+B)"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className="rt-btn" style={btn(isActive('bold'))}>
            <strong style={{ fontFamily: 'Georgia, serif' }}>B</strong>
          </button>
          <button type="button" title="Kursiv (Cmd+I)"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className="rt-btn" style={btn(isActive('italic'))}>
            <em style={{ fontFamily: 'Georgia, serif' }}>I</em>
          </button>
          <button type="button" title="Durchgestrichen"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className="rt-btn" style={btn(isActive('strike'))}>
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </button>

          <div className="rt-sep" />

          <button type="button" title="Aufzählung"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className="rt-btn" style={btn(isActive('bulletList'))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
              <circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/>
            </svg>
          </button>
          <button type="button" title="Nummerierte Liste"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className="rt-btn" style={btn(isActive('orderedList'))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
              <text x="3" y="9" fontSize="7" fill="currentColor" fontWeight="700">1</text>
              <text x="3" y="15" fontSize="7" fill="currentColor" fontWeight="700">2</text>
              <text x="3" y="21" fontSize="7" fill="currentColor" fontWeight="700">3</text>
            </svg>
          </button>

          <div className="rt-sep" />

          <button type="button" title="Link einfügen"
            onClick={() => {
              const prev = editor.getAttributes('link').href as string | undefined
              setLinkUrl(prev ?? '')
              setShowLinkInput(s => !s)
            }}
            className="rt-btn" style={btn(isActive('link') || showLinkInput)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
          </button>

          <div className="rt-spacer" />

          <button type="button" title="Formatierung entfernen"
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            className="rt-btn rt-btn--ghost">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7V5h14v2"/><path d="M3 17l6-6 4 4 6-6"/><path d="M14 5l-4 14"/>
            </svg>
          </button>
        </div>

        {showLinkInput && (
          <div className="rt-link-row">
            <input
              type="url" autoFocus value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addLink() }
                if (e.key === 'Escape') { setShowLinkInput(false); setLinkUrl('') }
              }}
              placeholder="https://… oder leer lassen, um Link zu entfernen"
              className="rt-link-input"
            />
            <button type="button" onClick={addLink} className="rt-link-apply">
              {linkUrl ? 'Anwenden' : 'Entfernen'}
            </button>
          </div>
        )}

        {/* Content + scan overlay */}
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <EditorContent editor={editor} />
          {isScanning && <div className="rt-scan-beam" aria-hidden="true" />}
        </div>

        {/* Footer: char count + compliance control */}
        <div className="rt-footer">
          <span style={{ color: overLimit ? '#DC2626' : '#9CA3AF' }}>
            {maxLength != null ? `${textLength}/${maxLength} Zeichen` : ''}
          </span>

          {complianceCheck && (
            <div className="rt-comp-ctrl">
              {isScanning && (
                <span className="rt-comp-scanning">
                  <span className="rt-dot" style={{ animationDelay: '0s' }} />
                  <span className="rt-dot" style={{ animationDelay: '0.18s' }} />
                  <span className="rt-dot" style={{ animationDelay: '0.36s' }} />
                  <span>Analysiert…</span>
                </span>
              )}
              {!isScanning && (checkState.status === 'idle' || needsRecheck) && (
                <button type="button" onClick={runComplianceCheck} className="rt-comp-btn">
                  {needsRecheck ? 'Erneut prüfen' : 'EU-Check'} →
                </button>
              )}
              {!isScanning && checkState.status === 'ok' && !needsRecheck && (
                <span className="rt-comp-ok-label">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6l3 3 5-5"/>
                  </svg>
                  Kein Verstoß
                  <button type="button" onClick={runComplianceCheck} className="rt-comp-recheck">erneut prüfen</button>
                </span>
              )}
              {!isScanning && checkState.status === 'issues' && !needsRecheck && (
                <span className="rt-comp-hint">↓ KI-Vorschlag</span>
              )}
              {!isScanning && checkState.status === 'error' && (
                <button type="button" onClick={runComplianceCheck} className="rt-comp-btn rt-comp-btn--err">
                  Fehler — erneut versuchen →
                </button>
              )}
            </div>
          )}
        </div>

        <style jsx global>{`
          .rt-wrap {
            background: #fff;
            border: 1.5px solid #E5E7EB;
            border-radius: 16px;
            overflow: hidden;
            transition: border-color 0.2s, box-shadow 0.2s;
          }
          .rt-wrap:focus-within {
            border-color: #1a1a1a;
          }
          .rt-wrap--scan {
            border-color: #C2A6CB !important;
            box-shadow: 0 0 0 3px rgba(194,166,203,0.15), 0 0 28px rgba(194,166,203,0.1) !important;
          }
          .rt-scan-beam {
            position: absolute;
            left: 0; right: 0; height: 1.5px;
            background: linear-gradient(90deg, transparent 0%, rgba(194,166,203,0.4) 20%, #C2A6CB 50%, rgba(194,166,203,0.4) 80%, transparent 100%);
            pointer-events: none;
            animation: rt-scan 1.8s ease-in-out infinite;
            top: 0;
          }
          @keyframes rt-scan {
            0%   { top: 0;    opacity: 0; }
            6%   { opacity: 1; }
            94%  { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
          .rt-toolbar {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 8px 10px;
            border-bottom: 1px solid #F1F5F9;
            background: #FAFAFA;
            flex-wrap: wrap;
          }
          .rt-btn {
            display: inline-flex; align-items: center; justify-content: center;
            min-width: 30px; height: 30px; padding: 0 8px;
            border-radius: 8px; background: transparent; color: #374151;
            font-size: 13px; font-weight: 600; cursor: pointer;
            transition: background 0.12s, color 0.12s; border: none;
          }
          .rt-btn:hover { background: #E5E7EB; }
          .rt-btn--ghost { opacity: 0.55; }
          .rt-btn--ghost:hover { opacity: 1; }
          .rt-sep { width: 1px; height: 18px; background: #E5E7EB; margin: 0 4px; }
          .rt-spacer { flex: 1; }
          .rt-link-row {
            display: flex; gap: 6px; padding: 8px 10px;
            border-bottom: 1px solid #F1F5F9; background: #F8FAFC;
          }
          .rt-link-input {
            flex: 1; padding: 7px 10px; font-size: 13px;
            border: 1px solid #E5E7EB; border-radius: 8px; outline: none; background: #fff;
          }
          .rt-link-input:focus { border-color: #1a1a1a; }
          .rt-link-apply {
            padding: 7px 14px; font-size: 12px; font-weight: 600;
            color: #fff; background: #1a1a1a; border: none; border-radius: 8px; cursor: pointer;
          }
          .rt-content {
            min-height: 160px; padding: 14px 16px;
            font-size: 14px; line-height: 1.6; color: #1a1a1a; outline: none;
          }
          .rt-content p { margin: 0 0 6px; }
          .rt-content p:last-child { margin-bottom: 0; }
          .rt-content p + p { margin-top: 0; }
          .rt-content ul, .rt-content ol { margin: 6px 0; padding-left: 20px; }
          .rt-content li { margin-bottom: 4px; }
          .rt-content strong { font-weight: 700; }
          .rt-content em { font-style: italic; }
          .rt-content s { text-decoration: line-through; }
          .rt-content a {
            color: #1a1a1a; text-decoration: underline;
            text-decoration-color: rgba(0,0,0,0.3); text-underline-offset: 2px; cursor: pointer;
          }
          .rt-content a:hover { text-decoration-color: currentColor; }
          .rt-content p.is-editor-empty:first-child::before {
            content: attr(data-placeholder); color: #9CA3AF;
            float: left; height: 0; pointer-events: none;
          }
          .rt-footer {
            display: flex; align-items: center; justify-content: space-between; gap: 12px;
            padding: 8px 12px; font-size: 11px; color: #9CA3AF;
            border-top: 1px solid #F1F5F9; background: #FAFAFA; min-height: 38px;
          }
          /* Compliance controls in footer */
          .rt-comp-ctrl {
            display: flex; align-items: center; gap: 6px; flex-shrink: 0;
          }
          .rt-comp-btn {
            font-size: 11.5px; font-weight: 600;
            color: #C2A6CB; background: transparent; border: none;
            cursor: pointer; padding: 4px 8px; border-radius: 6px;
            transition: color 0.15s, background 0.15s; letter-spacing: 0.01em;
            white-space: nowrap;
          }
          .rt-comp-btn:hover { color: #3D2645; background: rgba(194,166,203,0.1); }
          .rt-comp-btn--err { color: #DC2626; }
          .rt-comp-btn--err:hover { background: #FEF2F2; color: #B91C1C; }
          .rt-comp-scanning {
            display: flex; align-items: center; gap: 4px;
            font-size: 11px; color: #9CA3AF;
          }
          .rt-dot {
            display: inline-block; width: 5px; height: 5px;
            border-radius: 50%; background: #C2A6CB;
            animation: rt-dot-pulse 1.2s ease-in-out infinite;
          }
          @keyframes rt-dot-pulse {
            0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
            40% { transform: scale(1); opacity: 1; }
          }
          .rt-comp-ok-label {
            display: flex; align-items: center; gap: 5px;
            font-size: 11.5px; font-weight: 600; color: #16A34A;
          }
          .rt-comp-recheck {
            font-size: 11px; color: #9CA3AF; background: none; border: none;
            cursor: pointer; padding: 0; text-decoration: underline;
            text-decoration-color: rgba(0,0,0,0.15);
          }
          .rt-comp-recheck:hover { color: #6B7280; }
          .rt-comp-hint {
            font-size: 11px; font-weight: 500; color: #C2A6CB; letter-spacing: 0.01em;
          }
        `}</style>
      </div>

      {/* ── Result card (directly below editor) ── */}
      {complianceCheck && (checkState.status === 'issues' || checkState.status === 'error') && !needsRecheck && (
        <div ref={resultRef}>
          <ComplianceResult
            state={checkState}
            onApply={applySuggestion}
            onRecheck={runComplianceCheck}
          />
        </div>
      )}
    </div>
  )
}

// ── Compliance result card ────────────────────────────────────────────────────

function ComplianceResult({
  state, onApply, onRecheck,
}: {
  state: CheckState
  onApply: () => void
  onRecheck: () => void
}) {
  if (state.status === 'error') {
    return (
      <div style={{
        marginTop: 8, padding: '14px 16px',
        background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 13,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#7F1D1D', marginBottom: 4 }}>Prüfung fehlgeschlagen</div>
        <div style={{ fontSize: 12.5, color: '#B91C1C', marginBottom: 12 }}>{state.message}</div>
        <button onClick={onRecheck} style={{
          fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9,
          border: 'none', background: '#1A1A1A', color: '#fff', cursor: 'pointer',
        }}>Erneut versuchen</button>
      </div>
    )
  }

  if (state.status !== 'issues') return null

  return (
    <div className="rtc-card">
      {/* Issues found */}
      <div className="rtc-section">
        <div className="rtc-label">Überarbeitete Stellen</div>
        <ul className="rtc-issues">
          {state.issues.map((issue, i) => (
            <li key={i} className="rtc-issue">
              <span className="rtc-quote">„{issue.quote}&quot;</span>
              <span className="rtc-reason">{issue.reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Suggested replacement */}
      {state.suggested_html && (
        <div className="rtc-section">
          <div className="rtc-label">Vorgeschlagener Text</div>
          <div className="rtc-text" dangerouslySetInnerHTML={{ __html: state.suggested_html }} />
        </div>
      )}

      {/* Actions */}
      <div className="rtc-actions">
        {state.suggested_html && (
          <button onClick={onApply} className="rtc-apply">
            Vorschlag übernehmen
          </button>
        )}
        <button onClick={onRecheck} className="rtc-skip">Selbst bearbeiten</button>
      </div>

      <style jsx>{`
        .rtc-card {
          margin-top: 8px;
          background: #fff;
          border: 1.5px solid rgba(194,166,203,0.35);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(194,166,203,0.12), 0 1px 4px rgba(0,0,0,0.04);
          animation: rtc-in 0.22s ease-out;
        }
        @keyframes rtc-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rtc-section {
          padding: 16px 18px;
          border-bottom: 1px solid rgba(194,166,203,0.15);
        }
        .rtc-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.09em;
          text-transform: uppercase; color: #C2A6CB; margin-bottom: 10px;
        }
        .rtc-issues {
          margin: 0; padding: 0; list-style: none;
          display: flex; flex-direction: column; gap: 7px;
        }
        .rtc-issue {
          padding: 10px 12px;
          background: rgba(194,166,203,0.06);
          border: 1px solid rgba(194,166,203,0.22);
          border-radius: 10px;
          display: flex; flex-direction: column; gap: 3px;
        }
        .rtc-quote { font-size: 12.5px; font-weight: 600; color: #3D2645; line-height: 1.4; }
        .rtc-reason { font-size: 12px; color: #9C7DAA; line-height: 1.45; }
        .rtc-text {
          background: rgba(194,166,203,0.05);
          border: 1.5px solid rgba(194,166,203,0.25);
          border-radius: 12px;
          padding: 14px 16px;
          font-size: 14px; line-height: 1.65; color: #374151;
        }
        .rtc-text :global(p) { margin: 0 0 10px; }
        .rtc-text :global(p:last-child) { margin-bottom: 0; }
        .rtc-text :global(strong) { font-weight: 700; }
        .rtc-text :global(em) { font-style: italic; }
        .rtc-text :global(ul), .rtc-text :global(ol) { margin: 0 0 10px; padding-left: 22px; }
        .rtc-actions {
          padding: 16px 18px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .rtc-apply {
          display: flex; align-items: center; justify-content: center;
          width: 100%; padding: 15px 20px;
          font-size: 15px; font-weight: 700;
          background: #1A1A1A; color: #fff;
          border: none; border-radius: 12px; cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          min-height: 52px;
          box-shadow: 0 4px 14px rgba(194,166,203,0.25);
        }
        .rtc-apply:hover { opacity: 0.9; }
        .rtc-apply:active { transform: scale(0.98); }
        .rtc-skip {
          width: 100%; padding: 11px 20px;
          font-size: 13px; font-weight: 500;
          background: transparent; color: #C2A6CB;
          border: none; cursor: pointer;
          transition: color 0.15s; text-align: center;
        }
        .rtc-skip:hover { color: #3D2645; }
      `}</style>
    </div>
  )
}
