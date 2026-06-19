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

// ── Avatar (for partner list) ───────────────────────────────────────────────
const AVATAR_PALETTE = [
  { bg: '#FFE5D9', fg: '#9A3412' }, { bg: '#FFE4E6', fg: '#9F1239' },
  { bg: '#E0E7FF', fg: '#3730A3' }, { bg: '#D1FAE5', fg: '#065F46' },
  { bg: '#FEF3C7', fg: '#854D0E' }, { bg: '#DBEAFE', fg: '#1E3A8A' },
  { bg: '#F3E8FF', fg: '#6B21A8' }, { bg: '#CFFAFE', fg: '#155E75' },
]
function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}
function emailInitials(email: string): string {
  const local = email.split('@')[0]
  const parts = local.split(/[._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
function Avatar({ seed, size = 40 }: { seed: string; size?: number }) {
  const c = avatarColor(seed)
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 font-semibold"
      style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size * 0.36 }}>
      {emailInitials(seed)}
    </div>
  )
}

export default function AffiliatePage() {
  const params = useSearchParams()
  const connectStatus = params.get('connect')

  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
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
    setConnecting(true); setConnectError('')
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
    } catch (e) { console.error('[stripe-dashboard]', e) }
    finally { setStripeLinkLoading(false) }
  }

  async function requestPayout() {
    setPayingOut(true); setPayoutMsg(null)
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
    } finally { setPayingOut(false) }
  }

  function copyCode() {
    if (!stats?.username) return
    navigator.clipboard.writeText(stats.username)
    setCopied('code')
    setTimeout(() => setCopied(null), 2200)
  }
  function copyLink() {
    if (!referralUrl) return
    navigator.clipboard.writeText(referralUrl)
    setCopied('link')
    setTimeout(() => setCopied(null), 2200)
  }

  if (loading) return (
    <div className="max-w-5xl mx-auto pt-2 space-y-6">
      <div className="h-12 w-56 rounded-2xl bg-gray-100 animate-pulse" />
      <div className="h-40 rounded-3xl bg-gray-100 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-48 rounded-3xl bg-gray-100 animate-pulse" />
        <div className="h-48 rounded-3xl bg-gray-100 animate-pulse" />
      </div>
    </div>
  )

  const availableCents    = stats?.commissions?.filter(c => c.status === 'available').reduce((s, c) => s + c.commission_amount, 0) ?? 0
  const pendingCents      = stats?.commissions?.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0) ?? 0
  const paidCents         = stats?.total_paid_cents ?? 0
  const balanceSufficient = (stats?.stripe_balance_available_cents ?? 0) >= availableCents
  const canPayout         = availableCents > 0 && stats?.affiliate_onboarded && balanceSufficient
  const payoutPending     = availableCents > 0 && stats?.affiliate_onboarded && !balanceSufficient
  const referralUrl       = stats?.username ? `${typeof window !== 'undefined' ? window.location.origin : 'https://finestsites.de'}/register?ref=${stats.username}` : ''

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Partnerprogramm
        </h1>
        <p className="text-base mt-1.5" style={{ color: '#94A3B8' }}>
          Empfehle FinestSites und verdiene <strong className="text-gray-700 font-semibold">15% Provision</strong> pro Empfehlung.
        </p>
      </div>

      {/* ── Banners ─────────────────────────────────────────────────────────── */}
      <div className="space-y-2 mb-6">
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
      </div>

      {/* ── Hero earnings card ──────────────────────────────────────────────── */}
      <section className="rounded-3xl p-7 sm:p-9 mb-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#fff' }}>
        {/* Subtle pattern */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />

        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-6 relative z-10">
          Deine Einnahmen
        </p>
        <div className="grid grid-cols-3 gap-3 sm:gap-8 relative z-10">
          <div>
            <p className="text-xl sm:text-2xl lg:text-4xl font-bold tabular-nums tracking-tight">
              {euros(availableCents)}
            </p>
            <p className="text-xs sm:text-sm text-white/50 mt-1.5">Verfügbar</p>
          </div>
          <div>
            <p className="text-xl sm:text-2xl lg:text-4xl font-bold tabular-nums tracking-tight" style={{ color: '#FBBF24' }}>
              {euros(pendingCents)}
            </p>
            <p className="text-xs sm:text-sm text-white/50 mt-1.5">In Wartefrist</p>
          </div>
          <div>
            <p className="text-xl sm:text-2xl lg:text-4xl font-bold tabular-nums tracking-tight text-white/50">
              {euros(paidCents)}
            </p>
            <p className="text-xs sm:text-sm text-white/50 mt-1.5">Ausgezahlt</p>
          </div>
        </div>

        {(canPayout || payoutPending) && (
          <div className="mt-7 pt-6 flex items-center justify-between gap-4 relative z-10"
            style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
            <div>
              <p className="text-sm font-semibold">{euros(availableCents)} bereit</p>
              <p className="text-xs mt-0.5"
                style={{ color: payoutPending ? '#FBBF24' : 'rgba(255,255,255,0.5)' }}>
                {payoutPending
                  ? 'Stripe verarbeitet noch — verfügbar in ca. 7 Tagen'
                  : 'Wird sofort auf dein Bankkonto überwiesen'}
              </p>
            </div>
            {canPayout ? (
              <button onClick={requestPayout} disabled={payingOut}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 flex-shrink-0"
                style={{ background: '#fff', color: '#0F172A' }}>
                {payingOut ? <><Spinner /> Wird überwiesen…</> : 'Jetzt auszahlen'}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                In Bearbeitung
              </span>
            )}
          </div>
        )}
      </section>

      {/* ── 2-col: Partnercode + How it works ───────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-10">

        {/* Partnercode */}
        <div className="rounded-3xl p-7" style={{ background: '#F8FAFC' }}>
          <p className="text-xs font-semibold text-gray-500 mb-3">Dein Partnercode</p>
          <p className="text-3xl sm:text-4xl font-black text-gray-900 font-mono tracking-tight mb-3 break-all">
            {stats?.username ?? '—'}
          </p>
          <p className="text-sm text-gray-500 mb-5">
            Partner erhalten <strong className="text-gray-700 font-semibold">15% Rabatt</strong> auf den ersten Monat.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={copyCode} disabled={!stats?.username}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: copied === 'code' ? '#ECFDF5' : '#1a1a1a', color: copied === 'code' ? '#065F46' : '#fff' }}>
              {copied === 'code' ? <><CheckIcon size={14}/> Kopiert</> : <><CopyIcon size={14}/> Code kopieren</>}
            </button>
            <button onClick={copyLink} disabled={!referralUrl}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              style={{
                background: copied === 'link' ? '#ECFDF5' : '#fff',
                color: copied === 'link' ? '#065F46' : '#374151',
                border: '1.5px solid #E5E7EB',
              }}>
              {copied === 'link' ? <><CheckIcon size={14}/> Kopiert</> : <><LinkIcon size={12}/> Link kopieren</>}
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-3xl p-7" style={{ background: '#F8FAFC' }}>
          <p className="text-xs font-semibold text-gray-500 mb-5">So funktioniert&apos;s</p>
          <div className="flex items-start gap-0 mb-5">
            <Step n="1" title="Teilen" sub="mit deinem Code" />
            <Arrow />
            <Step n="2" title="Sie zahlen" sub="−15% Rabatt" />
            <Arrow />
            <Step n="3" title="Du verdienst" sub="+15% Provision" highlight />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-5" style={{ borderTop: '1px solid #E5E7EB' }}>
            <Stat label="Wartefrist" value="14 Tage" />
            <Stat label="Provision" value="15%" />
            <Stat label="Auszahlung" value="Monatlich" />
          </div>
        </div>
      </section>

      {/* ── Auszahlungskonto + Stripe-Dashboard ─────────────────────────────── */}
      {stats?.affiliate_onboarded ? (
        <section className="rounded-3xl p-6 sm:p-7 mb-10" style={{ background: '#F0FDF4' }}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Dein Stripe-Konto</h2>
                <StatusBadge type="active">Eingerichtet</StatusBadge>
              </div>

              <div className="flex items-center gap-2.5 mb-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5">
                  <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                <span className="text-sm text-gray-800 font-medium">
                  {stats.bank_name ? `${stats.bank_name} ` : ''}
                  {stats.bank_last4 ? <>•••• <strong>{stats.bank_last4}</strong></> : 'Bankkonto verbunden'}
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Im Stripe-Dashboard kannst du dein Bankkonto ändern, alle Auszahlungen einsehen und
                <strong className="text-gray-800"> Belege für deine Buchhaltung</strong> herunterladen.
              </p>
            </div>

            <button onClick={openStripeDashboard} disabled={stripeLinkLoading}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-60 flex-shrink-0"
              style={{ background: '#1a1a1a', color: '#fff' }}>
              {stripeLinkLoading ? (
                <><Spinner /> Öffnet…</>
              ) : (
                <>
                  Zum Stripe-Dashboard
                  <ExternalIcon size={12}/>
                </>
              )}
            </button>
          </div>

          {/* What you can do there */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6"
            style={{ borderTop: '1px solid #BBF7D0' }}>
            <DashboardFeature icon={<BankIcon />} title="Bankkonto ändern" />
            <DashboardFeature icon={<ReceiptIcon />} title="Belege & Auszahlungs-Statements" />
            <DashboardFeature icon={<HistoryIcon />} title="Komplette Zahlungshistorie" />
          </div>
        </section>
      ) : (
        <section className="rounded-3xl p-6 sm:p-7 mb-10" style={{ background: '#FFFBEB' }}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Bankkonto einrichten</h2>
                <StatusBadge type="warning">Noch nicht eingerichtet</StatusBadge>
              </div>
              <p className="text-sm text-gray-700 mt-1 mb-3 max-w-xl leading-relaxed">
                Hinterlege einmalig dein Bankkonto über Stripe. Du bekommst dort ein eigenes
                Dashboard, auf dem du jederzeit dein Bankkonto ändern und
                <strong> Auszahlungs-Belege für deine Buchhaltung</strong> herunterladen kannst.
                Deine IBAN wird sicher bei Stripe gespeichert, nicht bei FinestSites.
              </p>
              {connectError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-xl p-3 mb-3">{connectError}</p>
              )}
            </div>

            <button onClick={startConnect} disabled={connecting}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 flex-shrink-0"
              style={{ background: '#1a1a1a', color: '#fff', cursor: connecting ? 'wait' : 'pointer' }}>
              {connecting ? <><Spinner /> Öffnet Stripe…</> : 'Jetzt einrichten'}
            </button>
          </div>
        </section>
      )}

      {/* ── 2-col: Partner list + Commission history ────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-10">

        {/* Partner list */}
        <div className="rounded-3xl bg-white" style={{ border: '1px solid #F1F5F9' }}>
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Deine Partner</h2>
            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full">
              {stats?.referral_count ?? 0}
            </span>
          </div>
          {!stats?.referred_users?.length ? (
            <div className="px-6 py-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <UsersIcon />
              </div>
              <p className="text-sm font-medium text-gray-700">Noch keine Partner</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Teile deinen Code, geworbene Partner erscheinen hier.
              </p>
            </div>
          ) : (
            <div className="px-3 pb-3">
              {stats.referred_users.map(u => {
                const plan = PLAN_COLOR[u.plan] ?? PLAN_COLOR.starter
                const dot = STATUS_DOT[u.subscription_status ?? ''] ?? '#D1D5DB'
                return (
                  <div key={u.id} className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors hover:bg-gray-50">
                    <Avatar seed={u.email} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
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

        {/* Provisionen */}
        <div className="rounded-3xl bg-white" style={{ border: '1px solid #F1F5F9' }}>
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Provisionen</h2>
            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-full">
              {stats?.commissions?.length ?? 0}
            </span>
          </div>
          {!stats?.commissions?.length ? (
            <div className="px-6 py-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <EuroIcon />
              </div>
              <p className="text-sm font-medium text-gray-700">Noch keine Provisionen</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Sobald ein Partner zahlt, erscheinen deine Provisionen hier.
              </p>
            </div>
          ) : (
            <div className="px-3 pb-3">
              {stats.commissions.map(c => {
                const effectiveStatus = c.status === 'available' && !balanceSufficient ? 'processing' : c.status
                const s = COMMISSION_STATUS[effectiveStatus] ?? COMMISSION_STATUS.pending
                return (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{fmtDate(c.created_at)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Umsatz {euros(c.gross_amount)}
                        {c.status === 'pending' && c.available_at && ` · ab ${fmtDate(c.available_at)}`}
                        {c.status === 'paid' && c.paid_at && ` · ausgezahlt ${fmtDate(c.paid_at)}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900 tabular-nums">
                        +{euros(c.commission_amount)}
                      </p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: s.bg, color: s.text }}>
                        {s.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Auszahlungen ────────────────────────────────────────────────────── */}
      <section className="rounded-3xl bg-white mb-12" style={{ border: '1px solid #F1F5F9' }}>
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Auszahlungen</h2>
          {stats?.affiliate_onboarded && (stats?.payouts?.length ?? 0) > 0 && (
            <button onClick={openStripeDashboard} disabled={stripeLinkLoading}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50">
              {stripeLinkLoading ? 'Öffnet…' : <><span>Stripe-Übersicht</span> <ExternalIcon size={10}/></>}
            </button>
          )}
        </div>
        {(stats?.payouts?.length ?? 0) === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <CardIcon />
            </div>
            <p className="text-sm font-medium text-gray-700">Noch keine Auszahlungen</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
              {stats?.affiliate_onboarded
                ? 'Provisionen werden automatisch am 1. jeden Monats überwiesen.'
                : 'Richte zuerst dein Bankkonto ein.'}
            </p>
          </div>
        ) : (
          <div className="px-3 pb-3">
            {stats!.payouts.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors hover:bg-gray-50">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#ECFDF5' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
                    <path d="M5 12l5 5L20 7"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {fmtDate(p.period_start)} – {fmtDate(p.period_end)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.commission_count} Provision{p.commission_count !== 1 ? 'en' : ''}
                    {p.paid_at && ` · ${fmtDate(p.paid_at)}`}
                  </p>
                </div>
                <p className="text-sm font-bold text-gray-900 tabular-nums flex-shrink-0">
                  {euros(p.total_amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
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
    ? { bg: '#fff', color: '#15803D', dot: '#22C55E' }
    : { bg: '#fff', color: '#92400E', dot: '#F59E0B' }
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: s.bg, color: s.color, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {children}
    </span>
  )
}

function Step({ n, title, sub, highlight }: { n: string; title: string; sub: string; highlight?: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center text-center">
      <div className="w-9 h-9 rounded-full flex items-center justify-center mb-2 text-sm font-bold"
        style={{
          background: highlight ? '#ECFDF5' : '#fff',
          color: highlight ? '#065F46' : '#374151',
          border: `1.5px solid ${highlight ? '#A7F3D0' : '#E5E7EB'}`,
        }}>
        {n}
      </div>
      <p className="text-xs font-semibold text-gray-900 leading-tight">{title}</p>
      <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{sub}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  )
}

function Arrow() {
  return (
    <div className="flex items-center justify-center w-6 mt-3 flex-shrink-0">
      <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
        <path d="M1 4h11M9 1l3 3-3 3" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
function CardIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
}
function EuroIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><path d="M4 10h12M4 14h12M19.5 5A9 9 0 105 16.5"/></svg>
}
function UsersIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
}
function BankIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.75"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>
}
function ReceiptIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.75"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>
}
function HistoryIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.75"><path d="M1 4v6h6"/><path d="M3.51 15A9 9 0 1012 3"/><polyline points="12 7 12 12 16 14"/></svg>
}

function DashboardFeature({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: '#fff' }}>
        {icon}
      </div>
      <span className="text-sm font-medium text-gray-800 leading-tight">{title}</span>
    </div>
  )
}
