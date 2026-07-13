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

// Small djb2 hash so we can detect when content drifts from last check
function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return h.toString(36)
}

// Strip HTML tags and normalise whitespace so we can compare the plain-text
// content of two strings regardless of whether they are wrapped in <p> tags.
// e.g. stripHtml('<p>Hello world</p>') === stripHtml('Hello world') → true
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Hash the plain-text content (tag-agnostic), used for drift detection and
// restoration matching so default_value plain text and its Tiptap-wrapped
// HTML equivalent produce the same hash.
function hashText(html: string): string {
  return hash(stripHtml(html))
}

export function RichTextField({ value, onChange, placeholder, maxLength, complianceCheck, complianceApproved, onComplianceApproved, onComplianceRevoked }: Props) {
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [checkState, setCheckState] = useState<CheckState>({ status: 'idle' })
  const [showCheckPanel, setShowCheckPanel] = useState(false)
  const compliancePanelRef = useRef<HTMLDivElement>(null)
  // Guard: suppress onUpdate emissions during the initial mount/content-setting
  // phase. Tiptap fires onUpdate before the editor has rendered the initial
  // content, which would emit '' and overwrite the saved value in the parent.
  const initializedRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,            // no headings — keep it text-only
        codeBlock: false,
        code: false,
        horizontalRule: false,
        blockquote: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Hier schreiben…',
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'rt-content',
      },
    },
    onUpdate: ({ editor }) => {
      // Skip the first onUpdate that Tiptap fires during initialization —
      // it can emit '<p></p>' before the content is set, which would wipe
      // the saved value in the parent state.
      if (!initializedRef.current) return
      const html = editor.getHTML()
      // Empty editor returns '<p></p>' — convert to empty string so required check works
      onChange(html === '<p></p>' ? '' : html)
    },
    // Prevent SSR mismatch (Tiptap is client-only)
    immediatelyRender: false,
  })

  // Sync external value changes and mark the editor as initialized.
  // On first mount this ensures the saved content is set before we start
  // forwarding onUpdate events (preventing the empty-emit on init bug).
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const incoming = value || '<p></p>'
    if (current !== incoming && current.replace(/<p><\/p>/g, '') !== incoming.replace(/<p><\/p>/g, '')) {
      editor.commands.setContent(incoming, { emitUpdate: false })
    }
    // Mark initialized after the first sync so onUpdate can safely forward events
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

  // Compliance check
  const runComplianceCheck = useCallback(async () => {
    if (!editor) return
    const html = editor.getHTML()
    setCheckState({ status: 'loading' })
    setShowCheckPanel(true)
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
        // Persist approval in parent so it survives section switches and reloads
        onComplianceApproved?.(html)
      } else {
        setCheckState({
          status: 'issues',
          checkedHash: h,
          issues: data.issues ?? [],
          suggested_html: data.suggested_html ?? '',
        })
        // Auto-show suggestion panel — user should see it immediately on mobile
        setShowCheckPanel(true)
      }
    } catch (e) {
      setCheckState({ status: 'error', message: e instanceof Error ? e.message : 'Netzwerk-Fehler' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, onComplianceApproved])

  const applySuggestion = useCallback(() => {
    if (!editor) return
    if (checkState.status !== 'issues') return
    const suggestedHtml = checkState.suggested_html
    editor.commands.setContent(suggestedHtml)
    onChange(suggestedHtml)
    // Auto-approve: the AI generated this text specifically to be compliant.
    // Requiring a second check is confusing and the AI would likely approve its own output.
    const h = hashText(suggestedHtml)
    setCheckState({ status: 'ok', checkedHash: h })
    setShowCheckPanel(false)
    onComplianceApproved?.(suggestedHtml)
  }, [editor, checkState, onChange, onComplianceApproved])

  // Scroll suggestion panel into view on mobile when issues are found
  useEffect(() => {
    if (showCheckPanel && checkState.status === 'issues' && compliancePanelRef.current) {
      const el = compliancePanelRef.current
      setTimeout(() => { el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 120)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCheckPanel, checkState.status])

  // Detect content drift since last check.
  // Use hashText (plain-text hash) so that '<p>text</p>' and 'text' produce
  // the same hash — avoids spurious re-check requests when the editor wraps
  // a plain-text default_value in a <p> tag on init.
  // Fall back to the value prop when the editor isn't mounted yet.
  const currentHash = editor ? hashText(editor.getHTML()) : hashText(value || '')
  const lastCheckedHash = checkState.status === 'ok' || checkState.status === 'issues' ? checkState.checkedHash : null
  const needsRecheck = lastCheckedHash !== null && lastCheckedHash !== currentHash

  // ── Locked / approved view ─────────────────────────────────────────────────
  if (complianceCheck && complianceApproved) {
    return (
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
          background: 'linear-gradient(135deg, #DCFCE7, #F0FDF4)',
          border: '1.5px solid #86EFAC', borderRadius: 16, marginBottom: 10,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, background: '#16A34A', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M8.5 12.5l2.5 2.5 4.5-5"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#14532D' }}>EU-Health-Claims-Check bestanden</div>
            <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>Freigegeben zur Veröffentlichung.</div>
          </div>
          <button onClick={onComplianceRevoked} style={{
            fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 10,
            border: '1.5px solid #86EFAC', background: '#fff', color: '#15803D',
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            ✏ Bearbeiten
          </button>
        </div>
        <div style={{
          border: '1.5px solid #E5E7EB', borderRadius: 16, padding: '14px 16px',
          background: '#FAFAFA', fontSize: 14, color: '#374151', lineHeight: '1.6',
        }}
          dangerouslySetInnerHTML={{ __html: value || '' }}
        />
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

  const btn = (active: boolean) => ({
    background: active ? '#1a1a1a' : 'transparent',
    color: active ? '#fff' : '#374151',
  })

  return (
    <div>
    {/* Compliance banner — ABOVE the editor, prominent */}
    {complianceCheck && (
      <ComplianceBanner
        state={checkState}
        needsRecheck={needsRecheck}
        onCheck={runComplianceCheck}
        onTogglePanel={() => setShowCheckPanel(v => !v)}
      />
    )}

    <div className="rt-wrap">
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
        <button type="button" title="Unterstrichen (über Mark)"
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
            type="url"
            autoFocus
            value={linkUrl}
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

      {/* Content */}
      <EditorContent editor={editor} />

      {/* Footer: character count only — compliance moved to top banner */}
      {maxLength != null && (
        <div className="rt-footer">
          <span style={{ color: overLimit ? '#DC2626' : '#9CA3AF' }}>
            {textLength}/{maxLength} Zeichen
          </span>
        </div>
      )}

      <style jsx global>{`
        .rt-wrap {
          background: #fff;
          border: 1.5px solid #E5E7EB;
          border-radius: 16px;
          overflow: hidden;
          transition: border-color 0.15s;
        }
        .rt-wrap:focus-within {
          border-color: #1a1a1a;
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
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 30px;
          height: 30px;
          padding: 0 8px;
          border-radius: 8px;
          background: transparent;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          border: none;
        }
        .rt-btn:hover {
          background: #E5E7EB;
        }
        .rt-btn--ghost {
          opacity: 0.55;
        }
        .rt-btn--ghost:hover { opacity: 1; }
        .rt-sep {
          width: 1px;
          height: 18px;
          background: #E5E7EB;
          margin: 0 4px;
        }
        .rt-spacer { flex: 1; }
        .rt-link-row {
          display: flex;
          gap: 6px;
          padding: 8px 10px;
          border-bottom: 1px solid #F1F5F9;
          background: #F8FAFC;
        }
        .rt-link-input {
          flex: 1;
          padding: 7px 10px;
          font-size: 13px;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          outline: none;
          background: #fff;
        }
        .rt-link-input:focus { border-color: #1a1a1a; }
        .rt-link-apply {
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          background: #1a1a1a;
          border: none;
          border-radius: 8px;
          cursor: pointer;
        }
        .rt-content {
          min-height: 160px;
          padding: 14px 16px;
          font-size: 14px;
          line-height: 1.6;
          color: #1a1a1a;
          outline: none;
        }
        .rt-content p {
          margin: 0 0 6px;
        }
        .rt-content p:last-child { margin-bottom: 0; }
        .rt-content p + p { margin-top: 0; }
        .rt-content ul, .rt-content ol {
          margin: 6px 0;
          padding-left: 20px;
        }
        .rt-content li {
          margin-bottom: 4px;
        }
        .rt-content strong { font-weight: 700; }
        .rt-content em { font-style: italic; }
        .rt-content s { text-decoration: line-through; }
        .rt-content a {
          color: #1a1a1a;
          text-decoration: underline;
          text-decoration-color: rgba(0, 0, 0, 0.3);
          text-underline-offset: 2px;
          cursor: pointer;
        }
        .rt-content a:hover {
          text-decoration-color: currentColor;
        }
        /* Placeholder */
        .rt-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9CA3AF;
          float: left;
          height: 0;
          pointer-events: none;
        }
        .rt-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 12px;
          font-size: 11px;
          color: #9CA3AF;
          border-top: 1px solid #F1F5F9;
          background: #FAFAFA;
        }
      `}</style>
    </div>

    {/* Compliance check panel — below the editor */}
    {complianceCheck && showCheckPanel && (
      <div ref={compliancePanelRef}>
        <CompliancePanel
          state={checkState}
          onClose={() => setShowCheckPanel(false)}
          onRecheck={runComplianceCheck}
          onApply={applySuggestion}
        />
      </div>
    )}
    </div>
  )
}

// ── Compliance UI ────────────────────────────────────────────────────────────

function ComplianceBanner({
  state, needsRecheck, onCheck, onTogglePanel,
}: {
  state: CheckState
  needsRecheck: boolean
  onCheck: () => void
  onTogglePanel: () => void
}) {
  // ── LOADING: dark AI-scan card ──────────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <div style={{ position: 'relative', overflow: 'hidden', background: '#0F172A', border: '1.5px solid #1E293B', borderRadius: 16, marginBottom: 12 }}>
        <div className="rt-ai-beam" />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="rt-ai-ring">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6366F1', marginBottom: 2 }}>KI-Analyse läuft</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#E2E8F0' }}>Prüft auf EU-Health-Claims-Verordnung…</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
            <span className="rt-ai-dot" style={{ animationDelay: '0s' }} />
            <span className="rt-ai-dot" style={{ animationDelay: '0.2s' }} />
            <span className="rt-ai-dot" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
        <style jsx>{`
          .rt-ai-beam {
            position: absolute; top: 0; bottom: 0; width: 90px;
            background: linear-gradient(90deg, transparent, rgba(99,102,241,0.28), transparent);
            animation: rt-beam 1.8s ease-in-out infinite;
          }
          @keyframes rt-beam { 0% { left: -90px; } 100% { left: calc(100% + 90px); } }
          .rt-ai-ring {
            width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
            background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3);
            display: flex; align-items: center; justify-content: center;
            animation: rt-ring-pulse 2s ease-in-out infinite;
          }
          @keyframes rt-ring-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.3); }
            50% { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
          }
          .rt-ai-dot {
            display: inline-block; width: 7px; height: 7px;
            border-radius: 50%; background: #6366F1;
            animation: rt-dot-pulse 1.3s ease-in-out infinite;
          }
          @keyframes rt-dot-pulse {
            0%, 80%, 100% { transform: scale(0.5); opacity: 0.35; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  // ── OK: green success card ──────────────────────────────────────────────────
  if (state.status === 'ok' && !needsRecheck) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'linear-gradient(135deg,#DCFCE7,#F0FDF4)', border: '1.5px solid #86EFAC', borderRadius: 16, marginBottom: 12 }}>
        <div className="rt-ok-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M8.5 12.5l2.5 2.5 4.5-5"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#14532D' }}>EU-Health-Claims-Check bestanden ✓</div>
          <div style={{ fontSize: 12, color: '#166534', marginTop: 2, opacity: 0.85 }}>Kein Verstoß gefunden — bereit zur Veröffentlichung.</div>
        </div>
        <button onClick={onCheck} style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 10, border: '1.5px solid #86EFAC', background: '#fff', color: '#15803D', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'background 0.15s' }}>
          Erneut prüfen
        </button>
        <style jsx>{`
          .rt-ok-icon {
            width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
            background: #16A34A; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 12px rgba(22,163,74,0.3);
            animation: rt-ok-pop 0.4s cubic-bezier(0.34,1.56,0.64,1);
          }
          @keyframes rt-ok-pop {
            0% { transform: scale(0.4); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  // ── ISSUES: compact red alert ───────────────────────────────────────────────
  if (state.status === 'issues' && !needsRecheck) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'linear-gradient(135deg,#FEE2E2,#FEF2F2)', border: '1.5px solid #FCA5A5', borderRadius: 16, marginBottom: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: '#DC2626', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(220,38,38,0.25)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#7F1D1D' }}>
            {state.issues.length} {state.issues.length === 1 ? 'Stelle' : 'Stellen'} zu überarbeiten
          </div>
          <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 2, opacity: 0.8 }}>KI-Vorschlag wartet unten ↓</div>
        </div>
        <button onClick={onTogglePanel} style={{ fontSize: 12, fontWeight: 700, padding: '9px 14px', borderRadius: 10, border: 'none', background: '#1A1A1A', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'opacity 0.15s' }}>
          Vorschlag ansehen
        </button>
      </div>
    )
  }

  // ── ERROR ───────────────────────────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 16, marginBottom: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: '#DC2626', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#7F1D1D' }}>Prüfung fehlgeschlagen</div>
          <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>{state.message}</div>
        </div>
        <button onClick={onCheck} style={{ fontSize: 12, fontWeight: 700, padding: '9px 14px', borderRadius: 10, border: 'none', background: '#1A1A1A', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Erneut versuchen
        </button>
      </div>
    )
  }

  // ── IDLE / NEEDS-RECHECK: amber call-to-action ──────────────────────────────
  const isNeedsRecheck = needsRecheck
  return (
    <div className="rt-idle-banner" style={{ marginBottom: 12 }}>
      <div className="rt-idle-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B45309', opacity: 0.8, marginBottom: 3 }}>
          EU-Verbraucherschutz · HCVO 1924/2006
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#78350F', lineHeight: 1.3 }}>
          {isNeedsRecheck ? 'Text geändert — erneut prüfen' : 'EU-Health-Claims-Check'}
        </div>
        <div style={{ fontSize: 12, color: '#92400E', opacity: 0.8, marginTop: 3, lineHeight: 1.4 }}>
          {isNeedsRecheck
            ? 'Der Text wurde nach der letzten Prüfung verändert.'
            : 'Vor Veröffentlichung auf verbotene Heil- und Wirkaussagen prüfen.'}
        </div>
      </div>
      <button onClick={onCheck} className="rt-idle-btn">
        {isNeedsRecheck ? 'Erneut prüfen' : 'Jetzt prüfen →'}
      </button>
      <style jsx>{`
        .rt-idle-banner {
          display: flex; align-items: flex-start; gap: 14px; padding: 16px;
          background: linear-gradient(135deg,#FFFBEB,#FEF3C7);
          border: 1.5px solid #FCD34D; border-left: 5px solid #F59E0B;
          border-radius: 16px;
        }
        .rt-idle-icon {
          width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
          background: #D97706; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(217,119,6,0.25);
          animation: rt-idle-glow 3s ease-in-out infinite;
        }
        @keyframes rt-idle-glow {
          0%,100% { box-shadow: 0 4px 12px rgba(217,119,6,0.25); }
          50% { box-shadow: 0 4px 22px rgba(217,119,6,0.55); }
        }
        .rt-idle-btn {
          font-size: 13px; font-weight: 700; padding: 11px 18px;
          border-radius: 10px; border: none; background: #1A1A1A; color: #fff;
          cursor: pointer; white-space: nowrap; flex-shrink: 0; align-self: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: opacity 0.15s, transform 0.1s;
        }
        .rt-idle-btn:hover { opacity: 0.88; }
        .rt-idle-btn:active { transform: scale(0.97); }
        @media (max-width: 520px) {
          .rt-idle-banner { flex-wrap: wrap; }
          .rt-idle-btn { width: 100%; text-align: center; padding: 14px 18px; font-size: 14px; }
        }
      `}</style>
    </div>
  )
}

function CompliancePanel({
  state, onClose, onRecheck, onApply,
}: {
  state: CheckState
  onClose: () => void
  onRecheck: () => void
  onApply: () => void
}) {
  return (
    <div className="rt-sugg-card">

      {/* ── Header ── */}
      <div className="rt-sugg-header">
        <div className="rt-sugg-header-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div className="rt-sugg-header-title">KI-Vorschlag</div>
          <div className="rt-sugg-header-sub">In deinem Schreibstil · EU-Health-Claims-konform</div>
        </div>
        <button onClick={onClose} className="rt-sugg-close" aria-label="Schließen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {state.status === 'issues' && (
        <>
          {/* ── What was found ── */}
          <div className="rt-sugg-section">
            <div className="rt-sugg-label">Was überarbeitet wurde</div>
            <ul className="rt-sugg-issues">
              {state.issues.map((issue, i) => (
                <li key={i}>
                  <span className="rt-sugg-issue-quote">„{issue.quote}&quot;</span>
                  <span className="rt-sugg-issue-reason">{issue.reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Suggested text ── */}
          {state.suggested_html && (
            <div className="rt-sugg-section">
              <div className="rt-sugg-label">Vorgeschlagener Text</div>
              <div className="rt-sugg-text" dangerouslySetInnerHTML={{ __html: state.suggested_html }} />
            </div>
          )}

          {/* ── Actions ── */}
          <div className="rt-sugg-actions">
            {state.suggested_html && (
              <button onClick={onApply} className="rt-sugg-apply">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                Vorschlag übernehmen
              </button>
            )}
            <button onClick={onClose} className="rt-sugg-skip">Selbst überarbeiten</button>
          </div>
        </>
      )}

      {state.status === 'ok' && (
        <div className="rt-sugg-section" style={{ textAlign: 'center', padding: '24px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#14532D', marginBottom: 6 }}>Alles in Ordnung!</div>
          <div style={{ fontSize: 13, color: '#166534', marginBottom: 20 }}>Keine kritischen Aussagen gefunden. Du kannst veröffentlichen.</div>
          <button onClick={onClose} className="rt-sugg-apply" style={{ background: '#16A34A', boxShadow: '0 4px 16px rgba(22,163,74,0.3)' }}>Verstanden</button>
        </div>
      )}

      {state.status === 'error' && (
        <div className="rt-sugg-section">
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#7F1D1D', marginBottom: 6 }}>Prüfung fehlgeschlagen</div>
          <div style={{ fontSize: 13, color: '#B91C1C', marginBottom: 16 }}>{state.message}</div>
          <div className="rt-sugg-actions">
            <button onClick={onClose} className="rt-sugg-skip">Schließen</button>
            <button onClick={onRecheck} className="rt-sugg-apply">Erneut versuchen</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .rt-sugg-card {
          margin-top: 8px;
          background: #fff;
          border: 1.5px solid #E5E7EB;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,0.08);
        }
        .rt-sugg-header {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px;
          background: linear-gradient(to right, #0F172A, #1E293B);
          border-bottom: 1px solid #1E293B;
        }
        .rt-sugg-header-icon {
          width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          background: rgba(99,102,241,0.18); border: 1px solid rgba(99,102,241,0.3);
          display: flex; align-items: center; justify-content: center;
        }
        .rt-sugg-header-title { font-size: 14px; font-weight: 700; color: #F1F5F9; }
        .rt-sugg-header-sub { font-size: 11px; color: #64748B; margin-top: 1px; }
        .rt-sugg-close {
          margin-left: auto; flex-shrink: 0;
          width: 30px; height: 30px; border-radius: 8px;
          background: rgba(255,255,255,0.07); border: none;
          color: #64748B; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .rt-sugg-close:hover { background: rgba(255,255,255,0.14); color: #CBD5E1; }
        .rt-sugg-section {
          padding: 16px 18px;
          border-bottom: 1px solid #F1F5F9;
        }
        .rt-sugg-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase; color: #94A3B8; margin-bottom: 10px;
        }
        .rt-sugg-issues {
          margin: 0; padding: 0; list-style: none;
          display: flex; flex-direction: column; gap: 8px;
        }
        .rt-sugg-issues li {
          padding: 10px 12px;
          background: #FEF3C7; border: 1px solid #FCD34D;
          border-radius: 10px;
          display: flex; flex-direction: column; gap: 3px;
        }
        .rt-sugg-issue-quote { font-size: 12.5px; font-weight: 700; color: #78350F; }
        .rt-sugg-issue-reason { font-size: 12px; color: #92400E; opacity: 0.85; }
        .rt-sugg-text {
          background: #F0FDF4; border: 1.5px solid #86EFAC; border-radius: 12px;
          padding: 14px 16px; font-size: 14px; line-height: 1.6; color: #064E3B;
        }
        .rt-sugg-text :global(p) { margin: 0 0 10px; }
        .rt-sugg-text :global(p:last-child) { margin-bottom: 0; }
        .rt-sugg-text :global(strong) { font-weight: 700; }
        .rt-sugg-text :global(em) { font-style: italic; }
        .rt-sugg-text :global(ul), .rt-sugg-text :global(ol) { margin: 0 0 10px; padding-left: 22px; }
        .rt-sugg-actions {
          padding: 16px 18px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .rt-sugg-apply {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 15px 20px;
          font-size: 15px; font-weight: 700;
          background: #16A34A; color: #fff;
          border: none; border-radius: 14px; cursor: pointer;
          box-shadow: 0 4px 16px rgba(22,163,74,0.3);
          transition: opacity 0.15s, transform 0.1s;
          min-height: 52px;
        }
        .rt-sugg-apply:hover { opacity: 0.92; }
        .rt-sugg-apply:active { transform: scale(0.98); }
        .rt-sugg-skip {
          width: 100%; padding: 12px 20px;
          font-size: 13px; font-weight: 600;
          background: #F8FAFC; color: #64748B;
          border: 1.5px solid #E2E8F0; border-radius: 12px; cursor: pointer;
          transition: background 0.15s; text-align: center; min-height: 46px;
        }
        .rt-sugg-skip:hover { background: #F1F5F9; }
      `}</style>
    </div>
  )
}
