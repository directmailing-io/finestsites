'use client'

import { useState } from 'react'

function euros(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

interface Props {
  stripeBalanceCents: number
  pendingCount: number
  availableCount: number
  availableTotalCents: number
}

export function AffiliateAdminActions({ stripeBalanceCents, pendingCount, availableCount, availableTotalCents }: Props) {
  const [releasing, setReleasing] = useState(false)
  const [paying, setPaying]       = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null)

  const balanceSufficient = stripeBalanceCents >= availableTotalCents && availableTotalCents > 0

  async function handleRelease() {
    if (!confirm(`Alle ${pendingCount} ausstehenden Provisionen sofort freigeben (14-Tage-Wartefrist überspringen)?`)) return
    setReleasing(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/affiliate/release', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsg({ type: 'success', text: `${data.released} Provision(en) sofort freigegeben.` })
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: unknown) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Fehler' })
    } finally { setReleasing(false) }
  }

  async function handlePayout() {
    if (!confirm('Auszahlung für alle Affiliates mit verfügbaren Provisionen starten?')) return
    setPaying(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/affiliate/trigger-payout', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.paid > 0) {
        setMsg({ type: 'success', text: `${data.paid} Affiliate(s) ausgezahlt. Übersprungen: ${data.skipped}` })
      } else {
        const errResult = data.results?.find((r: { status: string; error?: string }) => r.status === 'error')
        setMsg({ type: 'warning', text: errResult?.error ?? data.message ?? `Nichts ausgezahlt. Übersprungen: ${data.skipped}` })
      }
      setTimeout(() => window.location.reload(), 2000)
    } catch (e: unknown) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Fehler' })
    } finally { setPaying(false) }
  }

  return (
    <div className="rounded-[20px] bg-white p-6 mb-6"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Admin-Aktionen</p>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Manuelle Eingriffe, nur für Testzwecke und Sonderfälle</p>
        </div>
        {/* Stripe balance indicator */}
        <div className="text-right">
          <p className="text-xs font-medium" style={{ color: '#64748B' }}>Stripe-Plattformguthaben</p>
          <p className="text-lg font-bold" style={{ color: stripeBalanceCents > 0 ? '#16A34A' : '#94A3B8' }}>
            {euros(stripeBalanceCents)}
          </p>
          {availableTotalCents > 0 && (
            <p className="text-[11px] mt-0.5" style={{ color: balanceSufficient ? '#16A34A' : '#F97316' }}>
              {balanceSufficient ? '✓ Ausreichend für Auszahlung' : `⚠ Fehlen ${euros(availableTotalCents - stripeBalanceCents)}`}
            </p>
          )}
        </div>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
          style={{
            background: msg.type === 'success' ? '#F0FDF4' : msg.type === 'error' ? '#FEF2F2' : '#FFFBEB',
            color: msg.type === 'success' ? '#15803D' : msg.type === 'error' ? '#991B1B' : '#92400E',
          }}>
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-3">

        {/* Release pending commissions */}
        <button
          onClick={handleRelease}
          disabled={releasing || pendingCount === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-sm font-semibold transition-all"
          style={{
            background: pendingCount === 0 ? '#F8FAFC' : '#FFF7ED',
            color: pendingCount === 0 ? '#94A3B8' : '#C2410C',
            border: `1px solid ${pendingCount === 0 ? '#F1F5F9' : '#FED7AA'}`,
            cursor: pendingCount === 0 ? 'not-allowed' : releasing ? 'wait' : 'pointer',
          }}>
          {releasing ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          )}
          Wartefrist aufheben
          {pendingCount > 0 && <span className="ml-1 text-[11px] opacity-70">({pendingCount})</span>}
        </button>

        {/* Trigger payout */}
        <button
          onClick={handlePayout}
          disabled={paying || availableCount === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-sm font-semibold transition-all"
          style={{
            background: availableCount === 0 ? '#F8FAFC' : balanceSufficient ? '#0F172A' : '#F3F4F6',
            color: availableCount === 0 ? '#94A3B8' : balanceSufficient ? '#fff' : '#6B7280',
            border: `1px solid ${availableCount === 0 ? '#F1F5F9' : balanceSufficient ? '#0F172A' : '#E5E7EB'}`,
            cursor: availableCount === 0 ? 'not-allowed' : paying ? 'wait' : 'pointer',
          }}>
          {paying ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          )}
          Auszahlung starten
          {availableCount > 0 && <span className="ml-1 text-[11px] opacity-70">({euros(availableTotalCents)})</span>}
        </button>

        {!balanceSufficient && availableTotalCents > 0 && (
          <a href="https://dashboard.stripe.com/settings/payouts" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-sm font-medium transition-all"
            style={{ background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Stripe: Manuelle Auszahlung aktivieren
          </a>
        )}

      </div>
    </div>
  )
}
