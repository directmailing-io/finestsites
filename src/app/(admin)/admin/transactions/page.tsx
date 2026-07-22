'use client'

import { useState, useEffect, useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Transaction {
  id: string
  date: number
  username: string | null
  email: string
  plan: string
  billingInterval: 'monthly' | 'yearly'
  grossCents: number
  taxCents: number
  stripFeeCents: number
  affiliateCommissionCents: number
  affiliatePartnerUsername: string | null
  netCents: number
  couponCode: string | null
  couponLabel: string | null
  paymentMethod: 'card' | 'sepa_debit' | null
  paymentMethodLast4: string | null
  status: 'paid' | 'pending' | 'failed' | 'void' | 'uncollectible'
  stripeInvoiceUrl: string | null
}

interface PlannedPayment {
  subscriptionId: string
  username: string | null
  email: string
  plan: string
  billingInterval: 'monthly' | 'yearly'
  nextPaymentDate: number
  expectedGrossCents: number
  estimatedTaxCents: number
  couponCode: string | null
  couponLabel: string | null
  affiliatePartner: string | null
  estimatedAffiliateCents: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function eur(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtDateShort(unix: number) {
  return new Date(unix * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const PLAN_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  starter:   { bg: '#F0FDF4', color: '#15803D', label: 'Starter' },
  pro:       { bg: '#EFF6FF', color: '#1D4ED8', label: 'Pro' },
  unlimited: { bg: '#FAF5FF', color: '#7C3AED', label: 'Unlimited' },
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  paid:          { bg: '#DCFCE7', color: '#15803D', label: 'Erfolgreich' },
  pending:       { bg: '#FFF7ED', color: '#C2410C', label: 'Ausstehend' },
  failed:        { bg: '#FEF2F2', color: '#DC2626', label: 'Fehlgeschlagen' },
  void:          { bg: '#F3F4F6', color: '#6B7280', label: 'Storniert' },
  uncollectible: { bg: '#FEF2F2', color: '#991B1B', label: 'Uneinbringlich' },
}

const PERIODS = [
  { key: 'this_month',    label: 'Dieser Monat' },
  { key: 'last_month',    label: 'Letzter Monat' },
  { key: 'last_3_months', label: 'Letzte 3 Monate' },
  { key: 'last_year',     label: 'Letztes Jahr' },
  { key: 'all',           label: 'Alles' },
]

const STATUSES = [
  { key: 'all',           label: 'Alle' },
  { key: 'paid',          label: 'Erfolgreich' },
  { key: 'pending',       label: 'Ausstehend' },
  { key: 'failed',        label: 'Fehlgeschlagen' },
  { key: 'void',          label: 'Storniert' },
]

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

function SummaryCard({ label, value, sub, color, secondLine }: {
  label: string; value: string; sub: string; color: string; secondLine?: string
}) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-xs" style={{ color: '#94A3B8' }}>{sub}</p>
      {secondLine && <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>{secondLine}</p>}
    </div>
  )
}

function AmountCell({ cents, muted, negative }: { cents: number; muted?: boolean; negative?: boolean }) {
  if (cents === 0 && muted) return <span style={{ color: '#CBD5E1' }}>—</span>
  return (
    <span className="tabular-nums" style={{ color: negative ? '#DC2626' : muted ? '#94A3B8' : '#111827', fontWeight: muted ? 400 : 600 }}>
      {negative && cents > 0 ? '−' : ''}{eur(cents)}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function TransactionsPage() {
  const [period, setPeriod] = useState('this_month')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showPlanned, setShowPlanned] = useState(true)
  const [data, setData] = useState<{ transactions: Transaction[]; planned: PlannedPayment[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/transactions?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period])

  const filtered = useMemo(() => {
    if (!data) return []
    if (statusFilter === 'all') return data.transactions
    return data.transactions.filter(t => t.status === statusFilter)
  }, [data, statusFilter])

  // ── Summary computations (always from full data, not filtered) ────────────
  const allTx = data?.transactions ?? []
  const paidTx    = allTx.filter(t => t.status === 'paid')
  const pendingTx = allTx.filter(t => t.status === 'pending')
  const failedTx  = allTx.filter(t => t.status === 'failed')
  const planned   = data?.planned ?? []

  const sumGross  = (arr: Transaction[]) => arr.reduce((s, t) => s + t.grossCents, 0)
  const sumNet    = (arr: Transaction[]) => arr.reduce((s, t) => s + t.netCents, 0)
  const sumTax    = (arr: Transaction[]) => arr.reduce((s, t) => s + t.taxCents, 0)
  const sumFee    = (arr: Transaction[]) => arr.reduce((s, t) => s + t.stripFeeCents, 0)
  const sumAffl   = (arr: Transaction[]) => arr.reduce((s, t) => s + t.affiliateCommissionCents, 0)

  // Filtered table totals
  const filtGross = filtered.reduce((s, t) => s + t.grossCents, 0)
  const filtTax   = filtered.reduce((s, t) => s + t.taxCents, 0)
  const filtFee   = filtered.reduce((s, t) => s + t.stripFeeCents, 0)
  const filtAffl  = filtered.reduce((s, t) => s + t.affiliateCommissionCents, 0)
  const filtNet   = filtered.reduce((s, t) => s + t.netCents, 0)

  const plannedGross = planned.reduce((s, p) => s + p.expectedGrossCents, 0)
  const plannedAffl  = planned.reduce((s, p) => s + p.estimatedAffiliateCents, 0)
  const plannedTax   = planned.reduce((s, p) => s + p.estimatedTaxCents, 0)

  return (
    <div className="p-6 max-w-[1400px]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transaktionen</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>Alle Einnahmen, Gebühren und geplante Zahlungen</p>
        </div>
        {loading && <div style={{ color: '#94A3B8' }}><Spinner /></div>}
      </div>

      {/* ── Period filter ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className="px-4 py-2 text-sm font-medium rounded-xl transition-all"
            style={{
              background: period === p.key ? '#1a1a1a' : '#F8FAFC',
              color: period === p.key ? '#fff' : '#475569',
              border: period === p.key ? '1px solid #1a1a1a' : '1px solid #E2E8F0',
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SummaryCard
          label="Netto Einnahmen"
          value={eur(sumNet(paidTx))}
          sub={`${paidTx.length} erfolgreiche Zahlungen`}
          secondLine={`Brutto: ${eur(sumGross(paidTx))}`}
          color="#15803D"
        />
        <SummaryCard
          label="Geplant (nächste Periode)"
          value={eur(plannedGross - plannedTax - plannedAffl)}
          sub={`${planned.length} aktive Abos`}
          secondLine={`Brutto erw.: ${eur(plannedGross)}`}
          color="#1D4ED8"
        />
        <SummaryCard
          label="Ausstehend"
          value={eur(sumGross(pendingTx))}
          sub={`${pendingTx.length} Zahlungen (SEPA/offen)`}
          color="#C2410C"
        />
        <SummaryCard
          label="Fehlgeschlagen"
          value={eur(sumGross(failedTx))}
          sub={`${failedTx.length} Zahlungen`}
          color="#DC2626"
        />
      </div>

      {/* ── Deductions breakdown strip ── */}
      {paidTx.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-5 px-4 py-3 rounded-2xl text-sm" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
          <span style={{ color: '#64748B' }}>
            <span className="font-medium text-gray-900">Brutto</span> {eur(sumGross(paidTx))}
          </span>
          <span style={{ color: '#94A3B8' }}>−</span>
          <span style={{ color: '#64748B' }}>
            <span className="font-medium text-gray-900">MwSt</span> {eur(sumTax(paidTx))}
          </span>
          <span style={{ color: '#94A3B8' }}>−</span>
          <span style={{ color: '#64748B' }}>
            <span className="font-medium text-gray-900">Stripe</span> {eur(sumFee(paidTx))}
          </span>
          <span style={{ color: '#94A3B8' }}>−</span>
          <span style={{ color: '#64748B' }}>
            <span className="font-medium text-gray-900">Provision</span> {eur(sumAffl(paidTx))}
          </span>
          <span style={{ color: '#94A3B8' }}>=</span>
          <span className="font-bold" style={{ color: '#15803D' }}>
            Netto {eur(sumNet(paidTx))}
          </span>
        </div>
      )}

      {/* ── Status filter + table ── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #F1F5F9' }}>
        {/* Table header with status filter */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
          <span className="text-xs font-semibold uppercase tracking-widest mr-2" style={{ color: '#94A3B8' }}>Status:</span>
          {STATUSES.map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className="px-3 py-1 text-xs font-medium rounded-lg transition-all"
              style={{
                background: statusFilter === s.key ? '#1a1a1a' : 'transparent',
                color: statusFilter === s.key ? '#fff' : '#64748B',
              }}>
              {s.label}
              {s.key !== 'all' && data && (
                <span className="ml-1.5 tabular-nums" style={{ opacity: 0.7 }}>
                  ({allTx.filter(t => t.status === s.key).length})
                </span>
              )}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-xs" style={{ color: '#94A3B8' }}>{filtered.length} Einträge</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#FAFAFA' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Datum</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Nutzer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Plan</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Brutto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>MwSt</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Stripe</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Provision</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Netto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Methode</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={11} className="text-center py-12" style={{ color: '#94A3B8' }}>
                  <div className="flex items-center justify-center gap-2"><Spinner /> Lade Stripe-Daten…</div>
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={11} className="text-center py-12 text-sm" style={{ color: '#94A3B8' }}>
                  Keine Transaktionen im gewählten Zeitraum.
                </td></tr>
              )}
              {filtered.map((tx, i) => {
                const planStyle = PLAN_STYLE[tx.plan] ?? { bg: '#F3F4F6', color: '#6B7280', label: tx.plan }
                const statusStyle = STATUS_STYLE[tx.status] ?? STATUS_STYLE.pending
                return (
                  <tr key={tx.id} className="transition-colors"
                    style={{ borderBottom: '1px solid #F8FAFC', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F0F9FF')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFAFA')}>

                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#475569', fontSize: '12px' }}>
                      {fmtDate(tx.date)}
                    </td>

                    {/* User */}
                    <td className="px-4 py-3 min-w-[140px]">
                      {tx.username
                        ? <a href={`/admin/users?q=${encodeURIComponent(tx.username)}`} className="font-semibold hover:underline" style={{ color: '#1a1a1a' }}>@{tx.username}</a>
                        : null}
                      <p className="text-xs" style={{ color: '#94A3B8' }}>{tx.email}</p>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: planStyle.bg, color: planStyle.color }}>
                          {planStyle.label}
                        </span>
                        <span className="text-xs" style={{ color: '#CBD5E1' }}>
                          {tx.billingInterval === 'yearly' ? '12M' : '1M'}
                        </span>
                      </div>
                    </td>

                    {/* Brutto */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <AmountCell cents={tx.grossCents} />
                    </td>

                    {/* MwSt */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <AmountCell cents={tx.taxCents} muted negative />
                    </td>

                    {/* Stripe fee */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <AmountCell cents={tx.stripFeeCents} muted negative />
                    </td>

                    {/* Affiliate commission */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {tx.affiliateCommissionCents > 0
                        ? <div>
                            <AmountCell cents={tx.affiliateCommissionCents} muted negative />
                            {tx.affiliatePartnerUsername && (
                              <p className="text-[10px]" style={{ color: '#CBD5E1' }}>@{tx.affiliatePartnerUsername}</p>
                            )}
                          </div>
                        : <span style={{ color: '#CBD5E1' }}>—</span>}
                    </td>

                    {/* Netto */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {tx.status === 'paid'
                        ? <span className="tabular-nums font-bold" style={{ color: tx.netCents >= 0 ? '#15803D' : '#DC2626' }}>{eur(tx.netCents)}</span>
                        : <span style={{ color: '#CBD5E1' }}>—</span>}
                    </td>

                    {/* Coupon code */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {tx.couponCode
                        ? <div>
                            <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded" style={{ background: '#FFF7ED', color: '#C2410C' }}>{tx.couponCode}</span>
                            {tx.couponLabel && <span className="ml-1 text-xs" style={{ color: '#94A3B8' }}>{tx.couponLabel}</span>}
                          </div>
                        : <span style={{ color: '#CBD5E1' }}>—</span>}
                    </td>

                    {/* Payment method */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: '#475569' }}>
                      {tx.paymentMethod === 'card' && (
                        <span className="flex items-center gap-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                          {tx.paymentMethodLast4 ? `···· ${tx.paymentMethodLast4}` : 'Karte'}
                        </span>
                      )}
                      {tx.paymentMethod === 'sepa_debit' && (
                        <span className="flex items-center gap-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                          {tx.paymentMethodLast4 ? `SEPA ···· ${tx.paymentMethodLast4}` : 'SEPA'}
                        </span>
                      )}
                      {!tx.paymentMethod && <span style={{ color: '#CBD5E1' }}>—</span>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                          {statusStyle.label}
                        </span>
                        {tx.stripeInvoiceUrl && (
                          <a href={tx.stripeInvoiceUrl} target="_blank" rel="noopener noreferrer"
                            className="hover:opacity-70 transition-opacity" title="In Stripe öffnen">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* ── Summary row ── */}
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                  <td colSpan={3} className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: '#64748B' }}>
                    Summe ({filtered.length} Einträge)
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums font-bold text-sm" style={{ color: '#1a1a1a' }}>{eur(filtGross)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums text-sm" style={{ color: '#94A3B8' }}>−{eur(filtTax)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums text-sm" style={{ color: '#94A3B8' }}>−{eur(filtFee)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums text-sm" style={{ color: '#94A3B8' }}>−{eur(filtAffl)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums font-bold text-sm" style={{ color: '#15803D' }}>{eur(filtNet)}</span>
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Planned payments section ── */}
      <div className="mt-6">
        <button className="flex items-center gap-2 mb-3" onClick={() => setShowPlanned(v => !v)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: showPlanned ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <h2 className="text-base font-bold text-gray-900">
            Geplante Zahlungen
          </h2>
          <span className="text-sm font-medium px-2 py-0.5 rounded-lg" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
            {planned.length} Abos · erw. {eur(plannedGross)}
          </span>
        </button>

        {showPlanned && planned.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #F1F5F9' }}>
            {/* Planned summary strip */}
            <div className="flex flex-wrap gap-4 px-4 py-3 text-sm" style={{ background: '#F0F9FF', borderBottom: '1px solid #BFDBFE' }}>
              <span style={{ color: '#1e40af' }}>
                <span className="font-medium">Erw. Brutto</span> {eur(plannedGross)}
              </span>
              <span style={{ color: '#93C5FD' }}>−</span>
              <span style={{ color: '#1e40af' }}>
                <span className="font-medium">MwSt ~</span> {eur(plannedTax)}
              </span>
              <span style={{ color: '#93C5FD' }}>−</span>
              <span style={{ color: '#1e40af' }}>
                <span className="font-medium">Provision ~</span> {eur(plannedAffl)}
              </span>
              <span style={{ color: '#93C5FD' }}>=</span>
              <span className="font-bold" style={{ color: '#1D4ED8' }}>
                Erw. Netto ~ {eur(plannedGross - plannedTax - plannedAffl)}
              </span>
              <span className="text-xs ml-auto" style={{ color: '#93C5FD' }}>Stripe-Gebühren nicht berücksichtigt</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#FAFAFA' }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Nächste Zahlung</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Nutzer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Plan</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Erw. Brutto</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>MwSt ~</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Provision ~</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Erw. Netto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Code</th>
                  </tr>
                </thead>
                <tbody>
                  {planned
                    .sort((a, b) => a.nextPaymentDate - b.nextPaymentDate)
                    .map((p, i) => {
                      const planStyle = PLAN_STYLE[p.plan] ?? { bg: '#F3F4F6', color: '#6B7280', label: p.plan }
                      const estimatedNet = p.expectedGrossCents - p.estimatedTaxCents - p.estimatedAffiliateCents
                      return (
                        <tr key={p.subscriptionId}
                          style={{ borderBottom: '1px solid #F8FAFC', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>

                          <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: '#475569' }}>
                            {fmtDateShort(p.nextPaymentDate)}
                          </td>

                          <td className="px-4 py-3 min-w-[140px]">
                            {p.username
                              ? <span className="font-semibold" style={{ color: '#1a1a1a' }}>@{p.username}</span>
                              : null}
                            <p className="text-xs" style={{ color: '#94A3B8' }}>{p.email}</p>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: planStyle.bg, color: planStyle.color }}>
                                {planStyle.label}
                              </span>
                              <span className="text-xs" style={{ color: '#CBD5E1' }}>
                                {p.billingInterval === 'yearly' ? '12M' : '1M'}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums font-semibold" style={{ color: '#1a1a1a' }}>
                            {eur(p.expectedGrossCents)}
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums text-xs" style={{ color: '#94A3B8' }}>
                            −{eur(p.estimatedTaxCents)}
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {p.estimatedAffiliateCents > 0
                              ? <div>
                                  <span className="tabular-nums text-xs" style={{ color: '#94A3B8' }}>−{eur(p.estimatedAffiliateCents)}</span>
                                  {p.affiliatePartner && <p className="text-[10px]" style={{ color: '#CBD5E1' }}>@{p.affiliatePartner}</p>}
                                </div>
                              : <span style={{ color: '#CBD5E1' }}>—</span>}
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className="tabular-nums font-bold" style={{ color: '#1D4ED8' }}>~{eur(estimatedNet)}</span>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            {p.couponCode
                              ? <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded" style={{ background: '#FFF7ED', color: '#C2410C' }}>
                                  {p.couponCode}{p.couponLabel ? ` ${p.couponLabel}` : ''}
                                </span>
                              : <span style={{ color: '#CBD5E1' }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F0F9FF' }}>
                    <td colSpan={3} className="px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: '#1e40af' }}>
                      Gesamt ({planned.length} Abos)
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-sm" style={{ color: '#1a1a1a' }}>{eur(plannedGross)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm" style={{ color: '#94A3B8' }}>−{eur(plannedTax)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm" style={{ color: '#94A3B8' }}>−{eur(plannedAffl)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-sm" style={{ color: '#1D4ED8' }}>~{eur(plannedGross - plannedTax - plannedAffl)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {showPlanned && planned.length === 0 && !loading && (
          <p className="text-sm" style={{ color: '#94A3B8' }}>Keine aktiven Abonnements gefunden.</p>
        )}
      </div>
    </div>
  )
}
