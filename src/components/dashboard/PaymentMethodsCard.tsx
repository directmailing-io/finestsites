'use client'

import { useEffect, useState } from 'react'

/**
 * Stored payment methods + the fallback rule (Einstellungen → Zahlung).
 *
 * Adding a method happens in the Stripe portal. Here the customer decides
 * which one is charged (Standard) and whether SEPA may be used as a fallback
 * when the card fails. Card as fallback for a failed SEPA debit is always on
 * — it is instant and avoids a second failed-debit fee.
 */

type PaymentMethod = {
  id: string
  type: 'card' | 'sepa_debit'
  label: string
  expMonth: number | null
  expYear: number | null
  expired: boolean
  isDefault: boolean
}

export function PaymentMethodsCard() {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [fallbackSepa, setFallbackSepa] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/billing/payment-methods')
      .then(r => r.json())
      .then(d => {
        setMethods(Array.isArray(d.methods) ? d.methods : [])
        setFallbackSepa(!!d.fallback_sepa)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function patch(body: Record<string, unknown>, key: string) {
    setSaving(key)
    setError('')
    try {
      const res = await fetch('/api/billing/payment-methods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Speichern fehlgeschlagen.')
      setMethods(Array.isArray(d.methods) ? d.methods : [])
      setFallbackSepa(!!d.fallback_sepa)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
  if (methods.length === 0) return null

  const hasCard = methods.some(m => m.type === 'card' && !m.expired)
  const hasSepa = methods.some(m => m.type === 'sepa_debit')

  return (
    <div className="rounded-2xl p-5 sm:p-6" style={{ background: '#F8FAFC', border: '1.5px solid #E5E7EB' }}>
      <p className="text-sm font-bold text-gray-900">Deine Zahlungsmethoden</p>
      <p className="text-xs mt-0.5 mb-4" style={{ color: '#94A3B8' }}>
        Der Standard wird abgebucht. Schlägt er fehl, holen wir die Zahlung automatisch über eine hinterlegte Karte nach.
      </p>

      <div className="flex flex-col gap-2">
        {methods.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: '#fff', border: m.isDefault ? '1.5px solid #111827' : '1px solid #E5E7EB' }}>
            <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#F1F5F9' }}>
              {m.type === 'card'
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="1.75" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{m.label}</p>
              <p className="text-xs" style={{ color: m.expired ? '#DC2626' : '#94A3B8' }}>
                {m.type === 'card'
                  ? (m.expired ? 'Abgelaufen' : `Gültig bis ${String(m.expMonth).padStart(2, '0')}/${m.expYear}`)
                  : 'Bestätigung dauert 1–2 Wochen'}
              </p>
            </div>
            {m.isDefault ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#111827', color: '#fff' }}>Standard</span>
            ) : (
              <button
                onClick={() => patch({ default_payment_method: m.id }, m.id)}
                disabled={saving !== null || m.expired}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                style={{ background: '#F1F5F9', color: '#111827' }}
              >
                {saving === m.id ? '…' : 'Als Standard'}
              </button>
            )}
          </div>
        ))}
      </div>

      {hasCard && hasSepa && (
        <label className="flex items-start gap-3 mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={fallbackSepa}
            disabled={saving !== null}
            onChange={e => patch({ fallback_sepa: e.target.checked }, 'fallback')}
            className="mt-0.5"
          />
          <span className="text-xs leading-relaxed" style={{ color: '#475569' }}>
            <strong className="text-gray-900">SEPA als Ersatz nutzen, wenn die Karte fehlschlägt.</strong> Dauert 1–2 Wochen, deine Seite bleibt so lange online. Eine geplatzte Lastschrift kann bei deiner Bank Gebühren kosten.
          </span>
        </label>
      )}

      {!hasCard && (
        <p className="text-xs mt-4 leading-relaxed" style={{ color: '#475569' }}>
          <strong className="text-gray-900">Tipp:</strong> Hinterleg zusätzlich eine Karte über &quot;Zahlung verwalten&quot;. Platzt eine Lastschrift, buchen wir sofort über die Karte, und deine Seite ist keine Sekunde offline.
        </p>
      )}

      {error && <p className="text-xs mt-3" style={{ color: '#DC2626' }}>{error}</p>}
    </div>
  )
}
