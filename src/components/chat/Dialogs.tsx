'use client'

/** Bestätigungs- und Melde-Dialoge des Besucher-Chats (Esc schließt, Fokus wandert in den Dialog). */
import { useEffect, useId, useRef, useState } from 'react'
import { REPORT_REASONS } from './utils'
import type { ReportReason } from './mock'

function useDialogA11y(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  // onClose kommt als neue Funktion bei jedem Render der Elternseite (Polling) – deshalb über ein Ref,
  // sonst würde der Fokus alle paar Sekunden zurückspringen.
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const onClose = () => closeRef.current()
    const previous = document.activeElement as HTMLElement | null
    const el = ref.current
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('button, [href], input, textarea, select')
    first?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key === 'Tab' && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>('button, [href], input, textarea, select'))
          .filter(x => !x.hasAttribute('disabled'))
        if (items.length === 0) return
        const a = items[0], z = items[items.length - 1]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    const bodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = bodyOverflow
      previous?.focus?.()
    }
  }, [])
  return ref
}

function Shell({ children, onClose, labelledBy, dialogRef }: {
  children: React.ReactNode; onClose: () => void; labelledBy: string; dialogRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="fixed inset-0 z-[61] flex items-end sm:items-center justify-center p-0 sm:p-6 pointer-events-none">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          className="relative bg-white pointer-events-auto w-full sm:w-auto sm:max-w-[480px] rounded-t-3xl sm:rounded-3xl overflow-hidden"
          style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.20), 0 0 0 1px rgba(0,0,0,0.04)', animation: 'fsChatDialogIn 0.24s cubic-bezier(0.32,0.72,0,1)', minWidth: 'min(440px, 100vw)' }}
        >
          <div className="sm:hidden flex justify-center pt-3 flex-shrink-0">
            <div className="w-12 h-1.5 rounded-full" style={{ background: '#D1D5DB' }} />
          </div>
          {children}
        </div>
      </div>
      <style>{`@keyframes fsChatDialogIn { from { transform: translateY(16px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </>
  )
}

const btnBase: React.CSSProperties = {
  height: 44, padding: '0 18px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
}

export function ConfirmDialog({ title, text, confirmLabel, destructive, busy, onConfirm, onClose }: {
  title: string
  text: string
  confirmLabel: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const ref = useDialogA11y(onClose)
  const id = useId()
  return (
    <Shell onClose={onClose} labelledBy={id} dialogRef={ref}>
      <div className="px-6 pt-6 pb-5 sm:px-7">
        <h2 id={id} className="text-lg font-bold text-gray-900 tracking-tight">{title}</h2>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: '#6B7280' }}>{text}</p>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 pb-6 sm:px-7" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))' }}>
        {/* Bei zerstörenden Aktionen liegt der Fokus zuerst auf „Abbrechen“ – ein versehentliches Enter löscht dann nichts. */}
        <button type="button" onClick={onClose} disabled={busy} data-autofocus={destructive ? '' : undefined} style={{ ...btnBase, background: '#F3F4F6', color: '#374151' }}>
          Abbrechen
        </button>
        <button
          type="button"
          data-autofocus={destructive ? undefined : ''}
          onClick={onConfirm}
          disabled={busy}
          style={{ ...btnBase, background: destructive ? '#DC2626' : '#1a1a1a', color: '#fff', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'Bitte warten…' : confirmLabel}
        </button>
      </div>
    </Shell>
  )
}

export function ReportDialog({ visitorName, alreadyBlocked, busy, error, onSubmit, onClose }: {
  visitorName: string
  alreadyBlocked: boolean
  busy?: boolean
  error?: string | null
  onSubmit: (input: { reason: ReportReason; note?: string; block: boolean }) => void
  onClose: () => void
}) {
  const ref = useDialogA11y(onClose)
  const id = useId()
  const [reason, setReason] = useState<ReportReason>('spam')
  const [note, setNote] = useState('')
  const [block, setBlock] = useState(!alreadyBlocked)

  const noteRequired = reason === 'other' && note.trim().length === 0

  return (
    <Shell onClose={onClose} labelledBy={id} dialogRef={ref}>
      <form
        onSubmit={e => { e.preventDefault(); if (!noteRequired && !busy) onSubmit({ reason, note: note.trim() || undefined, block }) }}
        className="flex flex-col max-h-[88vh]"
      >
        <div className="px-6 pt-6 pb-4 sm:px-7 flex-shrink-0">
          <h2 id={id} className="text-lg font-bold text-gray-900 tracking-tight">Gespräch melden</h2>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#6B7280' }}>
            Wir sehen uns das Gespräch mit <strong style={{ color: '#111' }}>{visitorName}</strong> an und melden uns innerhalb von 24 Stunden.
          </p>
        </div>

        <div className="px-6 sm:px-7 overflow-y-auto flex-1 min-h-0">
          <fieldset className="flex flex-col gap-2" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="text-[11px] font-bold uppercase tracking-[0.08em] mb-2" style={{ color: '#94A3B8' }}>Grund</legend>
            {REPORT_REASONS.map(r => {
              const active = reason === r.value
              return (
                <label
                  key={r.value}
                  className="flex items-start gap-3 rounded-2xl px-4 py-3 cursor-pointer transition-colors"
                  style={{ border: `1.5px solid ${active ? '#1a1a1a' : '#E5E7EB'}`, background: active ? '#FAFAFA' : '#fff' }}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={active}
                    onChange={() => setReason(r.value)}
                    data-autofocus={r.value === 'spam' ? '' : undefined}
                    className="mt-0.5"
                    style={{ accentColor: '#1a1a1a', width: 16, height: 16, flexShrink: 0 }}
                  />
                  <span className="flex flex-col">
                    <span className="text-[14.5px] font-semibold text-gray-900">{r.label}</span>
                    <span className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{r.hint}</span>
                  </span>
                </label>
              )
            })}
          </fieldset>

          <label className="block mt-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: '#94A3B8' }}>
              Notiz {reason === 'other' ? '(bitte ausfüllen)' : '(optional)'}
            </span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Was ist passiert?"
              className="mt-1.5 w-full rounded-2xl px-4 py-3 text-[15px] outline-none"
              style={{ border: '1.5px solid #E5E7EB', fontFamily: 'inherit', resize: 'vertical', color: '#111', lineHeight: 1.5 }}
              onFocus={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
            />
          </label>

          <label className="flex items-center justify-between gap-4 mt-4 mb-2 rounded-2xl px-4 py-3" style={{ background: '#F8FAFC' }}>
            <span className="flex flex-col">
              <span className="text-[14.5px] font-semibold text-gray-900">Besucher zusätzlich sperren</span>
              <span className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                {alreadyBlocked ? 'Dieser Besucher ist bereits gesperrt.' : 'Kann dir dann auf keiner deiner Seiten mehr schreiben.'}
              </span>
            </span>
            <Switch checked={block} disabled={alreadyBlocked} onChange={setBlock} label="Besucher zusätzlich sperren" />
          </label>

          {error && (
            <p role="alert" className="text-sm rounded-xl px-3 py-2 mb-2" style={{ background: '#FEF2F2', color: '#B91C1C' }}>{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 pt-4 sm:px-7 flex-shrink-0" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))' }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ ...btnBase, background: '#F3F4F6', color: '#374151' }}>
            Abbrechen
          </button>
          <button type="submit" disabled={busy || noteRequired} style={{ ...btnBase, background: '#1a1a1a', color: '#fff', opacity: busy || noteRequired ? 0.5 : 1 }}>
            {busy ? 'Wird gesendet…' : 'Melden'}
          </button>
        </div>
      </form>
    </Shell>
  )
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative flex-shrink-0 transition-colors"
      style={{
        width: 46, height: 28, borderRadius: 14, border: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer',
        background: checked ? '#1a1a1a' : '#D1D5DB', opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        className="absolute top-[3px] transition-transform"
        style={{ left: 3, width: 22, height: 22, borderRadius: 11, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transform: checked ? 'translateX(18px)' : 'translateX(0)' }}
      />
    </button>
  )
}
