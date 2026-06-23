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
  /** The approved HTML text from a previous check (stored in parent values as key+'__chk') */
  complianceApprovedText?: string
  /** Called when compliance check passes — parent should persist the approved text */
  onComplianceApproved?: (approvedHtml: string) => void
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

export function RichTextField({ value, onChange, placeholder, maxLength, complianceCheck, complianceApprovedText, onComplianceApproved }: Props) {
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [checkState, setCheckState] = useState<CheckState>({ status: 'idle' })
  const [showCheckPanel, setShowCheckPanel] = useState(false)
  // Track whether we already restored the compliance state from props (run once per mount)
  const complianceRestoredRef = useRef(false)
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

  // Restore compliance approval state on mount (e.g. after section switch).
  // If the parent has a previously-approved text that matches the current value,
  // show the green "Geprüft" state without requiring a re-check.
  useEffect(() => {
    if (complianceRestoredRef.current) return
    if (!complianceCheck || !complianceApprovedText || !value) return
    // Normalize: strip trailing newlines / whitespace so minor serialization
    // differences don't cause a false mismatch.
    if (complianceApprovedText.trim() === value.trim()) {
      setCheckState({ status: 'ok', checkedHash: hash(complianceApprovedText) })
      complianceRestoredRef.current = true
    }
  }, [complianceCheck, complianceApprovedText, value])

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
      const h = hash(html)
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
      }
    } catch (e) {
      setCheckState({ status: 'error', message: e instanceof Error ? e.message : 'Netzwerk-Fehler' })
    }
  }, [editor])

  const applySuggestion = useCallback(() => {
    if (!editor) return
    if (checkState.status !== 'issues') return
    editor.commands.setContent(checkState.suggested_html)
    onChange(checkState.suggested_html)
    // Mark as needs re-check (the user might still edit)
    setCheckState({ status: 'idle' })
    setShowCheckPanel(false)
  }, [editor, checkState, onChange])

  // Detect content drift since last check
  const currentHash = editor ? hash(editor.getHTML()) : ''
  const lastCheckedHash = checkState.status === 'ok' || checkState.status === 'issues' ? checkState.checkedHash : null
  const needsRecheck = lastCheckedHash !== null && lastCheckedHash !== currentHash

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
      <CompliancePanel
        state={checkState}
        onClose={() => setShowCheckPanel(false)}
        onRecheck={runComplianceCheck}
        onApply={applySuggestion}
      />
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
  // SVG icons (designed for warning/control context)
  const ICON_SHIELD_WARN = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
  const ICON_SHIELD_CHECK = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M8.5 12.5l2.5 2.5 4.5-5"/>
    </svg>
  )
  const ICON_TRIANGLE = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
  const ICON_XCIRCLE = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  )

  // Default = "needs initial check" — amber/warning palette
  let bg = '#FFFBEB', border = '#F59E0B', text = '#78350F', iconBg = '#D97706', accent = '#D97706'
  let title = 'EU-Health-Claims-Check erforderlich'
  let sub = 'Dieser Text muss vor Veröffentlichung auf verbotene Heil- und Wirkaussagen geprüft werden.'
  let ctaLabel = 'Jetzt prüfen lassen'
  let ctaBg = '#1A1A1A', ctaColor = '#FFFFFF'
  let icon = ICON_SHIELD_WARN

  if (state.status === 'loading') {
    bg = '#F1F5F9'; border = '#94A3B8'; text = '#0F172A'; iconBg = '#475569'; accent = '#475569'
    title = 'KI prüft den Text…'
    sub = 'Das dauert ein paar Sekunden.'
    ctaLabel = ''
    icon = <span className="rt-spinner rt-spinner-lg" style={{ borderColor: '#FFFFFF', borderRightColor: 'transparent' }} />
  } else if (state.status === 'ok' && !needsRecheck) {
    bg = '#F0FDF4'; border = '#16A34A'; text = '#14532D'; iconBg = '#16A34A'; accent = '#16A34A'
    title = 'EU-Health-Claims-Check bestanden'
    sub = 'Keine kritischen Heil- oder Wirkaussagen gefunden. Du kannst veröffentlichen.'
    ctaLabel = 'Erneut prüfen'
    ctaBg = '#FFFFFF'; ctaColor = '#15803D'
    icon = ICON_SHIELD_CHECK
  } else if (state.status === 'issues' && !needsRecheck) {
    bg = '#FEF2F2'; border = '#DC2626'; text = '#7F1D1D'; iconBg = '#DC2626'; accent = '#DC2626'
    title = `${state.issues.length} potenzielle ${state.issues.length === 1 ? 'Heilaussage gefunden' : 'Heilaussagen gefunden'}`
    sub = 'Bitte überarbeiten. Wir haben einen konformen Vorschlag in deinem Schreibstil für dich.'
    ctaLabel = 'Vorschlag ansehen'
    ctaBg = '#1A1A1A'; ctaColor = '#FFFFFF'
    icon = ICON_TRIANGLE
  } else if (state.status === 'error') {
    bg = '#FEF2F2'; border = '#DC2626'; text = '#7F1D1D'; iconBg = '#DC2626'; accent = '#DC2626'
    title = 'Prüfung fehlgeschlagen'
    sub = state.message
    ctaLabel = 'Erneut versuchen'
    ctaBg = '#1A1A1A'; ctaColor = '#FFFFFF'
    icon = ICON_XCIRCLE
  } else if (needsRecheck) {
    bg = '#FFFBEB'; border = '#F59E0B'; text = '#78350F'; iconBg = '#D97706'; accent = '#D97706'
    title = 'Text wurde geändert · erneut prüfen erforderlich'
    sub = 'Du hast den Text nach der letzten Prüfung verändert. Bitte führe den KI-Check erneut durch.'
    ctaLabel = 'Erneut prüfen'
    ctaBg = '#1A1A1A'; ctaColor = '#FFFFFF'
    icon = ICON_SHIELD_WARN
  }

  const onClick = state.status === 'issues' ? onTogglePanel : onCheck

  return (
    <div className="rt-comp-banner"
      style={{
        background: bg,
        border: `1.5px solid ${border}`,
        borderLeftWidth: 5,
        color: text,
      }}>
      <div className="rt-comp-banner-icon" style={{ background: iconBg }}>{icon}</div>
      <div className="rt-comp-banner-text">
        <div className="rt-comp-banner-tag" style={{ color: accent }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
          </svg>
          <span>EU-Verbraucherschutz · HCVO 1924/2006</span>
        </div>
        <p className="rt-comp-banner-title">{title}</p>
        <p className="rt-comp-banner-sub">{sub}</p>
      </div>
      {ctaLabel && (
        <button onClick={onClick}
          className="rt-comp-banner-cta"
          style={{ background: ctaBg, color: ctaColor }}>
          {ctaLabel}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      )}
      <style jsx>{`
        .rt-comp-banner {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px 14px 14px;
          border-radius: 14px;
          margin-bottom: 12px;
        }
        .rt-comp-banner-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .rt-comp-banner-text { flex: 1; min-width: 0; }
        .rt-comp-banner-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 3px;
          opacity: 0.85;
        }
        .rt-comp-banner-title {
          margin: 0;
          font-size: 14.5px;
          font-weight: 700;
          letter-spacing: -0.005em;
          line-height: 1.3;
        }
        .rt-comp-banner-sub {
          margin: 3px 0 0;
          font-size: 12.5px;
          line-height: 1.45;
          opacity: 0.85;
        }
        .rt-comp-banner-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          flex-shrink: 0;
          transition: opacity 0.15s, transform 0.1s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .rt-comp-banner-cta:hover { opacity: 0.9; }
        .rt-comp-banner-cta:active { transform: scale(0.97); }
      `}</style>
    </div>
  )
}

function _ComplianceBadge({
  state, needsRecheck, onCheck, onShowPanel,
}: {
  state: CheckState
  needsRecheck: boolean
  onCheck: () => void
  onShowPanel: () => void
}) {
  // Determine display
  if (state.status === 'loading') {
    return (
      <span className="rt-compliance-badge" style={{ background: '#F1F5F9', color: '#475569' }}>
        <span className="rt-spinner" /> KI prüft…
      </span>
    )
  }
  if (state.status === 'ok' && !needsRecheck) {
    return (
      <button onClick={onShowPanel}
        className="rt-compliance-badge"
        style={{ background: '#ECFDF5', color: '#15803D', cursor: 'pointer' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        KI-konform geprüft
      </button>
    )
  }
  if (state.status === 'issues' && !needsRecheck) {
    return (
      <button onClick={onShowPanel}
        className="rt-compliance-badge"
        style={{ background: '#FFFBEB', color: '#B45309', cursor: 'pointer' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        {state.issues.length} Punkte bitte prüfen
      </button>
    )
  }
  if (state.status === 'error') {
    return (
      <button onClick={onCheck}
        className="rt-compliance-badge"
        style={{ background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer' }}>
        Fehler · erneut prüfen
      </button>
    )
  }
  // idle or needsRecheck
  return (
    <button onClick={onCheck}
      className="rt-compliance-badge"
      style={{ background: '#1a1a1a', color: '#fff', cursor: 'pointer' }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4M12 8h.01"/>
      </svg>
      {needsRecheck ? 'Text geändert · erneut prüfen' : 'KI-Compliance-Check starten'}
    </button>
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
    <div className="rt-compliance-panel">
      {state.status === 'loading' && (
        <div className="rt-cp-section">
          <span className="rt-spinner rt-spinner-lg" />
          <p className="rt-cp-headline">Die KI prüft gerade deinen Text…</p>
          <p className="rt-cp-sub">Wenn etwas gegen die EU-Health-Claims-Verordnung verstößt, schlagen wir dir eine konforme Version vor.</p>
        </div>
      )}

      {state.status === 'ok' && (
        <div className="rt-cp-section">
          <div className="rt-cp-icon" style={{ background: '#ECFDF5', color: '#15803D' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <p className="rt-cp-headline">Sieht gut aus.</p>
          <p className="rt-cp-sub">Keine kritischen Heil- oder Wirkaussagen gefunden. Du kannst veröffentlichen.</p>
          <div className="rt-cp-actions">
            <button onClick={onClose} className="rt-cp-btn rt-cp-btn-primary">Verstanden</button>
          </div>
        </div>
      )}

      {state.status === 'issues' && (
        <div className="rt-cp-section">
          <div className="rt-cp-icon" style={{ background: '#FFFBEB', color: '#B45309' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <p className="rt-cp-headline">{state.issues.length} potenzielle Heil- und Wirkaussagen</p>
          <p className="rt-cp-sub">
            Die EU-Health-Claims-Verordnung verbietet bestimmte Aussagen zu Nahrungsergänzungsmitteln.
            Hier ist ein Vorschlag in deinem Schreibstil, der das Problem löst.
          </p>

          <ul className="rt-cp-issues">
            {state.issues.map((issue, i) => (
              <li key={i}>
                <strong>„{issue.quote}&ldquo;</strong>
                <span>{issue.reason}</span>
              </li>
            ))}
          </ul>

          {state.suggested_html && (
            <div className="rt-cp-suggestion">
              <p className="rt-cp-suggestion-label">Vorschlag</p>
              <div className="rt-cp-suggestion-content"
                dangerouslySetInnerHTML={{ __html: state.suggested_html }} />
            </div>
          )}

          <div className="rt-cp-actions">
            <button onClick={onClose} className="rt-cp-btn rt-cp-btn-ghost">
              Selbst überarbeiten
            </button>
            {state.suggested_html && (
              <button onClick={onApply} className="rt-cp-btn rt-cp-btn-primary">
                Vorschlag übernehmen
              </button>
            )}
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="rt-cp-section">
          <div className="rt-cp-icon" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
            </svg>
          </div>
          <p className="rt-cp-headline">Prüfung fehlgeschlagen</p>
          <p className="rt-cp-sub">{state.message}</p>
          <div className="rt-cp-actions">
            <button onClick={onClose} className="rt-cp-btn rt-cp-btn-ghost">Schließen</button>
            <button onClick={onRecheck} className="rt-cp-btn rt-cp-btn-primary">Erneut versuchen</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .rt-compliance-panel {
          margin-top: 8px;
          background: #fff;
          border: 1.5px solid #E5E7EB;
          border-radius: 16px;
          overflow: hidden;
        }
        .rt-cp-section {
          padding: 18px 20px 20px;
        }
        .rt-cp-icon {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
        }
        .rt-cp-headline {
          margin: 0 0 4px;
          font-size: 14.5px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.01em;
        }
        .rt-cp-sub {
          margin: 0 0 16px;
          font-size: 13px;
          color: #64748B;
          line-height: 1.55;
        }
        .rt-cp-issues {
          margin: 0 0 18px;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .rt-cp-issues li {
          padding: 10px 12px;
          background: #FEF3C7;
          border-radius: 10px;
          font-size: 12.5px;
          color: #92400E;
          line-height: 1.5;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .rt-cp-issues li strong {
          color: #78350F;
          font-weight: 700;
        }
        .rt-cp-suggestion {
          margin-bottom: 18px;
          background: #F0FDF4;
          border: 1px solid #BBF7D0;
          border-radius: 12px;
          overflow: hidden;
        }
        .rt-cp-suggestion-label {
          margin: 0;
          padding: 8px 14px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #15803D;
          background: rgba(187, 247, 208, 0.4);
          border-bottom: 1px solid #BBF7D0;
        }
        .rt-cp-suggestion-content {
          padding: 14px 16px;
          font-size: 14px;
          line-height: 1.55;
          color: #064E3B;
        }
        .rt-cp-suggestion-content :global(p) { margin: 0 0 10px; }
        .rt-cp-suggestion-content :global(p:last-child) { margin-bottom: 0; }
        .rt-cp-suggestion-content :global(strong) { font-weight: 700; }
        .rt-cp-suggestion-content :global(em) { font-style: italic; }
        .rt-cp-suggestion-content :global(ul),
        .rt-cp-suggestion-content :global(ol) { margin: 0 0 10px; padding-left: 22px; }
        .rt-cp-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .rt-cp-btn {
          padding: 9px 16px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: opacity 0.12s, background 0.12s;
        }
        .rt-cp-btn-primary { background: #1a1a1a; color: white; }
        .rt-cp-btn-primary:hover { background: #333; }
        .rt-cp-btn-ghost { background: #F3F4F6; color: #374151; }
        .rt-cp-btn-ghost:hover { background: #E5E7EB; }
      `}</style>
      <style jsx global>{`
        .rt-compliance-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 999px;
          border: none;
          transition: opacity 0.12s;
        }
        .rt-compliance-badge:hover { opacity: 0.85; }
        .rt-spinner {
          width: 10px; height: 10px;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          animation: rt-spin 0.7s linear infinite;
        }
        .rt-spinner-lg { width: 18px; height: 18px; border-width: 2.5px; }
        @keyframes rt-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
