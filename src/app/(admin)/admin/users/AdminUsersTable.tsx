'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

const PLAN_META: Record<string, { label: string; bg: string; text: string }> = {
  starter:   { label: 'Starter',   bg: '#EFF6FF', text: '#1D4ED8' },
  pro:       { label: 'Pro',       bg: '#F5F3FF', text: '#6D28D9' },
  unlimited: { label: 'Unlimited', bg: '#ECFDF5', text: '#065F46' },
  secret:    { label: 'Secret',    bg: '#FFF7ED', text: '#9A3412' },
}

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active:   { label: 'Aktiv',      bg: '#F0FDF4', text: '#16A34A', dot: '#22C55E' },
  trialing: { label: 'Trial',      bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
  past_due: { label: 'Überfällig', bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
  canceled: { label: 'Gekündigt',  bg: '#F9FAFB', text: '#6B7280', dot: '#D1D5DB' },
}

export interface UserRow {
  id: string
  email: string
  username: string | null
  plan: string
  billingInterval: string
  subscriptionStatus: string | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  createdAt: Date
  siteCount: number
  totalRevenueCents: number
  mrrCents: number
  emailVerified: boolean
}

type SortKey = 'email' | 'createdAt' | 'mrr' | 'revenue' | 'plan' | 'status'
type SortDir = 'asc' | 'desc'

function fmtEur(cents: number): string {
  if (cents === 0) return '—'
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#1D4ED8' : '#CBD5E1'} strokeWidth="2.5"
      style={{ display: 'inline', marginLeft: 3 }}>
      {(!active || dir === 'desc')
        ? <path d="M12 5v14M5 12l7-7 7 7" />
        : <path d="M12 19V5M5 12l7 7 7-7" />}
    </svg>
  )
}

export default function AdminUsersTable({ users }: { users: UserRow[] }) {
  const [search, setSearch]         = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all')
  const [sortKey, setSortKey]       = useState<SortKey>('createdAt')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let rows = users.filter(u => {
      if (q && !u.email.toLowerCase().includes(q) && !(u.username ?? '').toLowerCase().includes(q)) return false
      if (planFilter !== 'all' && u.plan !== planFilter) return false
      if (statusFilter !== 'all') {
        const s = u.subscriptionStatus ?? 'none'
        if (statusFilter === 'none' ? s !== 'none' : s !== statusFilter) return false
      }
      if (verifiedFilter === 'verified' && !u.emailVerified) return false
      if (verifiedFilter === 'unverified' && u.emailVerified) return false
      return true
    })
    rows = [...rows].sort((a, b) => {
      let v = 0
      if (sortKey === 'email')     v = a.email.localeCompare(b.email)
      if (sortKey === 'createdAt') v = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      if (sortKey === 'mrr')       v = a.mrrCents - b.mrrCents
      if (sortKey === 'revenue')   v = a.totalRevenueCents - b.totalRevenueCents
      if (sortKey === 'plan')      v = a.plan.localeCompare(b.plan)
      if (sortKey === 'status')    v = (a.subscriptionStatus ?? '').localeCompare(b.subscriptionStatus ?? '')
      return sortDir === 'asc' ? v : -v
    })
    return rows
  }, [users, search, planFilter, statusFilter, verifiedFilter, sortKey, sortDir])

  const totalMrr       = users.filter(u => u.subscriptionStatus === 'active').reduce((s, u) => s + u.mrrCents, 0)
  const totalRevenue   = users.reduce((s, u) => s + u.totalRevenueCents, 0)
  const activeCount    = users.filter(u => u.subscriptionStatus === 'active').length
  const unverifiedCount = users.filter(u => !u.emailVerified).length

  const thStyle = (key: SortKey): React.CSSProperties => ({
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
    color: sortKey === key ? '#1D4ED8' : '#94A3B8',
  })

  return (
    <>
      {/* ── KPI strip ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Registriert',  value: String(users.length) },
          { label: 'Aktive Abos', value: String(activeCount) },
          { label: 'MRR gesamt',  value: fmtEur(totalMrr) },
          { label: 'Gesamtumsatz', value: fmtEur(totalRevenue) },
          { label: 'Unbestätigt', value: String(unverifiedCount) },
        ].map(kpi => (
          <div key={kpi.label} style={{
            flex: '1 1 130px', background: '#fff', borderRadius: 14, padding: '14px 18px',
            border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ── Filters / Search ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="E-Mail oder Username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', paddingLeft: 32, paddingRight: 32, height: 36,
              borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13,
              outline: 'none', background: '#fff', color: '#111', boxSizing: 'border-box',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 14, lineHeight: 1, padding: 0,
            }}>✕</button>
          )}
        </div>

        {/* Plan filter */}
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
          style={{ height: 36, borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, padding: '0 10px', background: '#fff', color: '#374151', cursor: 'pointer' }}>
          <option value="all">Alle Tarife</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="unlimited">Unlimited</option>
          <option value="secret">Secret</option>
        </select>

        {/* Status filter */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ height: 36, borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, padding: '0 10px', background: '#fff', color: '#374151', cursor: 'pointer' }}>
          <option value="all">Alle Status</option>
          <option value="active">Aktiv</option>
          <option value="trialing">Trial</option>
          <option value="past_due">Überfällig</option>
          <option value="canceled">Gekündigt</option>
          <option value="none">Kein Abo</option>
        </select>

        {/* Email verification filter */}
        <select value={verifiedFilter} onChange={e => setVerifiedFilter(e.target.value as 'all' | 'verified' | 'unverified')}
          style={{ height: 36, borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, padding: '0 10px', background: '#fff', color: '#374151', cursor: 'pointer' }}>
          <option value="all">Alle E-Mails</option>
          <option value="verified">Bestätigt</option>
          <option value="unverified">Unbestätigt</option>
        </select>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>
          {filtered.length} von {users.length}
        </span>
      </div>

      {/* ── Mobile Cards ── */}
      <div className="block lg:hidden">
        {filtered.map(user => {
          const planMeta   = PLAN_META[user.plan] ?? PLAN_META.starter
          const statusMeta = STATUS_META[user.subscriptionStatus ?? ''] ?? null
          const initials   = user.email.slice(0, 2).toUpperCase()
          const dateStr    = new Date(user.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
          return (
            <Link key={user.id} href={`/admin/users/${user.id}`}
              className="flex flex-col gap-3 p-4 mb-3 rounded-2xl bg-white active:bg-gray-50"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: planMeta.bg, color: planMeta.text }}>{initials}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900">{user.email}</span>
                  <span className="block text-xs font-mono" style={{ color: '#94A3B8' }}>
                    {user.username ? `@${user.username}` : <span className="italic" style={{ color: '#CBD5E1' }}>kein Username</span>}
                  </span>
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" className="flex-shrink-0"><path d="M9 18l6-6-6-6"/></svg>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {['active', 'trialing', 'past_due', 'canceled'].includes(user.subscriptionStatus ?? '') && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: planMeta.bg, color: planMeta.text }}>
                    {planMeta.label}{['active', 'trialing', 'past_due'].includes(user.subscriptionStatus ?? '') ? (user.billingInterval === 'yearly' ? ' · jährl.' : ' · monatl.') : ''}
                  </span>
                )}
                {statusMeta && (
                  <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: user.cancelAtPeriodEnd ? '#FFF7ED' : statusMeta.bg, color: user.cancelAtPeriodEnd ? '#C2410C' : statusMeta.text }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: user.cancelAtPeriodEnd ? '#F97316' : statusMeta.dot }} />
                    {user.cancelAtPeriodEnd ? `Kündigt ${user.currentPeriodEnd ? `bis ${fmtDate(user.currentPeriodEnd)}` : ''}` : statusMeta.label}
                  </span>
                )}
                {!user.cancelAtPeriodEnd && user.currentPeriodEnd && (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') && (
                  <span className="text-xs" style={{ color: '#94A3B8' }}>↻ {fmtDate(user.currentPeriodEnd)}</span>
                )}
                {!user.emailVerified && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
                    E-Mail unbestätigt
                  </span>
                )}
                {user.mrrCents > 0 && (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: '#F0FDF4', color: '#16A34A' }}>
                    {fmtEur(user.mrrCents)}/Mo
                  </span>
                )}
                {user.totalRevenueCents > 0 && (
                  <span className="text-xs" style={{ color: '#6B7280' }}>Σ {fmtEur(user.totalRevenueCents)}</span>
                )}
                <span className="ml-auto text-xs tabular-nums" style={{ color: '#CBD5E1' }}>{dateStr}</span>
              </div>
            </Link>
          )
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">Keine Ergebnisse</div>
        )}
      </div>

      {/* ── Desktop Table ── */}
      <div className="hidden lg:block rounded-[20px] bg-white overflow-hidden"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>

        <div className="grid px-5 py-3 text-[11px] font-semibold uppercase tracking-wide"
          style={{ gridTemplateColumns: '2fr 1fr 1fr 0.85fr 0.9fr 0.5fr 0.55fr 28px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
          <span style={thStyle('email')} onClick={() => toggleSort('email')}>
            Nutzer <SortIcon active={sortKey === 'email'} dir={sortDir} />
          </span>
          <span style={thStyle('plan')} onClick={() => toggleSort('plan')}>
            Plan <SortIcon active={sortKey === 'plan'} dir={sortDir} />
          </span>
          <span style={thStyle('status')} onClick={() => toggleSort('status')}>
            Status <SortIcon active={sortKey === 'status'} dir={sortDir} />
          </span>
          <span style={thStyle('mrr')} onClick={() => toggleSort('mrr')}>
            MRR <SortIcon active={sortKey === 'mrr'} dir={sortDir} />
          </span>
          <span style={thStyle('revenue')} onClick={() => toggleSort('revenue')}>
            Gesamtumsatz <SortIcon active={sortKey === 'revenue'} dir={sortDir} />
          </span>
          <span className="text-center" style={{ color: '#94A3B8' }}>Seiten</span>
          <span style={thStyle('createdAt')} onClick={() => toggleSort('createdAt')}>
            Seit <SortIcon active={sortKey === 'createdAt'} dir={sortDir} />
          </span>
          <span />
        </div>

        {filtered.map(user => {
          const planMeta   = PLAN_META[user.plan] ?? PLAN_META.starter
          const statusMeta = STATUS_META[user.subscriptionStatus ?? ''] ?? null
          const initials   = user.email.slice(0, 2).toUpperCase()
          return (
            <Link key={user.id} href={`/admin/users/${user.id}`}
              className="grid px-5 py-3.5 text-sm items-center transition-colors hover:bg-gray-50 group"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 0.85fr 0.9fr 0.5fr 0.55fr 28px', borderBottom: '1px solid #F8FAFC' }}>

              {/* Email + avatar */}
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: planMeta.bg, color: planMeta.text }}>{initials}</span>
                <span className="min-w-0 flex items-center gap-1">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{user.email}</span>
                    <span className="block text-[11px] font-mono truncate" style={{ color: '#94A3B8' }}>
                      {user.username ? `@${user.username}` : <span className="italic" style={{ color: '#CBD5E1' }}>—</span>}
                    </span>
                  </span>
                  {!user.emailVerified && (
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0"
                      style={{ background: '#FED7AA' }}
                      title="E-Mail nicht bestätigt"
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="3">
                        <path d="M12 9v4M12 17h.01"/>
                      </svg>
                    </span>
                  )}
                </span>
              </span>

              {/* Plan */}
              <span className="flex flex-col gap-0.5">
                {['active', 'trialing', 'past_due', 'canceled'].includes(user.subscriptionStatus ?? '') ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block w-fit"
                    style={{ background: planMeta.bg, color: planMeta.text }}>
                    {planMeta.label}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                )}
                {['active', 'trialing', 'past_due'].includes(user.subscriptionStatus ?? '') && (
                  <span className="text-[11px] px-0.5" style={{ color: '#94A3B8' }}>
                    {user.billingInterval === 'yearly' ? 'Jährlich' : 'Monatlich'}
                  </span>
                )}
              </span>

              {/* Status */}
              <span className="flex flex-col gap-0.5">
                {statusMeta ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full w-fit"
                    style={{ background: user.cancelAtPeriodEnd ? '#FFF7ED' : statusMeta.bg, color: user.cancelAtPeriodEnd ? '#C2410C' : statusMeta.text }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: user.cancelAtPeriodEnd ? '#F97316' : statusMeta.dot }} />
                    {user.cancelAtPeriodEnd ? 'Kündigt' : statusMeta.label}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                )}
                {user.currentPeriodEnd && (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') && (
                  <span className="text-[11px] px-0.5" style={{ color: user.cancelAtPeriodEnd ? '#F97316' : '#94A3B8' }}>
                    {user.cancelAtPeriodEnd ? `bis ${fmtDate(user.currentPeriodEnd)}` : `↻ ${fmtDate(user.currentPeriodEnd)}`}
                  </span>
                )}
                {user.currentPeriodEnd && user.subscriptionStatus === 'canceled' && (
                  <span className="text-[11px] px-0.5" style={{ color: '#CBD5E1' }}>
                    abgel. {fmtDate(user.currentPeriodEnd)}
                  </span>
                )}
              </span>

              {/* MRR */}
              <span className="tabular-nums text-sm font-semibold" style={{ color: user.mrrCents > 0 ? '#16A34A' : user.subscriptionStatus === 'active' ? '#94A3B8' : '#CBD5E1' }}>
                {user.subscriptionStatus === 'active' && user.mrrCents === 0 ? '0 €' : fmtEur(user.mrrCents)}
              </span>

              {/* Total Revenue */}
              <span className="tabular-nums text-sm font-medium" style={{ color: user.totalRevenueCents > 0 ? '#374151' : '#CBD5E1' }}>
                {fmtEur(user.totalRevenueCents)}
              </span>

              {/* Sites count */}
              <span className="flex justify-center">
                {user.siteCount > 0 ? (
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: '#F0FDF4', color: '#16A34A' }}>{user.siteCount}</span>
                ) : (
                  <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                )}
              </span>

              {/* Date */}
              <span className="text-xs tabular-nums" style={{ color: '#94A3B8' }}>
                {new Date(user.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </span>

              {/* Arrow */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="#CBD5E1" strokeWidth="2" className="transition-colors group-hover:stroke-gray-400">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Link>
          )
        })}

        {filtered.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-400">Keine Ergebnisse für diese Filter</p>
          </div>
        )}
      </div>
    </>
  )
}
