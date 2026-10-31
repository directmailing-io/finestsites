'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { AppUsage } from '@/lib/admin/app-usage'
import UserFilterBar, { type SortOption } from './UserFilterBar'
import { buildFilterGroups, matches, parseFilters, serializeFilters, type FilterState } from './user-filters'

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
  /** Geplanter Wechsel nach unten zum Laufzeitende (src/lib/billing/plan-change.ts) */
  pendingPlan: string | null
  pendingPlanAt: Date | null
  createdAt: Date
  siteCount: number
  /** Seiten im Entwurf (nicht online) */
  draftCount: number
  /** Titel der Vorlagen, mit denen der Nutzer Seiten hat */
  templateTitles: string[]
  hasCustomDomain: boolean
  /** Jüngste Sitzung (Web oder App) */
  lastActiveAt: Date | null
  referredBy: string | null
  hasTeamPartnerNumber: boolean
  planPriceCents: number
  billedPriceCents: number
  totalRevenueCents: number
  activePromoCode: string | null
  activeCouponName: string | null
  emailVerified: boolean
  /** Kontolöschung angefragt (Bedenkzeit läuft bis …) */
  deletionScheduledFor: Date | null
  /** Konto gelöscht (Grabstein) */
  deletedAt: Date | null
  /** Nutzung der nativen FinestSites-App (push_devices bzw. App-Sitzungen) */
  app: AppUsage
}

type SortKey = 'email' | 'createdAt' | 'planPrice' | 'billed' | 'revenue' | 'plan' | 'status' | 'app' | 'lastActive'
type SortDir = 'asc' | 'desc'

/** Sortierung als eine Auswahl (Handy-Blatt + Desktop-Auswahl); Spaltenköpfe am Desktop bleiben klickbar. */
const SORT_OPTIONS: (SortOption & { key: SortKey; dir: SortDir })[] = [
  { value: 'createdAt.desc',  label: 'Neueste zuerst',     key: 'createdAt',  dir: 'desc' },
  { value: 'createdAt.asc',   label: 'Älteste zuerst',     key: 'createdAt',  dir: 'asc' },
  { value: 'lastActive.desc', label: 'Zuletzt aktiv',      key: 'lastActive', dir: 'desc' },
  { value: 'revenue.desc',    label: 'Höchster Umsatz',    key: 'revenue',    dir: 'desc' },
  { value: 'billed.desc',     label: 'Höchster Betrag/Mon', key: 'billed',    dir: 'desc' },
  { value: 'email.asc',       label: 'E-Mail A–Z',         key: 'email',      dir: 'asc' },
]

function fmtEur(cents: number, showZero = false): string {
  if (cents === 0) return showZero ? '0 €' : '—'
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const APP_PLATFORM_META: Record<string, { label: string; bg: string; text: string }> = {
  ios:     { label: 'iOS',     bg: '#F0F9FF', text: '#0369A1' },
  android: { label: 'Android', bg: '#ECFDF5', text: '#047857' },
  // App-Sitzung erkannt, aber kein Gerät registriert → Plattform unbekannt
  unknown: { label: 'App',     bg: '#F1F5F9', text: '#475569' },
}

/** Pill „iOS 1.0.0“ / „Android“ / „App“ mit Tooltip „Zuletzt: dd.MM.yyyy“; „–“ wenn nicht installiert. */
function AppPill({ app, compact = false }: { app: AppUsage; compact?: boolean }) {
  if (!app.installed) {
    return compact
      ? null
      : <span className="text-xs" style={{ color: '#CBD5E1' }} title="App nicht installiert">–</span>
  }
  const platforms = app.platforms.length > 0 ? app.platforms : ['unknown']
  const lastSeen = app.lastSeenAt
    ? new Date(app.lastSeenAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null
  const title = lastSeen ? `Zuletzt: ${lastSeen}` : 'App installiert'
  return (
    <span className="flex items-center gap-1 flex-wrap" title={title}>
      {platforms.map((p, i) => {
        const meta = APP_PLATFORM_META[p] ?? APP_PLATFORM_META.unknown
        return (
          <span key={p} className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ background: meta.bg, color: meta.text }}>
            {meta.label}{i === 0 && app.appVersion ? ` ${app.appVersion}` : ''}
          </span>
        )
      })}
    </span>
  )
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
  const [filters, setFilters]       = useState<FilterState>({})
  const [sortKey, setSortKey]       = useState<SortKey>('createdAt')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')
  const groups = useMemo(() => buildFilterGroups(users), [users])

  // Filter + Suche stehen in der Adresse (teilbar, „Zurück“ aus dem Nutzerprofil behält sie).
  // history.replaceState statt router.replace: kein neues Laden der Seite (Stripe-Abfragen).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters(parseFilters(p.get('f')))
    setSearch(p.get('q') ?? '')
  }, [])
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const f = serializeFilters(filters)
    if (f) p.set('f', f); else p.delete('f')
    if (search.trim()) p.set('q', search.trim()); else p.delete('q')
    const qs = p.toString()
    window.history.replaceState(window.history.state, '', qs ? `?${qs}` : window.location.pathname)
  }, [filters, search])

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
      return matches(u, groups, filters)
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
      if (sortKey === 'lastActive') v = (a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0) - (b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0)
      if (sortKey === 'app') {
        // Installiert vor nicht installiert, darin nach „zuletzt gesehen“
        v = Number(a.app.installed) - Number(b.app.installed)
        if (v === 0) v = (a.app.lastSeenAt ? new Date(a.app.lastSeenAt).getTime() : 0) - (b.app.lastSeenAt ? new Date(b.app.lastSeenAt).getTime() : 0)
      }
      return sortDir === 'asc' ? v : -v
    })
    return rows
  }, [users, search, groups, filters, sortKey, sortDir])

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
  const appUserCount    = users.filter(u => u.app.installed).length
  const filteredBilled  = filtered.filter(u => ['active', 'trialing', 'past_due'].includes(u.subscriptionStatus ?? '')).reduce((s, u) => s + u.billedPriceCents, 0)
  const filteredRevenue = filtered.reduce((s, u) => s + u.totalRevenueCents, 0)

  const thStyle = (key: SortKey): React.CSSProperties => ({
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
    color: sortKey === key ? '#1D4ED8' : '#94A3B8',
  })

  const GRID = '28px 2fr 1fr 1fr 0.85fr 0.85fr 0.9fr 0.5fr 0.8fr 0.55fr 28px'

  return (
    <>
      {/* ── Kennzahlen (Handy: wischbar) ── */}
      <div className="fs-kpis -mx-4 mb-5 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:px-0">
        {[
          { label: 'Registriert',    value: String(users.length) },
          { label: 'Aktive Abos',    value: String(activeCount) },
          { label: 'Eingenommen',    value: fmtEur(totalRevenue),   note: 'Gesamtumsatz' },
          { label: 'Abo-Wert/Mon',   value: fmtEur(totalPlanValue), note: 'Katalogpreis, ohne Rabatt' },
          { label: 'Unbestätigt',    value: String(unverifiedCount) },
          { label: 'App-Nutzer',     value: String(appUserCount),   note: 'Native App installiert' },
        ].map(kpi => (
          <div key={kpi.label} className="min-w-[136px] flex-shrink-0 snap-start sm:min-w-0 sm:flex-[1_1_130px]" style={{
            background: '#fff', borderRadius: 16, padding: '13px 16px',
            border: '1px solid #ECEEF2',
          }}>
            <div style={{ fontSize: 11, color: '#8A94A6', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, whiteSpace: 'nowrap' }}>{kpi.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>{kpi.value}</div>
            {kpi.note && <div style={{ fontSize: 10, color: '#B6BDC9', marginTop: 2, whiteSpace: 'nowrap' }}>{kpi.note}</div>}
          </div>
        ))}
      </div>
      <style>{`.fs-kpis { scrollbar-width: none; } .fs-kpis::-webkit-scrollbar { display: none; }`}</style>

      {/* ── Suche, Szenarien, Filter ── */}
      <UserFilterBar
        users={users}
        groups={groups}
        filters={filters}
        setFilters={setFilters}
        search={search}
        setSearch={setSearch}
        resultCount={filtered.length}
        sortValue={`${sortKey}.${sortDir}`}
        sortOptions={SORT_OPTIONS}
        onSort={v => { const o = SORT_OPTIONS.find(x => x.value === v); if (o) { setSortKey(o.key); setSortDir(o.dir) } }}
      />

      {/* ── Ergebnis: was die Auswahl wert ist ── */}
      <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1">
        <span className="text-[15px] font-semibold text-gray-900 tabular-nums">
          {filtered.length === users.length ? `${users.length} Nutzer` : `${filtered.length} von ${users.length} Nutzern`}
        </span>
        {filtered.length !== users.length && filtered.length > 0 && (
          <>
            <span className="text-[13px] tabular-nums" style={{ color: '#8A94A6' }}>
              Abgerechnet <b className="font-semibold text-gray-700">{fmtEur(filteredBilled, true)}</b>/Mon
            </span>
            <span className="text-[13px] tabular-nums" style={{ color: '#8A94A6' }}>
              Eingenommen <b className="font-semibold text-gray-700">{fmtEur(filteredRevenue, true)}</b>
            </span>
          </>
        )}
        {filtered.length > 0 && (
          <button type="button" onClick={() => downloadCsv(filtered)}
            className="ml-auto text-[13px] font-semibold" style={{ color: '#111827' }}>
            Als CSV laden
          </button>
        )}
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
                {user.pendingPlan && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full" title="Wechselt zum Laufzeitende in den kleineren Tarif"
                    style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
                    → {PLAN_META[user.pendingPlan]?.label ?? user.pendingPlan}{user.pendingPlanAt ? ` ab ${fmtDate(user.pendingPlanAt)}` : ''}
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
                {!user.emailVerified && !user.deletedAt && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
                    E-Mail unbestätigt
                  </span>
                )}
                <DeletionBadge user={user} />
                <AppPill app={user.app} compact />
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
          <span style={thStyle('app')} onClick={() => toggleSort('app')} title="Native FinestSites-App (Gerät registriert oder App-Sitzung)">
            App <SortIcon active={sortKey === 'app'} dir={sortDir} />
          </span>
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
                  <DeletionBadge user={user} />
                  {!user.emailVerified && !user.deletedAt && (
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
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded w-fit cursor-default"
                    style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}
                    title={user.activeCouponName
                      ? `${user.activePromoCode} · ${user.activeCouponName}`
                      : user.activePromoCode}
                  >
                    {user.activePromoCode}
                    {user.activeCouponName && user.activeCouponName !== user.activePromoCode && (
                      <span className="ml-1 font-sans not-italic opacity-70">· {user.activeCouponName}</span>
                    )}
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

              <span className="flex items-center" onClick={() => router.push(`/admin/users/${user.id}`)}>
                <AppPill app={user.app} />
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
        <div className="fs-selbar" style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)',
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
          <style>{`.fs-selbar { bottom: calc(72px + env(safe-area-inset-bottom, 0px)); } @media (min-width: 1024px) { .fs-selbar { bottom: 24px; } }`}</style>
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

/** Gefilterte Liste als CSV (Excel-tauglich: Semikolon, BOM). */
function downloadCsv(rows: UserRow[]) {
  const head = ['E-Mail', 'Benutzername', 'Tarif', 'Status', 'Zahlweise', 'Abgerechnet/Mon (€)', 'Rabatt', 'Eingenommen (€)', 'Seiten online', 'Entwürfe', 'Vorlagen', 'App', 'Registriert', 'Zuletzt aktiv']
  const cell = (v: string | number) => {
    const t = String(v)
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const lines = rows.map(u => [
    u.email, u.username ?? '', PLAN_META[u.plan]?.label ?? u.plan, u.subscriptionStatus ?? '',
    u.billingInterval === 'yearly' ? 'jährlich' : 'monatlich',
    (u.billedPriceCents / 100).toFixed(2).replace('.', ','), u.activePromoCode ?? '',
    (u.totalRevenueCents / 100).toFixed(2).replace('.', ','), u.siteCount, u.draftCount, u.templateTitles.join(', '),
    u.app.installed ? (u.app.platforms.join('/') || 'ja') : '', fmtDate(u.createdAt), fmtDate(u.lastActiveAt),
  ].map(cell).join(';'))
  const blob = new Blob(['\uFEFF' + [head.join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nutzer-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** „Löschung angefragt“ (mit Datum) bzw. „Gelöscht“ – in Liste und Karten gleich. */
function DeletionBadge({ user }: { user: Pick<UserRow, 'deletionScheduledFor' | 'deletedAt'> }) {
  if (!user.deletedAt && !user.deletionScheduledFor) return null
  const label = user.deletedAt
    ? 'Gelöscht'
    : `Löschung angefragt · ${new Date(user.deletionScheduledFor!).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
      style={user.deletedAt
        ? { background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }
        : { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
      title={user.deletedAt ? 'Konto gelöscht, Benutzername bleibt reserviert' : 'Wird nach der Bedenkzeit gelöscht'}>
      {label}
    </span>
  )
}
