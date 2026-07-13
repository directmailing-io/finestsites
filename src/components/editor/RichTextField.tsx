'use client'

/**
 * RichTextField — laypeople-friendly WYSIWYG editor.
 * Toolbar: Bold, Italic, Underline (via mark), Bullet list, Numbered list, Link, Clear.
 * Output: clean HTML (paragraphs + inline formatting + lists).
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
      StarterKit.configure({ heading: false, codeBlock: false, code: false, horizontalRule: false, blockquote: false }),
      Link.configure({
        openOnClick: false, autolink: true, defaultProtocol: 'https',
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
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          background: 'linear-gradient(135deg,#DCFCE7,#F0FDF4)',
          border: '1.5px solid #86EFAC', borderRadius: 14, marginBottom: 10,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: '#16A34A', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(22,163,74,0.3)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#14532D' }}>EU-Pflichtcheck bestanden</div>
            <div style={{ fontSize: 11.5, color: '#166534', marginTop: 1 }}>Freigegeben zur Veröffentlichung.</div>
          </div>
          <button onClick={onComplianceRevoked} style={{
            fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 8,
            border: '1.5px solid #86EFAC', background: '#fff', color: '#15803D',
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}>Bearbeiten</button>
        </div>
        <div style={{ border: '1.5px solid #E5E7EB', borderRadius: 14, padding: '14px 16px', background: '#FAFAFA', fontSize: 14, color: '#374151', lineHeight: '1.6' }}
          dangerouslySetInnerHTML={{ __html: value || '' }} />
      </div>
    )
  }

  if (!editor) {
    return (
      <div className="w-full rounded-2xl bg-white" style={{ border: '1.5px solid #E5E7EB', minHeight: 200, padding: 16 }}>
        <p className="text-sm text-gray-300">Editor lädt…</p>
      </div>
    )
  }

  const isActive = (m: string) => editor.isActive(m)
  const textLength = editor.state.doc.textContent.length
  const overLimit = maxLength != null && textLength > maxLength
  const isScanning = checkState.status === 'loading'
  const btn = (active: boolean) => ({ background: active ? '#1a1a1a' : 'transparent', color: active ? '#fff' : '#374151' })

  return (
    <div>
      {/* ── Editor ── */}
      <div className={`rt-wrap${isScanning ? ' rt-wrap--scan' : ''}`}>
        <div className="rt-toolbar">
          <button type="button" title="Fett" onClick={() => editor.chain().focus().toggleBold().run()} className="rt-btn" style={btn(isActive('bold'))}>
            <strong style={{ fontFamily: 'Georgia, serif' }}>B</strong>
          </button>
          <button type="button" title="Kursiv" onClick={() => editor.chain().focus().toggleItalic().run()} className="rt-btn" style={btn(isActive('italic'))}>
            <em style={{ fontFamily: 'Georgia, serif' }}>I</em>
          </button>
          <button type="button" title="Durchgestrichen" onClick={() => editor.chain().focus().toggleStrike().run()} className="rt-btn" style={btn(isActive('strike'))}>
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </button>
          <div className="rt-sep" />
          <button type="button" title="Aufzählung" onClick={() => editor.chain().focus().toggleBulletList().run()} className="rt-btn" style={btn(isActive('bulletList'))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
              <circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/>
            </svg>
          </button>
          <button type="button" title="Nummerierte Liste" onClick={() => editor.chain().focus().toggleOrderedList().run()} className="rt-btn" style={btn(isActive('orderedList'))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
              <text x="3" y="9" fontSize="7" fill="currentColor" fontWeight="700">1</text>
              <text x="3" y="15" fontSize="7" fill="currentColor" fontWeight="700">2</text>
              <text x="3" y="21" fontSize="7" fill="currentColor" fontWeight="700">3</text>
            </svg>
          </button>
          <div className="rt-sep" />
          <button type="button" title="Link" onClick={() => { const prev = editor.getAttributes('link').href as string | undefined; setLinkUrl(prev ?? ''); setShowLinkInput(s => !s) }} className="rt-btn" style={btn(isActive('link') || showLinkInput)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
          </button>
          <div className="rt-spacer" />
          <button type="button" title="Formatierung entfernen" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} className="rt-btn rt-btn--ghost">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7V5h14v2"/><path d="M3 17l6-6 4 4 6-6"/><path d="M14 5l-4 14"/>
            </svg>
          </button>
        </div>

        {showLinkInput && (
          <div className="rt-link-row">
            <input type="url" autoFocus value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } if (e.key === 'Escape') { setShowLinkInput(false); setLinkUrl('') } }}
              placeholder="https://… oder leer lassen, um Link zu entfernen" className="rt-link-input" />
            <button type="button" onClick={addLink} className="rt-link-apply">{linkUrl ? 'Anwenden' : 'Entfernen'}</button>
          </div>
        )}

        {/* Content + scan overlay */}
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <EditorContent editor={editor} />
          {isScanning && <div className="rt-scan-beam" aria-hidden="true" />}
        </div>

        {/* Footer */}
        {maxLength != null && (
          <div className="rt-footer">
            <span style={{ color: overLimit ? '#DC2626' : '#9CA3AF' }}>{textLength}/{maxLength} Zeichen</span>
          </div>
        )}

        <style jsx global>{`
          .rt-wrap {
            background: #fff; border: 1.5px solid #E5E7EB; border-radius: 16px;
            overflow: hidden; transition: border-color 0.2s, box-shadow 0.3s;
          }
          .rt-wrap:focus-within { border-color: #1a1a1a; }
          .rt-wrap--scan {
            border-color: #C2A6CB !important;
            box-shadow: 0 0 0 4px rgba(194,166,203,0.18), 0 0 32px rgba(194,166,203,0.14) !important;
          }
          .rt-scan-beam {
            position: absolute; left: 0; right: 0; height: 2px;
            background: linear-gradient(90deg, transparent 0%, rgba(194,166,203,0.5) 15%, #C2A6CB 50%, rgba(194,166,203,0.5) 85%, transparent 100%);
            pointer-events: none; top: 0;
            animation: rt-scan 1.8s ease-in-out infinite;
            box-shadow: 0 0 12px 2px rgba(194,166,203,0.4);
          }
          @keyframes rt-scan {
            0%   { top: 0;    opacity: 0; }
            5%   { opacity: 1; }
            95%  { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
          .rt-toolbar {
            display: flex; align-items: center; gap: 4px; padding: 8px 10px;
            border-bottom: 1px solid #F1F5F9; background: #FAFAFA; flex-wrap: wrap;
          }
          .rt-btn {
            display: inline-flex; align-items: center; justify-content: center;
            min-width: 30px; height: 30px; padding: 0 8px; border-radius: 8px;
            background: transparent; color: #374151; font-size: 13px; font-weight: 600;
            cursor: pointer; transition: background 0.12s, color 0.12s; border: none;
          }
          .rt-btn:hover { background: #E5E7EB; }
          .rt-btn--ghost { opacity: 0.55; }
          .rt-btn--ghost:hover { opacity: 1; }
          .rt-sep { width: 1px; height: 18px; background: #E5E7EB; margin: 0 4px; }
          .rt-spacer { flex: 1; }
          .rt-link-row { display: flex; gap: 6px; padding: 8px 10px; border-bottom: 1px solid #F1F5F9; background: #F8FAFC; }
          .rt-link-input { flex: 1; padding: 7px 10px; font-size: 13px; border: 1px solid #E5E7EB; border-radius: 8px; outline: none; background: #fff; }
          .rt-link-input:focus { border-color: #1a1a1a; }
          .rt-link-apply { padding: 7px 14px; font-size: 12px; font-weight: 600; color: #fff; background: #1a1a1a; border: none; border-radius: 8px; cursor: pointer; }
          .rt-content { min-height: 160px; padding: 14px 16px; font-size: 14px; line-height: 1.6; color: #1a1a1a; outline: none; }
          .rt-content p { margin: 0 0 6px; }
          .rt-content p:last-child { margin-bottom: 0; }
          .rt-content p + p { margin-top: 0; }
          .rt-content ul, .rt-content ol { margin: 6px 0; padding-left: 20px; }
          .rt-content li { margin-bottom: 4px; }
          .rt-content strong { font-weight: 700; }
          .rt-content em { font-style: italic; }
          .rt-content s { text-decoration: line-through; }
          .rt-content a { color: #1a1a1a; text-decoration: underline; text-decoration-color: rgba(0,0,0,0.3); text-underline-offset: 2px; cursor: pointer; }
          .rt-content a:hover { text-decoration-color: currentColor; }
          .rt-content p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #9CA3AF; float: left; height: 0; pointer-events: none; }
          .rt-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; font-size: 11px; color: #9CA3AF; border-top: 1px solid #F1F5F9; background: #FAFAFA; }
        `}</style>
      </div>

      {/* ── Compliance section — directly below the editor ── */}
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
      <div className="cs-idle">
        <div className="cs-idle-pulse" aria-hidden="true" />
        <div className="cs-idle-left">
          <div className="cs-idle-badge">Pflicht</div>
          <div>
            <div className="cs-idle-title">
              {needsRecheck ? 'Text geändert — Prüfung wiederholen' : 'EU-Gesundheitscheck'}
            </div>
            <div className="cs-idle-sub">
              {needsRecheck
                ? 'Dein Text wurde verändert. Bitte prüfe ihn erneut bevor du veröffentlichst.'
                : 'Gesundheitsaussagen müssen vor der Veröffentlichung geprüft werden (EU-Recht).'}
            </div>
          </div>
        </div>
        <button type="button" onClick={onCheck} className="cs-idle-btn">
          {needsRecheck ? 'Erneut prüfen' : 'Jetzt prüfen lassen'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
        <style jsx>{`
          .cs-idle {
            position: relative; overflow: hidden;
            margin-top: 10px; padding: 16px 18px;
            background: rgba(194,166,203,0.08);
            border: 1.5px solid rgba(194,166,203,0.4);
            border-left: 4px solid #C2A6CB;
            border-radius: 14px;
            display: flex; align-items: center; gap: 14px;
          }
          .cs-idle-pulse {
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(194,166,203,0.06);
            animation: cs-idle-pulse 3s ease-in-out infinite;
            pointer-events: none;
          }
          @keyframes cs-idle-pulse {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
          }
          .cs-idle-left { display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 0; position: relative; }
          .cs-idle-badge {
            flex-shrink: 0; font-size: 9.5px; font-weight: 800; letter-spacing: 0.07em;
            text-transform: uppercase; color: #fff; background: #C2A6CB;
            padding: 3px 7px; border-radius: 5px; margin-top: 2px; white-space: nowrap;
          }
          .cs-idle-title { font-size: 14px; font-weight: 700; color: #3D2645; line-height: 1.3; }
          .cs-idle-sub { font-size: 12px; color: #9C7DAA; margin-top: 3px; line-height: 1.4; }
          .cs-idle-btn {
            position: relative; flex-shrink: 0;
            display: flex; align-items: center; gap: 7px;
            font-size: 13.5px; font-weight: 700; color: #fff;
            background: #3D2645; border: none; border-radius: 10px;
            padding: 11px 18px; cursor: pointer; white-space: nowrap;
            box-shadow: 0 4px 14px rgba(61,38,69,0.25);
            transition: transform 0.12s, box-shadow 0.12s, opacity 0.12s;
            animation: cs-btn-appear 0.5s cubic-bezier(0.34,1.56,0.64,1);
          }
          @keyframes cs-btn-appear {
            0% { transform: scale(0.85); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          .cs-idle-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(61,38,69,0.3); }
          .cs-idle-btn:active { transform: scale(0.97); }
          @media (max-width: 520px) {
            .cs-idle { flex-wrap: wrap; }
            .cs-idle-btn { width: 100%; justify-content: center; padding: 14px; font-size: 15px; }
          }
        `}</style>
      </div>
    )
  }

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <div className="cs-loading">
        <div className="cs-loading-ring">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="13" stroke="rgba(194,166,203,0.2)" strokeWidth="3"/>
            <circle cx="16" cy="16" r="13" stroke="#C2A6CB" strokeWidth="3"
              strokeLinecap="round" strokeDasharray="20 62"
              style={{ animation: 'cs-spin 0.9s linear infinite', transformOrigin: 'center' }}/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cs-loading-title">KI prüft deinen Text…</div>
          <div className="cs-loading-sub">Analysiert auf verbotene EU-Gesundheitsaussagen</div>
        </div>
        <div className="cs-dots">
          <span className="cs-dot" style={{ animationDelay: '0s' }} />
          <span className="cs-dot" style={{ animationDelay: '0.2s' }} />
          <span className="cs-dot" style={{ animationDelay: '0.4s' }} />
        </div>
        <style jsx>{`
          .cs-loading {
            margin-top: 10px; padding: 16px 18px;
            background: rgba(194,166,203,0.06);
            border: 1.5px solid rgba(194,166,203,0.3);
            border-radius: 14px;
            display: flex; align-items: center; gap: 14px;
            animation: cs-fadein 0.2s ease-out;
          }
          @keyframes cs-fadein { from { opacity: 0; } to { opacity: 1; } }
          .cs-loading-ring { flex-shrink: 0; }
          @keyframes cs-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .cs-loading-title { font-size: 14px; font-weight: 700; color: #3D2645; }
          .cs-loading-sub { font-size: 12px; color: #9C7DAA; margin-top: 3px; }
          .cs-dots { display: flex; gap: 5px; align-items: center; flex-shrink: 0; }
          .cs-dot {
            width: 7px; height: 7px; border-radius: 50%; background: #C2A6CB;
            animation: cs-dot-pulse 1.3s ease-in-out infinite;
            display: inline-block;
          }
          @keyframes cs-dot-pulse {
            0%, 80%, 100% { transform: scale(0.4); opacity: 0.3; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  // ── OK ──────────────────────────────────────────────────────────────────────
  if (state.status === 'ok' && !needsRecheck) {
    return (
      <div className="cs-ok">
        <div className="cs-ok-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12l5 5 11-11" className="cs-ok-path" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cs-ok-title">Alles in Ordnung!</div>
          <div className="cs-ok-sub">Kein Verstoß gefunden — bereit zur Veröffentlichung.</div>
        </div>
        <button type="button" onClick={onCheck} className="cs-ok-recheck">Erneut prüfen</button>
        <style jsx>{`
          .cs-ok {
            margin-top: 10px; padding: 16px 18px;
            background: linear-gradient(135deg,#DCFCE7,#F0FDF4);
            border: 1.5px solid #86EFAC;
            border-radius: 14px;
            display: flex; align-items: center; gap: 14px;
            animation: cs-ok-slide 0.4s cubic-bezier(0.34,1.2,0.64,1);
          }
          @keyframes cs-ok-slide {
            0% { transform: translateY(-6px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          .cs-ok-icon {
            width: 46px; height: 46px; border-radius: 14px; flex-shrink: 0;
            background: #16A34A; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 16px rgba(22,163,74,0.35);
            animation: cs-ok-pop 0.45s cubic-bezier(0.34,1.56,0.64,1);
          }
          @keyframes cs-ok-pop {
            0% { transform: scale(0.2); opacity: 0; }
            70% { transform: scale(1.08); }
            100% { transform: scale(1); opacity: 1; }
          }
          .cs-ok-path {
            stroke-dasharray: 32;
            stroke-dashoffset: 32;
            animation: cs-check-draw 0.45s ease-out 0.25s forwards;
          }
          @keyframes cs-check-draw {
            from { stroke-dashoffset: 32; }
            to   { stroke-dashoffset: 0; }
          }
          .cs-ok-title { font-size: 15px; font-weight: 800; color: #14532D; }
          .cs-ok-sub { font-size: 12.5px; color: #166534; margin-top: 3px; opacity: 0.9; }
          .cs-ok-recheck {
            flex-shrink: 0; font-size: 12px; font-weight: 600; color: #15803D;
            background: #fff; border: 1.5px solid #86EFAC; border-radius: 8px;
            padding: 8px 14px; cursor: pointer; white-space: nowrap;
            transition: background 0.15s;
          }
          .cs-ok-recheck:hover { background: #F0FDF4; }
        `}</style>
      </div>
    )
  }

  // ── ERROR ───────────────────────────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <div style={{
        marginTop: 10, padding: '14px 18px',
        background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderLeft: '4px solid #DC2626',
        borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14,
        animation: 'cs-fadein 0.2s ease-out',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#7F1D1D' }}>Prüfung fehlgeschlagen</div>
          <div style={{ fontSize: 12.5, color: '#B91C1C', marginTop: 3 }}>{state.message}</div>
        </div>
        <button type="button" onClick={onCheck} style={{
          flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#fff',
          background: '#DC2626', border: 'none', borderRadius: 9, padding: '9px 16px',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}>Erneut versuchen</button>
      </div>
    )
  }

  // ── ISSUES ──────────────────────────────────────────────────────────────────
  if (state.status === 'issues' && !needsRecheck) {
    return (
      <div ref={resultRef}>
        {/* Alert banner */}
        <div className="cs-issues-banner">
          <div className="cs-issues-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01"/>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="cs-issues-title">
              {state.issues.length} {state.issues.length === 1 ? 'Stelle gefunden' : 'Stellen gefunden'}
            </div>
            <div className="cs-issues-sub">Dein Text enthält EU-rechtlich problematische Aussagen — KI-Vorschlag unten</div>
          </div>
        </div>

        {/* Detail card */}
        <div className="cs-detail">
          <div className="cs-detail-section">
            <div className="cs-detail-label">Was überarbeitet werden muss</div>
            <ul className="cs-detail-list">
              {state.issues.map((issue, i) => (
                <li key={i} className="cs-detail-item" style={{ animationDelay: `${i * 0.07}s` }}>
                  <span className="cs-detail-quote">„{issue.quote}&quot;</span>
                  <span className="cs-detail-reason">{issue.reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {state.suggested_html && (
            <div className="cs-detail-section">
              <div className="cs-detail-label">KI-Vorschlag — konform &amp; in deinem Stil</div>
              <div className="cs-detail-text" dangerouslySetInnerHTML={{ __html: state.suggested_html }} />
            </div>
          )}

          <div className="cs-detail-actions">
            {state.suggested_html && (
              <button type="button" onClick={onApply} className="cs-apply">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                Vorschlag übernehmen
              </button>
            )}
            <button type="button" onClick={onCheck} className="cs-skip">Selbst überarbeiten &amp; erneut prüfen</button>
          </div>
        </div>

        <style jsx>{`
          .cs-issues-banner {
            margin-top: 10px; padding: 16px 18px;
            background: linear-gradient(135deg,#FEF2F2,#FFF1F1);
            border: 1.5px solid #FCA5A5; border-left: 4px solid #DC2626;
            border-radius: 14px;
            display: flex; align-items: center; gap: 14px;
            animation: cs-issues-in 0.4s cubic-bezier(0.34,1.1,0.64,1);
          }
          @keyframes cs-issues-in {
            0% { transform: translateY(-8px) scale(0.97); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
          .cs-issues-icon {
            width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
            background: #DC2626; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 16px rgba(220,38,38,0.3);
            animation: cs-icon-shake 0.5s ease-out 0.3s;
          }
          @keyframes cs-icon-shake {
            0%,100% { transform: rotate(0deg); }
            20% { transform: rotate(-5deg); }
            40% { transform: rotate(5deg); }
            60% { transform: rotate(-3deg); }
            80% { transform: rotate(3deg); }
          }
          .cs-issues-title { font-size: 15px; font-weight: 800; color: #7F1D1D; }
          .cs-issues-sub { font-size: 12.5px; color: #B91C1C; margin-top: 3px; opacity: 0.9; line-height: 1.4; }
          .cs-detail {
            margin-top: 6px;
            background: #fff;
            border: 1.5px solid #FCA5A5;
            border-radius: 14px; overflow: hidden;
            box-shadow: 0 4px 20px rgba(220,38,38,0.08);
            animation: cs-detail-in 0.35s ease-out 0.1s both;
          }
          @keyframes cs-detail-in {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .cs-detail-section { padding: 16px 18px; border-bottom: 1px solid #FEF2F2; }
          .cs-detail-label {
            font-size: 10px; font-weight: 800; letter-spacing: 0.09em;
            text-transform: uppercase; color: #FCA5A5; margin-bottom: 10px;
          }
          .cs-detail-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 7px; }
          .cs-detail-item {
            padding: 10px 13px;
            background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px;
            display: flex; flex-direction: column; gap: 3px;
            animation: cs-item-in 0.3s ease-out both;
          }
          @keyframes cs-item-in {
            from { opacity: 0; transform: translateX(-6px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .cs-detail-quote { font-size: 13px; font-weight: 700; color: #7F1D1D; line-height: 1.4; }
          .cs-detail-reason { font-size: 12px; color: #B91C1C; line-height: 1.45; }
          .cs-detail-text {
            background: #F0FDF4; border: 1.5px solid #86EFAC; border-radius: 12px;
            padding: 14px 16px; font-size: 14px; line-height: 1.65; color: #064E3B;
          }
          .cs-detail-text :global(p) { margin: 0 0 10px; }
          .cs-detail-text :global(p:last-child) { margin-bottom: 0; }
          .cs-detail-text :global(strong) { font-weight: 700; }
          .cs-detail-text :global(em) { font-style: italic; }
          .cs-detail-text :global(ul), .cs-detail-text :global(ol) { margin: 0 0 10px; padding-left: 22px; }
          .cs-detail-actions { padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
          .cs-apply {
            display: flex; align-items: center; justify-content: center; gap: 9px;
            width: 100%; padding: 16px 20px;
            font-size: 16px; font-weight: 800;
            background: linear-gradient(135deg,#16A34A,#15803D); color: #fff;
            border: none; border-radius: 12px; cursor: pointer;
            box-shadow: 0 6px 20px rgba(22,163,74,0.35);
            transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
            min-height: 54px; letter-spacing: 0.01em;
          }
          .cs-apply:hover { opacity: 0.94; box-shadow: 0 8px 26px rgba(22,163,74,0.4); transform: translateY(-1px); }
          .cs-apply:active { transform: scale(0.98); }
          .cs-skip {
            width: 100%; padding: 12px 20px;
            font-size: 13px; font-weight: 500; color: #9CA3AF;
            background: transparent; border: none; cursor: pointer;
            transition: color 0.15s; text-align: center;
          }
          .cs-skip:hover { color: #6B7280; }
        `}</style>
      </div>
    )
  }

  return null
}
