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
    } catch { /* ignore */ }
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
    <div className="max-w-2xl mx-auto pt-2 space-y-4">
      <div className="h-10 w-48 rounded-2xl bg-gray-100 animate-pulse" />
      <div className="h-32 rounded-3xl bg-gray-100 animate-pulse" />
      <div className="h-48 rounded-3xl bg-gray-100 animate-pulse" />
    </div>
  )

  const availableCents = stats?.commissions?.filter(c => c.status === 'available').reduce((s, c) => s + c.commission_amount, 0) ?? 0
  const pendingCents   = stats?.commissions?.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0) ?? 0
  const paidCents      = stats?.total_paid_cents ?? 0
  const totalEarned    = availableCents + pendingCents + paidCents
  const balanceSufficient = (stats?.stripe_balance_available_cents ?? 0) >= availableCents
  const canPayout      = availableCents > 0 && stats?.affiliate_onboarded && balanceSufficient
  const referralUrl    = stats?.username
    ? `https://finestsites.io/?ref=${stats.username}`
    : ''

  // ── No username yet ──────────────────────────────────────────────────────────
  if (!stats?.username) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Partnerprogramm</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Empfehle FinestSites und verdiene Geld</p>
        </div>
        <div className="rounded-3xl p-8 text-center" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#FEF3C7' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Zuerst deinen Benutzernamen festlegen</h2>
          <p className="text-sm text-gray-600 mb-6 max-w-sm mx-auto leading-relaxed">
            Dein persönlicher Empfehlungslink wird aus deinem Benutzernamen erstellt. Schließe einmalig die Kontoeinrichtung ab.
          </p>
          <a href="/onboarding/username"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold"
            style={{ background: '#1a1a1a', color: '#fff' }}>
            Jetzt einrichten
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Partnerprogramm</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
          Empfehle FinestSites. Du verdienst <strong className="text-gray-600">20%</strong> dauerhaft, dein Empfohlener spart <strong className="text-gray-600">20%</strong> dauerhaft.
        </p>
      </div>

      {/* ── Status banners ──────────────────────────────────────────────────── */}
      {(connectStatus || payoutMsg) && (
        <div className="space-y-2 mb-6">
          {connectStatus === 'success' && (
            <Banner type="success">Bankkonto eingerichtet. Du wirst automatisch ausgezahlt.</Banner>
          )}
          {connectStatus === 'pending' && (
            <Banner type="warning">Noch nicht fertig. Bitte fahre mit der Einrichtung fort.</Banner>
          )}
          {payoutMsg && (
            <Banner type={payoutMsg.type === 'success' ? 'success' : 'error'}>{payoutMsg.text}</Banner>
          )}
        </div>
      )}

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className="rounded-3xl p-6 mb-5" style={{ background: '#F8FAFC' }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: '#94A3B8' }}>So einfach geht&apos;s</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <HowStep icon="🔗" n={1} title="Link teilen" desc="Schicke deinen persönlichen Link an Freunde, Familie oder poste ihn online." />
          <div className="hidden sm:flex items-center justify-center flex-shrink-0 mt-6">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
          <HowStep icon="💳" n={2} title="Neukunde abonniert" desc="Dein Empfohlener bucht FinestSites und zahlt dauerhaft 20% weniger, egal welchen Tarif." />
          <div className="hidden sm:flex items-center justify-center flex-shrink-0 mt-6">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
          <HowStep icon="💰" n={3} title="Du bekommst Geld" desc="20% des Monatspreises landen automatisch auf deinem Konto, jeden Monat." highlight />
        </div>
      </section>

      {/* ── Share card ──────────────────────────────────────────────────────── */}
      <section className="rounded-3xl p-6 mb-5" style={{ background: '#fff', border: '1.5px solid #E5E7EB' }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94A3B8' }}>Dein persönlicher Empfehlungslink</p>

        {/* Link display */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4 overflow-hidden"
          style={{ background: '#F8FAFC', border: '1.5px solid #E5E7EB' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" className="flex-shrink-0">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
          </svg>
          <span className="text-sm font-mono text-gray-700 truncate flex-1">
            finestsites.io/?ref=<strong>{stats.username}</strong>
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button onClick={copyLink}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all"
            style={{ background: copied === 'link' ? '#ECFDF5' : '#1a1a1a', color: copied === 'link' ? '#065F46' : '#fff' }}>
            {copied === 'link'
              ? <><CheckIcon /> Link kopiert!</>
              : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Link kopieren</>}
          </button>
          <button onClick={copyCode}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all"
            style={{ background: copied === 'code' ? '#ECFDF5' : '#F3F4F6', color: copied === 'code' ? '#065F46' : '#374151' }}>
            {copied === 'code'
              ? <><CheckIcon /> Code kopiert!</>
              : <>Code kopieren: <strong>{stats.username}</strong></>}
          </button>
        </div>
      </section>

      {/* ── Earnings summary ────────────────────────────────────────────────── */}
      <section className="rounded-3xl p-6 mb-5" style={{ background: totalEarned > 0 ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' : '#F8FAFC', color: totalEarned > 0 ? '#fff' : 'inherit' }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: totalEarned > 0 ? 'rgba(255,255,255,0.5)' : '#94A3B8' }}>
          Deine Einnahmen
        </p>

        {totalEarned === 0 ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-2">🌱</p>
            <p className="text-sm font-semibold text-gray-700 mb-1">Noch keine Einnahmen</p>
            <p className="text-xs text-gray-400">Sobald deine erste Empfehlung abonniert, siehst du hier deine Einnahmen.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <EarningBox label="Verfügbar" value={euros(availableCents)} highlight={availableCents > 0} dark={totalEarned > 0} />
            <EarningBox label="In 14 Tagen" value={euros(pendingCents)} dark={totalEarned > 0}
              tooltip="Neue Provisionen werden 14 Tage zurückgehalten, damit mögliche Rückerstattungen abgerechnet werden können." />
            <EarningBox label="Bereits ausgezahlt" value={euros(paidCents)} dark={totalEarned > 0} muted />
          </div>
        )}

        {canPayout && (
          <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <button onClick={requestPayout} disabled={payingOut}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-opacity hover:opacity-90"
              style={{ background: '#fff', color: '#0F172A' }}>
              {payingOut ? <><Spinner /> Wird überwiesen…</> : `${euros(availableCents)} jetzt auszahlen`}
            </button>
          </div>
        )}
      </section>

      {/* ── Referred users (only if any) ────────────────────────────────────── */}
      {(stats.referred_users?.length ?? 0) > 0 && (
        <section className="rounded-3xl p-6 mb-5" style={{ background: '#fff', border: '1.5px solid #E5E7EB' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
              Deine Empfehlungen
            </p>
            <span className="text-xs font-bold bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full">
              {stats.referral_count}
            </span>
          </div>
          <div className="space-y-1">
            {stats.referred_users.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: '#F1F5F9', color: '#475569' }}>
                  {(u.email[0] ?? '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{u.email}</p>
                  <p className="text-xs text-gray-400">{fmtDate(u.created_at)}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: u.subscription_status === 'active' ? '#ECFDF5' : '#F3F4F6', color: u.subscription_status === 'active' ? '#065F46' : '#6B7280' }}>
                  {PLAN_LABEL[u.plan] ?? u.plan}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Bank account setup ──────────────────────────────────────────────── */}
      {stats.affiliate_onboarded ? (
        <section className="rounded-3xl p-5 mb-5" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: '#DCFCE7' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold text-gray-900">Bankkonto eingerichtet</p>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#DCFCE7', color: '#16A34A' }}>Aktiv</span>
                </div>
                {(stats.bank_name || stats.bank_last4) && (
                  <p className="text-sm text-gray-600">
                    {stats.bank_name}{stats.bank_last4 ? <> · •••• <strong>{stats.bank_last4}</strong></> : ''}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">Auszahlung automatisch am 1. des Monats</p>
              </div>
            </div>
            <button onClick={openStripeDashboard} disabled={stripeLinkLoading}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl flex-shrink-0 transition-opacity hover:opacity-80"
              style={{ background: '#fff', color: '#374151', border: '1px solid #D1FAE5' }}>
              {stripeLinkLoading ? 'Öffnet…' : 'Verwalten'}
            </button>
          </div>
        </section>
      ) : (
        <BankSetupCard onStart={startConnect} connecting={connecting} error={connectError} />
      )}

      {/* ── Commission history (only if any) ────────────────────────────────── */}
      {(stats.commissions?.length ?? 0) > 0 && (
        <section className="rounded-3xl p-6 mb-8" style={{ background: '#fff', border: '1.5px solid #E5E7EB' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94A3B8' }}>Verlauf</p>
          <div className="space-y-1">
            {stats.commissions.map(c => {
              const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                pending:    { label: 'Wartezeit 14 Tage', color: '#B45309', bg: '#FFF7ED' },
                processing: { label: 'In Bearbeitung',   color: '#854D0E', bg: '#FEF9C3' },
                available:  { label: 'Auszahlbar',       color: '#065F46', bg: '#ECFDF5' },
                paid:       { label: 'Ausgezahlt',       color: '#1D4ED8', bg: '#EFF6FF' },
                reversed:   { label: 'Storniert',        color: '#6B7280', bg: '#F3F4F6' },
              }
              const s = statusMap[c.status] ?? statusMap.pending
              return (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">{fmtDate(c.created_at)}</p>
                    <p className="text-xs text-gray-400">
                      {c.status === 'pending' && c.available_at ? `Verfügbar ab ${fmtDate(c.available_at)}` : ''}
                      {c.status === 'paid' && c.paid_at ? `Ausgezahlt am ${fmtDate(c.paid_at)}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 tabular-nums">+{euros(c.commission_amount)}</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: s.bg, color: s.color }}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Banner({ type, children }: { type: 'success' | 'warning' | 'error'; children: React.ReactNode }) {
  const s = { success: { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' }, warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' }, error: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' } }[type]
  return (
    <div className="px-4 py-3 rounded-2xl text-sm font-medium" style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
      {children}
    </div>
  )
}

function HowStep({ icon, n, title, desc, highlight }: { icon: string; n: number; title: string; desc: string; highlight?: boolean }) {
  return (
    <div className="flex-1 flex flex-col gap-2">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
          style={{ background: highlight ? '#0F172A' : '#E5E7EB', color: highlight ? '#fff' : '#374151' }}>
          {n}
        </div>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
    </div>
  )
}

function EarningBox({ label, value, highlight, muted, dark, tooltip }: { label: string; value: string; highlight?: boolean; muted?: boolean; dark?: boolean; tooltip?: string }) {
  return (
    <div className="flex flex-col gap-1" title={tooltip}>
      <p className="text-lg sm:text-2xl font-bold tabular-nums"
        style={{ color: dark ? (highlight ? '#FDE68A' : muted ? 'rgba(255,255,255,0.4)' : '#fff') : '#111827' }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: dark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }}>{label}</p>
    </div>
  )
}

function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
}

function Spinner() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
}

function BankSetupCard({ onStart, connecting, error }: { onStart: () => void; connecting: boolean; error: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="rounded-3xl overflow-hidden mb-5" style={{ border: '1.5px solid #E5E7EB' }}>

      {/* Header */}
      <div className="px-6 pt-6 pb-4" style={{ background: '#fff' }}>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-bold text-gray-900">Einmalig Bankkonto einrichten</p>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>Noch nicht eingerichtet</span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
          Damit deine Provisionen automatisch auf dein Konto überwiesen werden, musst du einmalig deine IBAN hinterlegen.
          Das läuft sicher über <strong className="text-gray-800">Stripe</strong>. FinestSites sieht deine Bankdaten nicht.
        </p>
      </div>

      {/* 3-step visual guide */}
      <div className="px-6 py-4" style={{ background: '#F8FAFC', borderTop: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#94A3B8' }}>So läuft die Einrichtung ab</p>
        <div className="space-y-3">
          <SetupStep n={1} title='Du klickst auf „Jetzt einrichten"'>
            Du wirst sicher zu Stripe weitergeleitet. Das ist der Dienst, der dein Geld für dich verwahrt und überweist (wie ein Treuhänder).
          </SetupStep>
          <SetupStep n={2} title="Stripe fragt dich nach 3 Dingen">
            <span className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
              <Chip>✓ Vor- & Nachname</Chip>
              <Chip>✓ Adresse</Chip>
              <Chip>✓ IBAN (deine Bankkontonummer)</Chip>
            </span>
            <span className="text-xs text-gray-400 block mt-1.5">Dauert ca. 3–5 Minuten. Ausweis wird in der Regel <em>nicht</em> benötigt.</span>
          </SetupStep>
          <SetupStep n={3} title="Fertig. Ab jetzt läuft alles automatisch">
            Du wirst zurück zu FinestSites geleitet. Ab dem 1. des nächsten Monats wird dein Guthaben automatisch auf dein Konto überwiesen.
          </SetupStep>
        </div>
      </div>

      {/* FAQ toggle */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F1F5F9' }}>
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between px-6 py-3 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span>Was ist Stripe und warum wird das verwendet?</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        {expanded && (
          <div className="px-6 pb-4 text-xs leading-relaxed text-gray-500 space-y-2">
            <p>
              <strong className="text-gray-700">Stripe</strong> ist einer der weltweit größten Zahlungsdienstleister, dasselbe Unternehmen, das auch große Shops wie Amazon, Shopify oder Airbnb nutzen.
            </p>
            <p>
              Wir verwenden Stripe, damit wir deine sensiblen Bankdaten (IBAN etc.) <strong className="text-gray-700">niemals selbst speichern</strong> müssen. Stripe übernimmt das sicher und überwacht alle Transaktionen.
            </p>
            <p>
              Du brauchst dafür <strong className="text-gray-700">kein Stripe-Konto</strong> zu erstellen. Stripe führt dich durch den Prozess und legt alles automatisch für dich an.
            </p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-6 py-4" style={{ background: '#fff' }}>
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>
        )}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <button onClick={onStart} disabled={connecting}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
            style={{ background: connecting ? '#E5E7EB' : '#1a1a1a', color: connecting ? '#9CA3AF' : '#fff', cursor: connecting ? 'wait' : 'pointer' }}>
            {connecting
              ? <><Spinner /> Stripe öffnet sich…</>
              : <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  Jetzt einrichten →
                </>
            }
          </button>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#9CA3AF' }}>
            <svg width="11" height="13" viewBox="0 0 9 11" fill="none">
              <rect x="0.5" y="4.5" width="8" height="6" rx="1.5" fill="#D1D5DB"/>
              <path d="M2.5 4.5V3a2 2 0 0 1 4 0v1.5" stroke="#D1D5DB" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
            </svg>
            SSL-verschlüsselt · Sicher über Stripe
          </div>
        </div>
      </div>

    </section>
  )
}

function SetupStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
        style={{ background: '#0F172A', color: '#fff' }}>
        {n}
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold text-gray-800 mb-0.5">{title}</p>
        <div className="text-xs text-gray-500 leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
      {children}
    </span>
  )
}
