'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'

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
  planPriceCents: number
  billedPriceCents: number
  totalRevenueCents: number
  activePromoCode: string | null
  emailVerified: boolean
}

type SortKey = 'email' | 'createdAt' | 'planPrice' | 'billed' | 'revenue' | 'plan' | 'status'
type SortDir = 'asc' | 'desc'

function fmtEur(cents: number, showZero = false): string {
  if (cents === 0) return showZero ? '0 €' : '—'
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

// ── Newsletter Modal ──────────────────────────────────────────────────────────

function NewsletterModal({
  recipients,
  onClose,
}: {
  recipients: UserRow[]
  onClose: () => void
}) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [error, setError] = useState('')

  async function handleSend() {
    if (!subject.trim() || !body.trim()) { setError('Betreff und Text sind Pflichtfelder.'); return }
    setSending(true); setError('')
    try {
      const res = await fetch('/api/admin/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          filters: {
            mode: 'specific',
            specificEmails: recipients.map(u => u.email),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Fehler beim Senden.'); return }
      setResult(data)
    } catch { setError('Netzwerkfehler.') }
    finally { setSending(false) }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 24, width: '100%', maxWidth: 560,
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Newsletter verfassen</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
              {recipients.length} Empfänger ausgewählt
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {result ? (
          /* Success state */
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Newsletter gesendet!</div>
            <div style={{ fontSize: 14, color: '#6B7280' }}>
              {result.sent} von {result.total} erfolgreich gesendet
              {result.failed > 0 && ` · ${result.failed} fehlgeschlagen`}
            </div>
            <button onClick={onClose} style={{
              marginTop: 24, padding: '10px 24px', borderRadius: 10,
              background: '#111827', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
            }}>Schließen</button>
          </div>
        ) : (
          /* Compose form */
          <div style={{ padding: 24 }}>
            {/* Recipient preview */}
            <div style={{
              background: '#F8FAFC', borderRadius: 12, padding: '10px 14px',
              marginBottom: 16, maxHeight: 80, overflowY: 'auto',
              fontSize: 11, fontFamily: 'monospace', color: '#6B7280',
              lineHeight: 1.8, border: '1px solid #E2E8F0',
            }}>
              {recipients.slice(0, 8).map(u => u.email).join(' · ')}
              {recipients.length > 8 && ` · +${recipients.length - 8} weitere`}
            </div>

            {/* Subject */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Betreff</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Betreff der E-Mail..."
                style={{
                  width: '100%', height: 40, borderRadius: 10,
                  border: '1px solid #E2E8F0', padding: '0 12px',
                  fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Body */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Text
                <span style={{ fontWeight: 400, color: '#94A3B8', marginLeft: 8 }}>{'**fett**, [Link](url), {{vorname}}'}</span>
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Hallo {{vorname}},&#10;&#10;dein Text hier..."
                rows={7}
                style={{
                  width: '100%', borderRadius: 10, border: '1px solid #E2E8F0',
                  padding: '10px 12px', fontSize: 14, color: '#111827', lineHeight: 1.6,
                  resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{
                flex: 1, height: 42, borderRadius: 10, border: '1px solid #E2E8F0',
                background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600, fontSize: 14,
              }}>Abbrechen</button>
              <button
                onClick={handleSend}
                disabled={sending}
                style={{
                  flex: 2, height: 42, borderRadius: 10, border: 'none',
                  background: sending ? '#94A3B8' : '#111827', color: '#fff',
                  cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {sending ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    Wird gesendet...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                    An {recipients.length} senden
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Main Table ────────────────────────────────────────────────────────────────

export default function AdminUsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter()

  const [search, setSearch]         = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all')
  const [sortKey, setSortKey]       = useState<SortKey>('createdAt')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showModal, setShowModal]     = useState(false)

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
      if (sortKey === 'planPrice') v = a.planPriceCents - b.planPriceCents
      if (sortKey === 'billed')    v = a.billedPriceCents - b.billedPriceCents
      if (sortKey === 'revenue')   v = a.totalRevenueCents - b.totalRevenueCents
      if (sortKey === 'plan')      v = a.plan.localeCompare(b.plan)
      if (sortKey === 'status')    v = (a.subscriptionStatus ?? '').localeCompare(b.subscriptionStatus ?? '')
      return sortDir === 'asc' ? v : -v
    })
    return rows
  }, [users, search, planFilter, statusFilter, verifiedFilter, sortKey, sortDir])

  const filteredIds = useMemo(() => new Set(filtered.map(u => u.id)), [filtered])
  const allFilteredSelected = filtered.length > 0 && filtered.every(u => selectedIds.has(u.id))
  const someFilteredSelected = filtered.some(u => selectedIds.has(u.id))

  const toggleAll = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedIds(prev => { const next = new Set(prev); filteredIds.forEach(id => next.delete(id)); return next })
    } else {
      setSelectedIds(prev => { const next = new Set(prev); filteredIds.forEach(id => next.add(id)); return next })
    }
  }, [allFilteredSelected, filteredIds])

  const toggleOne = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }, [])

  const selectedUsers = useMemo(() => users.filter(u => selectedIds.has(u.id)), [users, selectedIds])

  const totalPlanValue  = users.filter(u => u.subscriptionStatus === 'active' && !u.cancelAtPeriodEnd)
                               .reduce((s, u) => s + u.planPriceCents, 0)
  const totalRevenue    = users.reduce((s, u) => s + u.totalRevenueCents, 0)
  const activeCount     = users.filter(u => u.subscriptionStatus === 'active').length
  const unverifiedCount = users.filter(u => !u.emailVerified).length

  const thStyle = (key: SortKey): React.CSSProperties => ({
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
    color: sortKey === key ? '#1D4ED8' : '#94A3B8',
  })

  const GRID = '28px 2fr 1fr 1fr 0.85fr 0.85fr 0.9fr 0.5fr 0.55fr 28px'

  return (
    <>
      {/* ── KPI strip ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Registriert',    value: String(users.length) },
          { label: 'Aktive Abos',    value: String(activeCount) },
          { label: 'Eingenommen',    value: fmtEur(totalRevenue),   note: 'Gesamtumsatz' },
          { label: 'Abo-Wert/Mon',   value: fmtEur(totalPlanValue), note: 'Katalogpreis, ohne Rabatt' },
          { label: 'Unbestätigt',    value: String(unverifiedCount) },
        ].map(kpi => (
          <div key={kpi.label} style={{
            flex: '1 1 130px', background: '#fff', borderRadius: 14, padding: '14px 18px',
            border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>{kpi.value}</div>
            {kpi.note && <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 2 }}>{kpi.note}</div>}
          </div>
        ))}
      </div>

      {/* ── Filters / Search ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text" placeholder="E-Mail oder Username..." value={search}
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

        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
          style={{ height: 36, borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, padding: '0 10px', background: '#fff', color: '#374151', cursor: 'pointer' }}>
          <option value="all">Alle Tarife</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="unlimited">Unlimited</option>
          <option value="secret">Secret</option>
        </select>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ height: 36, borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, padding: '0 10px', background: '#fff', color: '#374151', cursor: 'pointer' }}>
          <option value="all">Alle Status</option>
          <option value="active">Aktiv</option>
          <option value="trialing">Trial</option>
          <option value="past_due">Überfällig</option>
          <option value="canceled">Gekündigt</option>
          <option value="none">Kein Abo</option>
        </select>

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
        {/* Mobile select-all bar */}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 12px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
            <input
              type="checkbox"
              checked={allFilteredSelected}
              ref={el => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected }}
              onChange={toggleAll}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#111827' }}
            />
            <span style={{ fontSize: 12, color: '#6B7280', flex: 1 }}>
              {allFilteredSelected ? 'Alle abwählen' : `Alle ${filtered.length} auswählen`}
            </span>
            {selectedIds.size > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                {selectedIds.size} gewählt
              </span>
            )}
          </div>
        )}

        {filtered.map(user => {
          const planMeta   = PLAN_META[user.plan] ?? PLAN_META.starter
          const statusMeta = STATUS_META[user.subscriptionStatus ?? ''] ?? null
          const initials   = user.email.slice(0, 2).toUpperCase()
          const dateStr    = new Date(user.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
          const isSelected = selectedIds.has(user.id)
          return (
            <div
              key={user.id}
              onClick={() => router.push(`/admin/users/${user.id}`)}
              className="flex flex-col gap-3 p-4 mb-3 rounded-2xl bg-white active:bg-gray-50"
              style={{
                boxShadow: isSelected ? '0 0 0 2px #111827' : '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
                border: isSelected ? '1px solid #111827' : '1px solid #F1F5F9',
                cursor: 'pointer',
              }}>
              <div className="flex items-center gap-3">
                {/* Checkbox */}
                <div onClick={e => toggleOne(user.id, e)} style={{ flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#111827', pointerEvents: 'none' }}
                  />
                </div>
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
                {!user.emailVerified && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
                    E-Mail unbestätigt
                  </span>
                )}
                {user.planPriceCents > 0 && (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: '#F8FAFC', color: '#374151' }}>
                    {fmtEur(user.planPriceCents)}/Mo
                  </span>
                )}
                {user.totalRevenueCents > 0 && (
                  <span className="text-xs" style={{ color: '#16A34A', fontWeight: 600 }}>Σ {fmtEur(user.totalRevenueCents)}</span>
                )}
                <span className="ml-auto text-xs tabular-nums" style={{ color: '#CBD5E1' }}>{dateStr}</span>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">Keine Ergebnisse</div>
        )}
      </div>

      {/* ── Desktop Table ── */}
      <div className="hidden lg:block rounded-[20px] bg-white overflow-hidden"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>

        {/* Header */}
        <div className="grid px-5 py-3 text-[11px] font-semibold uppercase tracking-wide"
          style={{ gridTemplateColumns: GRID, background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', alignItems: 'center' }}>
          {/* Select-all checkbox */}
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input
              type="checkbox"
              checked={allFilteredSelected}
              ref={el => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected }}
              onChange={toggleAll}
              title={allFilteredSelected ? 'Alle abwählen' : 'Alle auswählen'}
              style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#111827' }}
            />
          </span>
          <span style={thStyle('email')} onClick={() => toggleSort('email')}>
            Nutzer <SortIcon active={sortKey === 'email'} dir={sortDir} />
          </span>
          <span style={thStyle('plan')} onClick={() => toggleSort('plan')}>
            Plan <SortIcon active={sortKey === 'plan'} dir={sortDir} />
          </span>
          <span style={thStyle('status')} onClick={() => toggleSort('status')}>
            Status <SortIcon active={sortKey === 'status'} dir={sortDir} />
          </span>
          <span style={thStyle('planPrice')} onClick={() => toggleSort('planPrice')} title="Katalogpreis ohne Rabatt">
            Planpreis <SortIcon active={sortKey === 'planPrice'} dir={sortDir} />
          </span>
          <span style={thStyle('billed')} onClick={() => toggleSort('billed')} title="Tatsächlich abgerechnet nach Rabatt">
            Abgerechnet <SortIcon active={sortKey === 'billed'} dir={sortDir} />
          </span>
          <span style={thStyle('revenue')} onClick={() => toggleSort('revenue')} title="Gesamtsumme tatsächlich eingegangener Zahlungen">
            Eingenommen <SortIcon active={sortKey === 'revenue'} dir={sortDir} />
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
          const hasActiveSub = ['active', 'trialing', 'past_due'].includes(user.subscriptionStatus ?? '')
          const isSelected = selectedIds.has(user.id)
          return (
            <div
              key={user.id}
              className="grid px-5 py-3.5 text-sm items-center transition-colors hover:bg-gray-50 group"
              style={{
                gridTemplateColumns: GRID,
                borderBottom: '1px solid #F8FAFC',
                background: isSelected ? '#F8FAFC' : undefined,
                cursor: 'pointer',
              }}
            >
              {/* Checkbox — intercepts click, doesn't navigate */}
              <span
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={e => toggleOne(user.id, e)}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#111827', pointerEvents: 'none' }}
                />
              </span>

              {/* Rest of row navigates to user detail */}
              <span className="flex items-center gap-2.5 min-w-0" onClick={() => router.push(`/admin/users/${user.id}`)}>
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
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0"
                      style={{ background: '#FED7AA' }} title="E-Mail nicht bestätigt">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="3">
                        <path d="M12 9v4M12 17h.01"/>
                      </svg>
                    </span>
                  )}
                </span>
              </span>

              <span className="flex flex-col gap-0.5" onClick={() => router.push(`/admin/users/${user.id}`)}>
                {['active', 'trialing', 'past_due', 'canceled'].includes(user.subscriptionStatus ?? '') ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block w-fit"
                    style={{ background: planMeta.bg, color: planMeta.text }}>{planMeta.label}</span>
                ) : (
                  <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                )}
                {['active', 'trialing', 'past_due'].includes(user.subscriptionStatus ?? '') && (
                  <span className="text-[11px] px-0.5" style={{ color: '#94A3B8' }}>
                    {user.billingInterval === 'yearly' ? 'Jährlich' : 'Monatlich'}
                  </span>
                )}
              </span>

              <span className="flex flex-col gap-0.5" onClick={() => router.push(`/admin/users/${user.id}`)}>
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
                  <span className="text-[11px] px-0.5" style={{ color: '#CBD5E1' }}>abgel. {fmtDate(user.currentPeriodEnd)}</span>
                )}
              </span>

              <span className="tabular-nums text-sm" style={{ color: hasActiveSub ? '#374151' : '#CBD5E1' }}
                onClick={() => router.push(`/admin/users/${user.id}`)}>
                {hasActiveSub ? `${fmtEur(user.planPriceCents, true)}/Mo` : '—'}
              </span>

              <span className="flex flex-col gap-0.5" onClick={() => router.push(`/admin/users/${user.id}`)}>
                <span className="tabular-nums text-sm font-semibold"
                  style={{ color: hasActiveSub ? (user.billedPriceCents > 0 ? '#16A34A' : '#94A3B8') : '#CBD5E1' }}>
                  {hasActiveSub ? `${fmtEur(user.billedPriceCents, true)}/Mo` : '—'}
                </span>
                {user.activePromoCode && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded w-fit"
                    style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
                    {user.activePromoCode}
                  </span>
                )}
              </span>

              <span className="tabular-nums text-sm font-semibold"
                style={{ color: user.totalRevenueCents > 0 ? '#16A34A' : (hasActiveSub ? '#94A3B8' : '#CBD5E1') }}
                onClick={() => router.push(`/admin/users/${user.id}`)}>
                {hasActiveSub ? fmtEur(user.totalRevenueCents, true) : fmtEur(user.totalRevenueCents)}
              </span>

              <span className="flex justify-center" onClick={() => router.push(`/admin/users/${user.id}`)}>
                {user.siteCount > 0 ? (
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: '#F0FDF4', color: '#16A34A' }}>{user.siteCount}</span>
                ) : (
                  <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                )}
              </span>

              <span className="text-xs tabular-nums" style={{ color: '#94A3B8' }}
                onClick={() => router.push(`/admin/users/${user.id}`)}>
                {new Date(user.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </span>

              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="#CBD5E1" strokeWidth="2" className="transition-colors group-hover:stroke-gray-400"
                onClick={() => router.push(`/admin/users/${user.id}`)}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-gray-400">Keine Ergebnisse für diese Filter</p>
          </div>
        )}
      </div>

      {/* ── Sticky Selection Action Bar ── */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, display: 'flex', alignItems: 'center', gap: 12,
          background: '#111827', color: '#fff', borderRadius: 16,
          padding: '12px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {selectedIds.size} {selectedIds.size === 1 ? 'Nutzer' : 'Nutzer'} ausgewählt
          </span>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: '#fff', color: '#111827',
              border: 'none', borderRadius: 10, padding: '7px 14px',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
            Newsletter senden
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            style={{
              background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8,
              width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Auswahl aufheben"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* ── Newsletter Modal ── */}
      {showModal && (
        <NewsletterModal
          recipients={selectedUsers}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
