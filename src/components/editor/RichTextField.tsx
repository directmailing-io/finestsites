'use client'

/**
 * RichTextField — laypeople-friendly WYSIWYG editor.
 * Toolbar: Bold, Italic, Strike, Lists, Link, Clear.
 * Output: clean HTML for the template engine.
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
  complianceCheck?: boolean
  complianceApproved?: boolean
  onComplianceApproved?: (approvedHtml: string) => void
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
function hashText(html: string): string { return hash(stripHtml(html)) }

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
      StarterKit.configure({ heading: false, codeBlock: false, code: false, horizontalRule: false, blockquote: false }),
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
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
      if (!res.ok) { setCheckState({ status: 'error', message: data.error ?? 'Prüfung fehlgeschlagen' }); return }
      const h = hashText(html)
      if (data.ok) {
        setCheckState({ status: 'ok', checkedHash: h })
        onComplianceApproved?.(html)
      } else {
        setCheckState({ status: 'issues', checkedHash: h, issues: data.issues ?? [], suggested_html: data.suggested_html ?? '' })
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
    setCheckState({ status: 'ok', checkedHash: hashText(suggestedHtml) })
    onComplianceApproved?.(suggestedHtml)
  }, [editor, checkState, onChange, onComplianceApproved])

  useEffect(() => {
    if (checkState.status === 'issues' && resultRef.current) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200)
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
        <div className="rtc-approved">
          <div className="rtc-approved-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12l5 5 11-11" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="rtc-approved-title">EU-Pflichtcheck bestanden</div>
            <div className="rtc-approved-sub">Freigegeben zur Veröffentlichung</div>
          </div>
          <button onClick={onComplianceRevoked} className="rtc-approved-edit">Bearbeiten</button>
          <style jsx>{`
            .rtc-approved {
              display: flex; align-items: center; gap: 12px; padding: 13px 16px;
              background: #fff;
              border: 1px solid #D1FAE5;
              border-radius: 14px; margin-bottom: 10px;
              box-shadow: 0 1px 8px rgba(16,185,129,0.08);
            }
            .rtc-approved-icon {
              width: 34px; height: 34px; border-radius: 10px; background: #059669;
              display: flex; align-items: center; justify-content: center; flex-shrink: 0;
              box-shadow: 0 2px 8px rgba(5,150,105,0.25);
            }
            .rtc-approved-title { font-size: 13.5px; font-weight: 700; color: #064E3B; }
            .rtc-approved-sub { font-size: 11.5px; color: #6EE7B7; margin-top: 1px; color: #10B981; }
            .rtc-approved-edit {
              flex-shrink: 0; font-size: 12px; font-weight: 600; color: #374151;
              background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px;
              padding: 7px 13px; cursor: pointer; white-space: nowrap; transition: background 0.15s;
            }
            .rtc-approved-edit:hover { background: #F3F4F6; }
          `}</style>
        </div>
        <div style={{ border: '1px solid #E5E7EB', borderRadius: 14, padding: '14px 16px', background: '#FAFAFA', fontSize: 14, color: '#374151', lineHeight: '1.6' }}
          dangerouslySetInnerHTML={{ __html: value || '' }} />
      </div>
    )
  }

  if (!editor) {
    return (
      <div style={{ border: '1px solid #E5E7EB', borderRadius: 16, minHeight: 200, padding: 16, background: '#fff' }}>
        <p style={{ color: '#D1D5DB', fontSize: 14 }}>Editor lädt…</p>
      </div>
    )
  }

  const isActive = (m: string) => editor.isActive(m)
  const textLength = editor.state.doc.textContent.length
  const overLimit = maxLength != null && textLength > maxLength
  const isScanning = checkState.status === 'loading'
  const tbtn = (active: boolean) => ({ background: active ? '#111827' : 'transparent', color: active ? '#fff' : '#4B5563' })

  return (
    <div>
      {/* ── Editor ── */}
      <div className={`rt-wrap${isScanning ? ' rt-wrap--scan' : ''}`}>
        {/* Toolbar */}
        <div className="rt-toolbar">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className="rt-btn" style={tbtn(isActive('bold'))}>
            <strong style={{ fontFamily: 'Georgia, serif', fontSize: 14 }}>B</strong>
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className="rt-btn" style={tbtn(isActive('italic'))}>
            <em style={{ fontFamily: 'Georgia, serif', fontSize: 14 }}>I</em>
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className="rt-btn" style={tbtn(isActive('strike'))}>
            <span style={{ textDecoration: 'line-through', fontSize: 13 }}>S</span>
          </button>
          <div className="rt-sep" />
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className="rt-btn" style={tbtn(isActive('bulletList'))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
              <circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/>
            </svg>
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className="rt-btn" style={tbtn(isActive('orderedList'))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
              <text x="3" y="9" fontSize="7" fill="currentColor" fontWeight="700">1</text>
              <text x="3" y="15" fontSize="7" fill="currentColor" fontWeight="700">2</text>
              <text x="3" y="21" fontSize="7" fill="currentColor" fontWeight="700">3</text>
            </svg>
          </button>
          <div className="rt-sep" />
          <button type="button" onClick={() => { const prev = editor.getAttributes('link').href as string | undefined; setLinkUrl(prev ?? ''); setShowLinkInput(s => !s) }} className="rt-btn" style={tbtn(isActive('link') || showLinkInput)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
          </button>
          <div className="rt-spacer" />
          <button type="button" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} className="rt-btn rt-btn--ghost" title="Formatierung entfernen">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 7V5h14v2"/><path d="M3 17l6-6 4 4 6-6"/><path d="M14 5l-4 14"/>
            </svg>
          </button>
        </div>

        {showLinkInput && (
          <div className="rt-link-row">
            <input type="url" autoFocus value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } if (e.key === 'Escape') { setShowLinkInput(false); setLinkUrl('') } }}
              placeholder="https://… (leer lassen = Link entfernen)" className="rt-link-input" />
            <button type="button" onClick={addLink} className="rt-link-apply">{linkUrl ? 'Anwenden' : 'Entfernen'}</button>
          </div>
        )}

        {/* Editor content with scan overlay */}
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <EditorContent editor={editor} />
          {isScanning && <div className="rt-scan-beam" aria-hidden="true" />}
        </div>

        {maxLength != null && (
          <div className="rt-footer">
            <span style={{ color: overLimit ? '#EF4444' : '#9CA3AF' }}>{textLength} / {maxLength}</span>
          </div>
        )}

        <style jsx global>{`
          .rt-wrap {
            background: #fff;
            border: 1.5px solid #E5E7EB;
            border-radius: 16px; overflow: hidden;
            transition: border-color 0.2s, box-shadow 0.3s;
          }
          .rt-wrap:focus-within { border-color: #111827; box-shadow: 0 0 0 3px rgba(17,24,39,0.06); }
          .rt-wrap--scan {
            border-color: #C2A6CB !important;
            box-shadow: 0 0 0 4px rgba(194,166,203,0.15), 0 0 40px rgba(194,166,203,0.12) !important;
          }
          .rt-scan-beam {
            position: absolute; left: 0; right: 0; height: 2px;
            background: linear-gradient(90deg, transparent 0%, rgba(194,166,203,0.3) 10%, #C2A6CB 40%, #E0C8E8 50%, #C2A6CB 60%, rgba(194,166,203,0.3) 90%, transparent 100%);
            pointer-events: none; top: 0;
            animation: rt-scan 2s cubic-bezier(0.4,0,0.2,1) infinite;
            filter: blur(0.5px);
          }
          @keyframes rt-scan { 0% { top: 0; opacity: 0; } 5% { opacity: 1; } 95% { opacity: 0.8; } 100% { top: 100%; opacity: 0; } }
          .rt-toolbar {
            display: flex; align-items: center; gap: 2px; padding: 7px 10px;
            border-bottom: 1px solid #F3F4F6; background: #FAFAFA; flex-wrap: wrap;
          }
          .rt-btn {
            display: inline-flex; align-items: center; justify-content: center;
            min-width: 32px; height: 32px; padding: 0 8px; border-radius: 8px;
            font-weight: 600; cursor: pointer; transition: background 0.1s, color 0.1s; border: none;
          }
          .rt-btn:hover { background: #F3F4F6; color: #111827; }
          .rt-btn--ghost { opacity: 0.4; }
          .rt-btn--ghost:hover { opacity: 1; background: #F3F4F6; }
          .rt-sep { width: 1px; height: 16px; background: #E5E7EB; margin: 0 4px; flex-shrink: 0; }
          .rt-spacer { flex: 1; }
          .rt-link-row { display: flex; gap: 6px; padding: 8px 10px; border-bottom: 1px solid #F3F4F6; background: #F9FAFB; }
          .rt-link-input { flex: 1; padding: 7px 11px; font-size: 13px; border: 1px solid #E5E7EB; border-radius: 9px; outline: none; background: #fff; }
          .rt-link-input:focus { border-color: #111827; }
          .rt-link-apply { padding: 7px 14px; font-size: 12.5px; font-weight: 600; color: #fff; background: #111827; border: none; border-radius: 9px; cursor: pointer; white-space: nowrap; }
          .rt-content { min-height: 160px; padding: 14px 16px; font-size: 14.5px; line-height: 1.65; color: #111827; outline: none; }
          .rt-content p { margin: 0 0 6px; }
          .rt-content p:last-child { margin-bottom: 0; }
          .rt-content ul, .rt-content ol { margin: 6px 0; padding-left: 20px; }
          .rt-content li { margin-bottom: 3px; }
          .rt-content strong { font-weight: 700; }
          .rt-content em { font-style: italic; }
          .rt-content s { text-decoration: line-through; }
          .rt-content a { color: #111827; text-decoration: underline; text-underline-offset: 2px; text-decoration-color: rgba(0,0,0,0.25); }
          .rt-content a:hover { text-decoration-color: #111827; }
          .rt-content p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #9CA3AF; float: left; height: 0; pointer-events: none; }
          .rt-footer { padding: 7px 14px; font-size: 11.5px; color: #9CA3AF; border-top: 1px solid #F3F4F6; background: #FAFAFA; text-align: right; }
        `}</style>
      </div>

      {/* ── Compliance section — below editor ── */}
      {complianceCheck && (
        <ComplianceSection
          state={checkState}
          needsRecheck={needsRecheck}
          onCheck={runComplianceCheck}
          onApply={applySuggestion}
          resultRef={resultRef}
        />
      )}
    </div>
  )
}

// ── Compliance section ────────────────────────────────────────────────────────

function ComplianceSection({
  state, needsRecheck, onCheck, onApply, resultRef,
}: {
  state: CheckState
  needsRecheck: boolean
  onCheck: () => void
  onApply: () => void
  resultRef: React.RefObject<HTMLDivElement | null>
}) {

  // ── IDLE / NEEDS-RECHECK ────────────────────────────────────────────────────
  if (state.status === 'idle' || needsRecheck) {
    return (
      <div className="cmp-idle">
        <div className="cmp-idle-body">
          <span className="cmp-idle-eyebrow">EU-Pflichtcheck</span>
          <p className="cmp-idle-text">
            {needsRecheck
              ? 'Du hast den Text geändert. Bitte erneut prüfen vor der Veröffentlichung.'
              : 'Gesundheitsaussagen müssen vor der Veröffentlichung auf EU-Konformität geprüft werden.'}
          </p>
        </div>
        <button type="button" onClick={onCheck} className="cmp-idle-btn">
          {needsRecheck ? 'Erneut prüfen' : 'Jetzt prüfen'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
        <style jsx>{`
          .cmp-idle {
            margin-top: 10px;
            display: flex; align-items: center; gap: 16px;
            background: #fff;
            border: 1px solid #E5E7EB;
            border-radius: 16px; padding: 16px 20px;
            box-shadow: 0 1px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(194,166,203,0.12);
          }
          .cmp-idle-body { flex: 1; min-width: 0; }
          .cmp-idle-eyebrow {
            display: inline-block; font-size: 10px; font-weight: 700;
            letter-spacing: 0.1em; text-transform: uppercase;
            color: #C2A6CB; margin-bottom: 5px;
          }
          .cmp-idle-text {
            margin: 0; font-size: 13.5px; color: #4B5563; line-height: 1.5;
          }
          .cmp-idle-btn {
            flex-shrink: 0; display: flex; align-items: center; gap: 8px;
            font-size: 14px; font-weight: 700; color: #fff;
            background: #111827; border: none; border-radius: 12px;
            padding: 12px 20px; cursor: pointer; white-space: nowrap;
            box-shadow: 0 4px 14px rgba(17,24,39,0.18);
            transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s, opacity 0.15s;
          }
          .cmp-idle-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(17,24,39,0.24); }
          .cmp-idle-btn:active { transform: scale(0.97); }
          @media (max-width: 600px) {
            .cmp-idle { flex-direction: column; align-items: stretch; gap: 12px; padding: 16px; }
            .cmp-idle-btn { justify-content: center; padding: 14px 20px; font-size: 15px; border-radius: 12px; }
          }
        `}</style>
      </div>
    )
  }

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <div className="cmp-loading">
        {/* Animated ring */}
        <div className="cmp-loading-ring" aria-hidden>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="15" stroke="#F3E8FF" strokeWidth="3"/>
            <circle cx="18" cy="18" r="15" stroke="#C2A6CB" strokeWidth="3"
              strokeLinecap="round" strokeDasharray="18 76"
              style={{ animation: 'cmp-spin 0.85s linear infinite', transformOrigin: '18px 18px' }}/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cmp-loading-title">Wird geprüft…</div>
          <div className="cmp-loading-sub">KI analysiert auf EU-Gesundheitsrecht</div>
        </div>
        {/* Shimmer bar */}
        <div className="cmp-shimmer-wrap">
          <div className="cmp-shimmer-bar" />
          <div className="cmp-shimmer-bar" style={{ width: '65%', animationDelay: '0.2s' }} />
          <div className="cmp-shimmer-bar" style={{ width: '80%', animationDelay: '0.1s' }} />
        </div>
        <style jsx>{`
          .cmp-loading {
            margin-top: 10px; display: flex; align-items: center; gap: 14px;
            background: #FAFAFA; border: 1px solid #F3E8FF;
            border-radius: 16px; padding: 16px 20px; overflow: hidden;
            animation: cmp-fadein 0.2s ease-out;
          }
          @keyframes cmp-fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes cmp-spin { to { transform: rotate(360deg); } }
          .cmp-loading-ring { flex-shrink: 0; }
          .cmp-loading-title { font-size: 15px; font-weight: 700; color: #111827; letter-spacing: -0.01em; }
          .cmp-loading-sub { font-size: 12.5px; color: #9CA3AF; margin-top: 3px; }
          .cmp-shimmer-wrap { display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; width: 80px; }
          .cmp-shimmer-bar {
            height: 8px; width: 100%; border-radius: 6px;
            background: linear-gradient(90deg, #F3E8FF 25%, #E9D5FF 50%, #F3E8FF 75%);
            background-size: 200% 100%;
            animation: cmp-shimmer 1.4s ease-in-out infinite;
          }
          @keyframes cmp-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
          @media (max-width: 480px) { .cmp-shimmer-wrap { display: none; } }
        `}</style>
      </div>
    )
  }

  // ── OK ──────────────────────────────────────────────────────────────────────
  if (state.status === 'ok' && !needsRecheck) {
    return (
      <div className="cmp-ok">
        <div className="cmp-ok-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12l5 5 11-11" className="cmp-ok-path" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cmp-ok-title">Kein Verstoß gefunden</div>
          <div className="cmp-ok-sub">Dein Text ist EU-konform und bereit zur Veröffentlichung.</div>
        </div>
        <button type="button" onClick={onCheck} className="cmp-ok-retry">Erneut prüfen</button>
        <style jsx>{`
          .cmp-ok {
            margin-top: 10px; display: flex; align-items: center; gap: 14px;
            background: #fff; border: 1px solid #D1FAE5;
            border-radius: 16px; padding: 16px 20px;
            box-shadow: 0 2px 16px rgba(16,185,129,0.08);
            animation: cmp-ok-in 0.45s cubic-bezier(0.34,1.2,0.64,1);
          }
          @keyframes cmp-ok-in { from { opacity: 0; transform: scale(0.96) translateY(-4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          .cmp-ok-icon {
            width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
            background: #059669; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 14px rgba(5,150,105,0.28);
            animation: cmp-pop 0.4s cubic-bezier(0.34,1.56,0.64,1);
          }
          @keyframes cmp-pop { 0% { transform: scale(0.2); opacity: 0; } 70% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
          .cmp-ok-path {
            stroke-dasharray: 30; stroke-dashoffset: 30;
            animation: cmp-draw 0.4s ease-out 0.2s forwards;
          }
          @keyframes cmp-draw { to { stroke-dashoffset: 0; } }
          .cmp-ok-title { font-size: 15px; font-weight: 700; color: #064E3B; letter-spacing: -0.01em; }
          .cmp-ok-sub { font-size: 12.5px; color: #059669; margin-top: 3px; }
          .cmp-ok-retry {
            flex-shrink: 0; font-size: 12px; font-weight: 600; color: #374151;
            background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 9px;
            padding: 8px 14px; cursor: pointer; white-space: nowrap; transition: background 0.15s;
          }
          .cmp-ok-retry:hover { background: #F3F4F6; }
          @media (max-width: 480px) { .cmp-ok-retry { display: none; } }
        `}</style>
      </div>
    )
  }

  // ── ERROR ───────────────────────────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <div style={{
        marginTop: 10, display: 'flex', alignItems: 'center', gap: 14,
        background: '#fff', border: '1px solid #FECACA',
        borderRadius: 16, padding: '16px 20px',
        boxShadow: '0 2px 12px rgba(239,68,68,0.08)',
        animation: 'cmp-fadein 0.2s ease-out',
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EF4444', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(239,68,68,0.25)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>Prüfung fehlgeschlagen</div>
          <div style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 3 }}>{state.message}</div>
        </div>
        <button type="button" onClick={onCheck} style={{
          flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#fff',
          background: '#111827', border: 'none', borderRadius: 10, padding: '10px 16px',
          cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(17,24,39,0.15)',
        }}>Erneut</button>
      </div>
    )
  }

  // ── ISSUES ──────────────────────────────────────────────────────────────────
  if (state.status === 'issues' && !needsRecheck) {
    return (
      <div ref={resultRef}>

        {/* ── Issue summary header ── */}
        <div className="cmp-issues-head">
          <div className="cmp-issues-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01"/>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cmp-issues-title">
              {state.issues.length} {state.issues.length === 1 ? 'Stelle' : 'Stellen'} überarbeiten
            </div>
            <div className="cmp-issues-sub">Dein Text hat EU-rechtlich problematische Aussagen — KI-Vorschlag unten</div>
          </div>
        </div>

        {/* ── Detail card ── */}
        <div className="cmp-detail">
          {/* Issue list */}
          <div className="cmp-detail-sect">
            <div className="cmp-label">Was angepasst werden muss</div>
            <ul className="cmp-issue-list">
              {state.issues.map((issue, i) => (
                <li key={i} className="cmp-issue-item" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="cmp-issue-quote">„{issue.quote}&quot;</div>
                  <div className="cmp-issue-reason">{issue.reason}</div>
                </li>
              ))}
            </ul>
          </div>

          {/* Suggestion */}
          {state.suggested_html && (
            <div className="cmp-detail-sect">
              <div className="cmp-label">KI-Vorschlag — in deinem Stil, EU-konform</div>
              <div className="cmp-suggestion" dangerouslySetInnerHTML={{ __html: state.suggested_html }} />
            </div>
          )}

          {/* Actions */}
          <div className="cmp-actions">
            {state.suggested_html && (
              <button type="button" onClick={onApply} className="cmp-apply">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                Vorschlag übernehmen
              </button>
            )}
            <button type="button" onClick={onCheck} className="cmp-self">
              Selbst überarbeiten &amp; erneut prüfen
            </button>
          </div>
        </div>

        <style jsx>{`
          /* ── Issues head ── */
          .cmp-issues-head {
            margin-top: 10px; display: flex; align-items: center; gap: 14px;
            background: #fff; border: 1px solid #FECACA;
            border-radius: 16px 16px 0 0; padding: 16px 20px;
            box-shadow: 0 -1px 0 0 #FECACA;
            animation: cmp-issues-in 0.4s cubic-bezier(0.34,1.1,0.64,1);
          }
          @keyframes cmp-issues-in { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
          .cmp-issues-icon {
            width: 46px; height: 46px; border-radius: 13px; flex-shrink: 0;
            background: #EF4444; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 14px rgba(239,68,68,0.28);
            animation: cmp-shake 0.45s ease-out 0.35s;
          }
          @keyframes cmp-shake { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-4deg)} 40%{transform:rotate(4deg)} 60%{transform:rotate(-2deg)} 80%{transform:rotate(2deg)} }
          .cmp-issues-title { font-size: 16px; font-weight: 800; color: #111827; letter-spacing: -0.02em; }
          .cmp-issues-sub { font-size: 12.5px; color: #9CA3AF; margin-top: 4px; line-height: 1.4; }

          /* ── Detail card ── */
          .cmp-detail {
            background: #fff; border: 1px solid #FECACA; border-top: none;
            border-radius: 0 0 16px 16px; overflow: hidden;
            box-shadow: 0 8px 32px rgba(239,68,68,0.07), 0 2px 8px rgba(0,0,0,0.04);
            animation: cmp-detail-in 0.35s ease-out 0.08s both;
          }
          @keyframes cmp-detail-in { from { opacity: 0; } to { opacity: 1; } }
          .cmp-detail-sect { padding: 18px 20px; border-bottom: 1px solid #FEF2F2; }
          .cmp-label {
            font-size: 10px; font-weight: 800; letter-spacing: 0.1em;
            text-transform: uppercase; color: #FCA5A5; margin-bottom: 12px;
          }

          /* Issue items */
          .cmp-issue-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
          .cmp-issue-item {
            padding: 12px 14px; border-radius: 12px;
            background: #FFF7F7; border: 1px solid #FEE2E2;
            animation: cmp-item-in 0.3s ease-out both;
          }
          @keyframes cmp-item-in { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
          .cmp-issue-quote { font-size: 13px; font-weight: 700; color: #991B1B; line-height: 1.4; margin-bottom: 3px; }
          .cmp-issue-reason { font-size: 12.5px; color: #6B7280; line-height: 1.45; }

          /* Suggestion */
          .cmp-suggestion {
            background: #F0FDF4; border: 1.5px solid #A7F3D0;
            border-radius: 12px; padding: 14px 16px;
            font-size: 14px; line-height: 1.65; color: #111827;
          }
          .cmp-suggestion :global(p) { margin: 0 0 8px; }
          .cmp-suggestion :global(p:last-child) { margin-bottom: 0; }
          .cmp-suggestion :global(strong) { font-weight: 700; }
          .cmp-suggestion :global(em) { font-style: italic; }
          .cmp-suggestion :global(ul), .cmp-suggestion :global(ol) { margin: 0 0 8px; padding-left: 20px; }

          /* Actions */
          .cmp-actions { padding: 18px 20px; display: flex; flex-direction: column; gap: 8px; }
          .cmp-apply {
            display: flex; align-items: center; justify-content: center; gap: 10px;
            width: 100%; padding: 17px 24px; font-size: 16px; font-weight: 800;
            background: #111827; color: #fff;
            border: none; border-radius: 13px; cursor: pointer; letter-spacing: -0.01em;
            box-shadow: 0 6px 20px rgba(17,24,39,0.2);
            transition: transform 0.15s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.15s, opacity 0.15s;
            min-height: 56px;
          }
          .cmp-apply:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(17,24,39,0.26); }
          .cmp-apply:active { transform: scale(0.98); box-shadow: 0 3px 10px rgba(17,24,39,0.18); }
          .cmp-self {
            width: 100%; padding: 13px; font-size: 13px; font-weight: 500;
            background: transparent; color: #9CA3AF; border: none; cursor: pointer;
            transition: color 0.15s; text-align: center;
          }
          .cmp-self:hover { color: #4B5563; }

          /* Shared animation */
          @keyframes cmp-fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

          /* ── Mobile ── */
          @media (max-width: 600px) {
            .cmp-issues-head { padding: 14px 16px; gap: 12px; }
            .cmp-issues-title { font-size: 15px; }
            .cmp-detail-sect { padding: 14px 16px; }
            .cmp-actions { padding: 14px 16px; }
            .cmp-apply { font-size: 15px; padding: 16px; min-height: 52px; }
          }
          @media (max-width: 380px) {
            .cmp-issues-icon { width: 40px; height: 40px; border-radius: 11px; }
            .cmp-issues-title { font-size: 14px; }
          }
        `}</style>
      </div>
    )
  }

  return null
}
