'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface Commission {
  id: string
  gross_amount: number
  commission_amount: number
  status: string
  available_at: string
  paid_at: string | null
  created_at: string
}

interface Payout {
  id: string
  total_amount: number
  commission_count: number
  period_start: string
  period_end: string
  status: string
  paid_at: string | null
}

interface ReferredUser {
  id: string
  email: string
  username: string | null
  plan: string
  billing_interval: string
  subscription_status: string | null
  created_at: string
}

interface Stats {
  username: string | null
  stripe_connect_id: string | null
  affiliate_onboarded: boolean
  bank_last4: string | null
  bank_name: string | null
  stripe_balance_available_cents: number
  referral_count: number
  total_pending_cents: number
  total_paid_cents: number
  commissions: Commission[]
  payouts: Payout[]
  referred_users: ReferredUser[]
}

function euros(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const PLAN_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited' }
const PLAN_COLOR: Record<string, { bg: string; color: string }> = {
  starter:   { bg: '#EFF6FF', color: '#1D4ED8' },
  pro:       { bg: '#F5F3FF', color: '#6D28D9' },
  unlimited: { bg: '#ECFDF5', color: '#065F46' },
}
const STATUS_DOT: Record<string, string> = {
  active: '#22C55E', trialing: '#F97316', past_due: '#EF4444', canceled: '#9CA3AF',
}
const COMMISSION_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  pending:     { label: 'Wartefrist',       bg: '#FFF7ED', text: '#B45309' },
  processing:  { label: 'In Bearbeitung',   bg: '#FEF9C3', text: '#854D0E' },
  available:   { label: 'Auszahlbar',       bg: '#ECFDF5', text: '#065F46' },
  paid:        { label: 'Ausgezahlt',       bg: '#EFF6FF', text: '#1D4ED8' },
  reversed:    { label: 'Storniert',        bg: '#F3F4F6', text: '#6B7280' },
}

export default function AffiliatePage() {
  const params = useSearchParams()
  const connectStatus = params.get('connect')

  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [copied, setCopied] = useState(false)
  const [payingOut, setPayingOut] = useState(false)
  const [payoutMsg, setPayoutMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [stripeLinkLoading, setStripeLinkLoading] = useState(false)

  useEffect(() => {
    fetch('/api/affiliate/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function startConnect() {
    setConnecting(true)
    setConnectError('')
    try {
      const res = await fetch('/api/affiliate/connect', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else { setConnectError(data.error ?? 'Fehler beim Öffnen des Stripe-Formulars.'); setConnecting(false) }
    } catch { setConnectError('Verbindung fehlgeschlagen.'); setConnecting(false) }
  }

  async function openStripeDashboard() {
    setStripeLinkLoading(true)
    try {
      const res = await fetch('/api/affiliate/dashboard-link')
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer')
      else console.error('[stripe-dashboard]', data.error)
    } catch (e) {
      console.error('[stripe-dashboard]', e)
    } finally {
      setStripeLinkLoading(false)
    }
  }

  async function requestPayout() {
    setPayingOut(true)
    setPayoutMsg(null)
    try {
      const res = await fetch('/api/affiliate/payout', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unbekannter Fehler')
      if (data.paid > 0) {
        setPayoutMsg({ type: 'success', text: `${euros(data.amount_cents)} wurden auf dein Konto überwiesen.` })
        const r = await fetch('/api/affiliate/stats')
        setStats(await r.json())
      } else {
        setPayoutMsg({ type: 'error', text: data.message ?? 'Keine auszahlbaren Provisionen.' })
      }
    } catch (e: unknown) {
      setPayoutMsg({ type: 'error', text: e instanceof Error ? e.message : 'Fehler bei der Auszahlung.' })
    } finally {
      setPayingOut(false) }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-4 pt-6">
      {[1,2,3].map(i => <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />)}
    </div>
  )

  const availableCents    = stats?.commissions?.filter(c => c.status === 'available').reduce((s, c) => s + c.commission_amount, 0) ?? 0
  const pendingCents      = stats?.commissions?.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0) ?? 0
  const paidCents         = stats?.total_paid_cents ?? 0
  const balanceSufficient = (stats?.stripe_balance_available_cents ?? 0) >= availableCents
  const canPayout         = availableCents > 0 && stats?.affiliate_onboarded && balanceSufficient
  const payoutPending     = availableCents > 0 && stats?.affiliate_onboarded && !balanceSufficient
  const referralUrl    = stats?.username ? `${typeof window !== 'undefined' ? window.location.origin : 'https://finestsites.de'}/register?ref=${stats.username}` : ''

  return (
    <div className="max-w-2xl space-y-3">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Partnerplattform</h1>
        <p className="text-sm text-gray-500 mt-0.5">Empfehle FinestSites und verdiene automatisch Provision.</p>
      </div>

      {/* ── Status banners ───────────────────────────────────────────────────── */}
      {connectStatus === 'success' && (
        <Banner type="success">Bankkonto eingerichtet — du wirst automatisch ausgezahlt.</Banner>
      )}
      {connectStatus === 'pending' && (
        <Banner type="warning">Noch nicht abgeschlossen — bitte fahre mit der Einrichtung fort.</Banner>
      )}
      {payoutMsg && (
        <Banner type={payoutMsg.type === 'success' ? 'success' : 'error'}>{payoutMsg.text}</Banner>
      )}
      {!stats?.username && (
        <Banner type="warning">
          Kein Benutzername gesetzt. Dein Partnercode ist dein Benutzername — bitte schließe zuerst die{' '}
          <a href="/onboarding/username" className="underline font-semibold">Kontoeröffnung</a> ab.
        </Banner>
      )}

      {/* ── Earnings overview ───────────────────────────────────────────────── */}
      <div className="bg-gray-900 rounded-2xl p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Deine Einnahmen</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold tabular-nums">{euros(availableCents)}</p>
            <p className="text-xs text-gray-400 mt-1">Verfügbar</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-amber-400">{euros(pendingCents)}</p>
            <p className="text-xs text-gray-400 mt-1">In Wartefrist</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-gray-400">{euros(paidCents)}</p>
            <p className="text-xs text-gray-400 mt-1">Ausgezahlt</p>
          </div>
        </div>

        {/* Payout action inside the overview card */}
        {(canPayout || payoutPending) && (
          <div className="mt-5 pt-5 border-t border-gray-700 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{euros(availableCents)} Provision</p>
              <p className="text-xs mt-0.5" style={{ color: payoutPending ? '#FCD34D' : '#9CA3AF' }}>
                {payoutPending
                  ? 'Stripe verarbeitet die Zahlung noch — verfügbar in ca. 7 Tagen'
                  : 'Wird sofort auf dein Bankkonto überwiesen'}
              </p>
            </div>
            {canPayout ? (
              <button
                onClick={requestPayout}
                disabled={payingOut}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0"
                style={{ background: payingOut ? '#374151' : '#fff', color: payingOut ? '#9CA3AF' : '#111827', cursor: payingOut ? 'wait' : 'pointer' }}
              >
                {payingOut ? <><Spinner /> Wird überwiesen…</> : <>Jetzt auszahlen</>}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl flex-shrink-0"
                style={{ background: '#374151', color: '#9CA3AF' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                In Bearbeitung
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Referral code ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Dein Partnercode</p>
            <p className="text-3xl font-black text-gray-900 font-mono tracking-tight">{stats?.username ?? '—'}</p>
            <p className="text-xs text-gray-400 mt-1">Partner erhalten 15% Rabatt auf den ersten Monat</p>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => { navigator.clipboard.writeText(stats?.username ?? ''); setCopied(true); setTimeout(() => setCopied(false), 2500) }}
              disabled={!stats?.username}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: copied ? '#ECFDF5' : '#111827', color: copied ? '#065F46' : '#fff', cursor: stats?.username ? 'pointer' : 'not-allowed' }}
            >
              {copied ? <><CheckIcon size={14} /> Kopiert!</> : <><CopyIcon size={14} /> Code kopieren</>}
            </button>
            {referralUrl && (
              <button
                onClick={() => { navigator.clipboard.writeText(referralUrl); setCopied(true); setTimeout(() => setCopied(false), 2500) }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-gray-500 border border-gray-200 hover:border-gray-300 transition-all"
              >
                <LinkIcon size={12} /> Link kopieren
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">So funktioniert&apos;s</p>
        <div className="flex items-center gap-0">
          <Step icon={<UserIcon />} title="Partner registriert" sub="mit deinem Code" />
          <Arrow />
          <Step icon={<CardIcon />} title="Partner zahlt" sub="mit 15% Rabatt" />
          <Arrow />
          <Step icon={<EuroIcon />} title="Du verdienst" sub="15% Provision" highlight />
        </div>
        <div className="mt-5 pt-4 border-t border-gray-50 grid grid-cols-3 gap-3 text-center">
          <InfoPill label="Wartefrist" value="14 Tage" sub="Rückbuchungsschutz" />
          <InfoPill label="Provision" value="15%" sub="vom Nettoumsatz" />
          <InfoPill label="Auszahlung" value="Monatlich" sub="automatisch" />
        </div>
      </div>

      {/* ── Auszahlungskonto ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold text-gray-900">Auszahlungskonto</p>
          {stats?.affiliate_onboarded
            ? <StatusBadge type="active">Eingerichtet</StatusBadge>
            : <StatusBadge type="warning">Nicht eingerichtet</StatusBadge>}
        </div>
        {stats?.affiliate_onboarded ? (
          <div className="flex items-center justify-between mt-3 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                  <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                <span className="text-sm text-gray-700 font-medium font-mono">
                  {stats.bank_name ? `${stats.bank_name} ` : ''}
                  {stats.bank_last4 ? <>•••• •••• •••• <strong>{stats.bank_last4}</strong></> : 'Bankkonto verbunden'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 ml-5">Auszahlungen erfolgen automatisch am 1. jeden Monats.</p>
            </div>
            <button
              onClick={openStripeDashboard}
              disabled={stripeLinkLoading}
              className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 disabled:opacity-50"
            >
              {stripeLinkLoading ? 'Öffnet…' : <><span>Stripe</span> <ExternalIcon size={10} /></>}
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-gray-500 mb-3">
              Hinterlege einmalig dein Bankkonto, damit wir deine Provisionen überweisen können.
              Deine IBAN wird sicher bei Stripe gespeichert — nicht bei FinestSites.
            </p>
            {connectError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-xl p-3 mb-3">{connectError}</p>
            )}
            <button
              onClick={startConnect} disabled={connecting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: connecting ? '#F3F4F6' : '#111827', color: connecting ? '#9CA3AF' : '#fff', cursor: connecting ? 'wait' : 'pointer' }}
            >
              {connecting ? <><Spinner /> Öffnet Stripe…</> : <>Bankkonto einrichten</>}
            </button>
          </div>
        )}
      </div>

      {/* ── Partner list ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-gray-50">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Deine Partner</p>
          <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full">
            {stats?.referral_count ?? 0}
          </span>
        </div>
        {!stats?.referred_users?.length ? (
          <div className="px-6 py-8 text-center">
            <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <UsersIcon />
            </div>
            <p className="text-sm font-medium text-gray-700">Noch keine Partner</p>
            <p className="text-xs text-gray-400 mt-1">Teile deinen Code — geworbene Partner erscheinen hier.</p>
          </div>
        ) : (
          <div>
            {stats!.referred_users.map((u, i) => {
              const plan = PLAN_COLOR[u.plan] ?? PLAN_COLOR.starter
              const dot = STATUS_DOT[u.subscription_status ?? ''] ?? '#D1D5DB'
              return (
                <div key={u.id} className="flex items-center justify-between px-6 py-3.5"
                  style={{ borderTop: i > 0 ? '1px solid #F9FAFB' : undefined }}>
                  <div className="min-w-0 mr-3">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDate(u.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: plan.bg, color: plan.color }}>
                      {PLAN_LABEL[u.plan] ?? u.plan}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Commission history ───────────────────────────────────────────────── */}
      {(stats?.commissions?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-6 pt-5 pb-4 border-b border-gray-50">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Provisionen</p>
          </div>
          {stats!.commissions.map((c, i) => {
            // available = 14-day hold passed; if Stripe balance not yet ready → show as 'processing'
            const effectiveStatus = c.status === 'available' && !balanceSufficient ? 'processing' : c.status
            const s = COMMISSION_STATUS[effectiveStatus] ?? COMMISSION_STATUS.pending
            return (
              <div key={c.id} className="flex items-center justify-between px-6 py-4"
                style={{ borderTop: i > 0 ? '1px solid #F9FAFB' : undefined }}>
                <div>
                  <p className="text-sm font-medium text-gray-800">{fmtDate(c.created_at)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Umsatz {euros(c.gross_amount)}
                    {c.status === 'pending' && c.available_at && (
                      <span className="ml-2">· verfügbar ab {fmtDate(c.available_at)}</span>
                    )}
                    {c.status === 'available' && !balanceSufficient && (
                      <span className="ml-2">· Stripe verarbeitet noch ca. 7 Tage</span>
                    )}
                    {c.status === 'paid' && c.paid_at && (
                      <span className="ml-2">· ausgezahlt {fmtDate(c.paid_at)}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-gray-900 tabular-nums">+{euros(c.commission_amount)}</p>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: s.bg, color: s.text }}>
                    {s.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Payout history ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="px-6 pt-5 pb-4 border-b border-gray-50 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Auszahlungen</p>
          {stats?.affiliate_onboarded && (
            <button
              onClick={openStripeDashboard}
              disabled={stripeLinkLoading}
              className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              {stripeLinkLoading ? 'Öffnet…' : <><span>Stripe-Übersicht</span> <ExternalIcon size={10} /></>}
            </button>
          )}
        </div>
        {(stats?.payouts?.length ?? 0) === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm font-medium text-gray-500">Noch keine Auszahlungen</p>
            <p className="text-xs text-gray-400 mt-1">
              {stats?.affiliate_onboarded
                ? 'Provisionen werden automatisch am 1. jeden Monats überwiesen.'
                : 'Richte zuerst dein Bankkonto ein.'}
            </p>
          </div>
        ) : (
          stats!.payouts.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between px-6 py-4"
              style={{ borderTop: i > 0 ? '1px solid #F9FAFB' : undefined }}>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {fmtDate(p.period_start)} – {fmtDate(p.period_end)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.commission_count} Provision{p.commission_count !== 1 ? 'en' : ''}
                  {p.paid_at && <span className="ml-2">· {fmtDate(p.paid_at)}</span>}
                </p>
              </div>
              <p className="text-sm font-bold text-gray-900 tabular-nums">{euros(p.total_amount)}</p>
            </div>
          ))
        )}
      </div>

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Banner({ type, children }: { type: 'success' | 'warning' | 'error'; children: React.ReactNode }) {
  const styles = {
    success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', stroke: '#16A34A' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', stroke: '#D97706' },
    error:   { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', stroke: '#DC2626' },
  }[type]
  return (
    <div className="px-4 py-3 rounded-2xl flex items-center gap-3 text-sm font-medium"
      style={{ background: styles.bg, border: `1px solid ${styles.border}`, color: styles.text }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={styles.stroke} strokeWidth="2.5" className="flex-shrink-0">
        {type === 'success'
          ? <path d="M20 6 9 17l-5-5"/>
          : <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></>}
      </svg>
      {children}
    </div>
  )
}

function StatusBadge({ type, children }: { type: 'active' | 'warning'; children: React.ReactNode }) {
  const s = type === 'active'
    ? { bg: '#F0FDF4', color: '#15803D', dot: '#22C55E' }
    : { bg: '#FFFBEB', color: '#92400E', dot: '#F59E0B' }
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {children}
    </span>
  )
}

function InfoPill({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-gray-50 rounded-xl py-3 px-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-base font-bold text-gray-900 mt-0.5">{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}

function Step({ icon, title, sub, highlight }: { icon: React.ReactNode; title: string; sub: string; highlight?: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center text-center">
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
        style={{ background: highlight ? '#ECFDF5' : '#F8FAFC', border: `1px solid ${highlight ? '#A7F3D0' : '#F1F5F9'}` }}>
        {icon}
      </div>
      <p className="text-xs font-semibold text-gray-800 leading-tight">{title}</p>
      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{sub}</p>
    </div>
  )
}

function Arrow() {
  return (
    <div className="flex items-center justify-center w-8 mt-[-12px] flex-shrink-0">
      <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
        <path d="M1 5h13M11 1l4 4-4 4" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

function Spinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  )
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
}
function CopyIcon({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
}
function LinkIcon({ size = 12 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
}
function ExternalIcon({ size = 10 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
}
function UserIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function CardIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
}
function EuroIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5"><path d="M4 10h12M4 14h12M19.5 5A9 9 0 105 16.5"/></svg>
}
function UsersIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
}
