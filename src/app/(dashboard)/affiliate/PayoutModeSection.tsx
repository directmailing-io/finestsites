'use client'

import { useState } from 'react'
import type { PayoutMode } from '@/lib/affiliate/payout-mode'
import { useAppMode } from '@/components/app-mode/AppMode'

export interface PayoutModeState {
  mode: PayoutMode
  can_change: boolean
  has_connect: boolean
  connect_ready: boolean
  subscription_active: boolean
  /** eigenes Kundenguthaben bei Stripe in Cent (positiv = Guthaben), null = gerade nicht abrufbar */
  customer_credit_cents: number | null
}

function euros(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

const OPTIONS: { key: PayoutMode; title: string; desc: string; recommended?: boolean }[] = [
  {
    key: 'credit',
    title: 'Mit meinem Abo verrechnen',
    desc: 'Deine Provision wird jeden Monat automatisch von deiner nächsten FinestSites-Rechnung abgezogen. Kein Auszahlungskonto nötig, nur deine Angaben für die Abrechnung (unten).',
    recommended: true,
  },
  {
    key: 'payout',
    title: 'Aufs Bankkonto auszahlen',
    desc: 'Ab 10 € einmal im Monat. Dafür richtest du einmal ein Auszahlungskonto bei Stripe ein.',
  },
]

/** App-Modus (Cookie fs_app=1): gleiche Optionen, aber ohne „Abo“/„Rechnung“ (keine Kauf-Hinweise in der App). */
const APP_OPTION_TEXT: Record<PayoutMode, { title: string; desc: string }> = {
  credit: {
    title: 'Mit meinem Konto verrechnen',
    desc: 'Deine Provision wird jeden Monat automatisch mit deinem FinestSites-Konto verrechnet. Kein Auszahlungskonto nötig, nur deine Angaben für die Abrechnung (unten).',
  },
  payout: {
    title: 'Aufs Bankkonto auszahlen',
    desc: 'Ab 10 € einmal im Monat. Dafür richtest du einmal ein Auszahlungskonto bei Stripe ein.',
  },
}

/** „So bekommst du deine Provision“: Verrechnung mit dem Abo (Standard) oder Überweisung. */
export function PayoutModeSection({ state, onChanged }: {
  state: PayoutModeState
  onChanged: (s: PayoutModeState) => void
}) {
  const appMode = useAppMode()
  const [saving, setSaving] = useState<PayoutMode | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function choose(mode: PayoutMode) {
    if (mode === state.mode || saving || !state.can_change) return
    setSaving(mode); setMsg(null)
    try {
      const res = await fetch('/api/affiliate/payout-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ type: 'error', text: data.error ?? 'Das hat nicht geklappt. Versuch es bitte nochmal.' })
        return
      }
      onChanged(data as PayoutModeState)
      setMsg({
        type: 'success',
        text: mode === 'credit'
          ? (appMode ? 'Gespeichert. Ab jetzt wird deine Provision mit deinem Konto verrechnet.' : 'Gespeichert. Ab jetzt wird deine Provision mit deinem Abo verrechnet.')
          : data.connect_ready
            ? 'Gespeichert. Ab jetzt wird deine Provision ab 10 € aufs Bankkonto überwiesen.'
            : 'Gespeichert. Richte jetzt noch einmal dein Auszahlungskonto ein, dann läuft alles automatisch.',
      })
    } catch {
      setMsg({ type: 'error', text: 'Keine Verbindung. Versuch es bitte gleich nochmal.' })
    } finally {
      setSaving(null)
    }
  }

  const credit = state.customer_credit_cents
  const showCredit = credit != null && (state.mode === 'credit' || credit > 0)

  return (
    <section id="provision" className="rounded-3xl p-6 mb-5 scroll-mt-6" style={{ background: '#fff', border: '1.5px solid #E5E7EB' }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94A3B8' }}>So bekommst du deine Provision</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="So bekommst du deine Provision">
        {OPTIONS.map(o => {
          const active = state.mode === o.key
          const busy = saving === o.key
          const text = appMode ? APP_OPTION_TEXT[o.key] : o
          return (
            <button key={o.key} type="button" role="radio" aria-checked={active}
              onClick={() => choose(o.key)}
              disabled={!state.can_change || !!saving}
              className="text-left rounded-2xl p-4 min-h-[44px] transition-all disabled:cursor-default"
              style={{
                background: active ? '#F8FAFC' : '#fff',
                border: active ? '2px solid #1a1a1a' : '1.5px solid #E5E7EB',
                margin: active ? 0 : '0.5px',
                opacity: saving && !busy ? 0.6 : 1,
              }}>
              <span className="flex items-center gap-2 mb-1">
                <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ border: active ? '5px solid #1a1a1a' : '1.5px solid #D1D5DB' }} />
                <span className="text-sm font-bold text-gray-900">{text.title}</span>
              </span>
              {o.recommended && (
                <span className="inline-block ml-6 mb-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#ECFDF5', color: '#065F46' }}>Empfohlen</span>
              )}
              <span className="block text-xs text-gray-500 leading-relaxed pl-6">
                {busy ? 'Wird gespeichert…' : text.desc}
              </span>
            </button>
          )
        })}
      </div>

      {showCredit && (
        <div className="flex items-center justify-between gap-3 mt-4 px-4 py-3 rounded-2xl" style={{ background: '#F8FAFC' }}>
          <p className="text-sm text-gray-600">{appMode ? 'Guthaben auf deinem Konto' : 'Guthaben für deine nächsten Rechnungen'}</p>
          <p className="text-sm font-bold tabular-nums text-gray-900 whitespace-nowrap">{euros(credit!)}</p>
        </div>
      )}

      {state.mode === 'credit' && !state.subscription_active && (
        <p className="text-sm mt-4 px-4 py-3 rounded-2xl leading-relaxed" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
          {appMode
            ? 'Gerade können wir nichts verrechnen. Dein Guthaben bleibt dir erhalten.'
            : 'Du hast gerade kein aktives Abo. Solange können wir nichts verrechnen. Dein Guthaben bleibt dir erhalten.'}
          {state.connect_ready
            ? ' Weil du ein Auszahlungskonto hast, überweisen wir es dir ab 10 €.'
            : ' Möchtest du es lieber ausgezahlt bekommen, wähle „Aufs Bankkonto auszahlen“.'}
        </p>
      )}

      {!state.can_change && (
        <p className="text-xs mt-3" style={{ color: '#64748B' }}>Umstellen kann nur der Partner selbst.</p>
      )}

      {msg && (
        <p className="text-sm mt-4 px-4 py-3 rounded-2xl" role="status"
          style={msg.type === 'success'
            ? { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' }
            : { background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
          {msg.text}
        </p>
      )}
    </section>
  )
}
