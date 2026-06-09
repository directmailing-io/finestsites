import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

const CHARGE: Record<string, Record<string, number>> = {
  starter:   { monthly: 14,  yearly: 140 },
  pro:       { monthly: 21,  yearly: 210 },
  unlimited: { monthly: 39,  yearly: 390 },
}

const MRR_RATE: Record<string, Record<string, number>> = {
  starter:   { monthly: 14,    yearly: 11.67 },
  pro:       { monthly: 21,    yearly: 17.50 },
  unlimited: { monthly: 39,    yearly: 32.50 },
}

function chargeFor(plan: string, interval: string | null): number {
  return CHARGE[plan]?.[interval ?? 'monthly'] ?? 0
}

function mrrFor(plan: string, interval: string | null): number {
  return MRR_RATE[plan]?.[interval ?? 'monthly'] ?? 0
}

function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const PLAN_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  starter:   { bg: '#EFF6FF', text: '#1D4ED8', label: 'Starter' },
  pro:       { bg: '#F5F3FF', text: '#6D28D9', label: 'Pro' },
  unlimited: { bg: '#ECFDF5', text: '#065F46', label: 'Unlimited' },
}

interface UserRow {
  id: string
  email: string
  username: string | null
  plan: string
  billing_interval: string | null
  current_period_end: string | null
  stripe_subscription_id: string | null
}

interface DayGroup {
  day: number
  date: Date
  users: Array<UserRow & { charge: number; mrr: number }>
  total: number
}

function groupByDay(users: UserRow[], year: number, month: number): DayGroup[] {
  const map = new Map<number, DayGroup>()
  for (const u of users) {
    if (!u.current_period_end) continue
    const d = new Date(u.current_period_end)
    if (d.getFullYear() !== year || d.getMonth() !== month) continue
    const day = d.getDate()
    if (!map.has(day)) {
      map.set(day, { day, date: d, users: [], total: 0 })
    }
    const charge = chargeFor(u.plan, u.billing_interval)
    const mrr = mrrFor(u.plan, u.billing_interval)
    map.get(day)!.users.push({ ...u, charge, mrr })
    map.get(day)!.total += charge
  }
  return Array.from(map.values()).sort((a, b) => a.day - b.day)
}

export default async function MrrPage() {
  const admin = createAdminClient()
  const now = new Date()
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth()
  const nextYear     = currentMonth === 11 ? currentYear + 1 : currentYear
  const nextMonth    = (currentMonth + 1) % 12

  const { data } = await admin
    .from('users')
    .select('id, email, username, plan, billing_interval, current_period_end, stripe_subscription_id')
    .eq('subscription_status', 'active')
    .not('current_period_end', 'is', null)

  const users: UserRow[] = data ?? []

  const currentGroups = groupByDay(users, currentYear, currentMonth)
  const nextGroups    = groupByDay(users, nextYear,    nextMonth)

  const currentTotal = currentGroups.reduce((s, g) => s + g.total, 0)
  const nextTotal    = nextGroups.reduce((s, g) => s + g.total, 0)

  const currentMonthLabel = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const nextMonthLabel    = new Date(nextYear, nextMonth, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  function renderSection(groups: DayGroup[], label: string, total: number) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
            {label}
          </p>
          <span className="text-sm font-bold text-gray-900">€ {fmtEur(total)}</span>
        </div>
        {groups.length === 0 ? (
          <div className="rounded-[20px] bg-white px-6 py-8 text-center"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
            <p className="text-sm" style={{ color: '#94A3B8' }}>Keine Zahlungen in diesem Monat erwartet.</p>
          </div>
        ) : (
          <div className="rounded-[20px] bg-white overflow-hidden"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
            {groups.map((group, idx) => {
              const dateLabel = group.date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
              return (
                <div key={group.day}
                  style={{ borderBottom: idx < groups.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <div className="flex items-center justify-between px-6 py-3"
                    style={{ background: '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-[10px] flex items-center justify-center text-sm font-bold"
                        style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                        {group.day}
                      </span>
                      <span className="text-xs font-medium" style={{ color: '#64748B' }}>{dateLabel}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: '#94A3B8' }}>
                        {group.users.length} {group.users.length === 1 ? 'Zahlung' : 'Zahlungen'}
                      </span>
                      <span className="text-sm font-bold text-gray-900">€ {fmtEur(group.total)}</span>
                    </div>
                  </div>
                  <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
                    {group.users.map(u => {
                      const badge = PLAN_BADGE[u.plan] ?? PLAN_BADGE.starter
                      const initials = u.email.slice(0, 2).toUpperCase()
                      const isYearly = u.billing_interval === 'yearly'
                      return (
                        <div key={u.id} className="flex items-center gap-3 px-6 py-2.5">
                          <Link href={`/admin/users/${u.id}`}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 hover:opacity-80"
                            style={{ background: badge.bg, color: badge.text }}>
                            {initials}
                          </Link>
                          <div className="flex-1 min-w-0">
                            <Link href={`/admin/users/${u.id}`}
                              className="text-sm font-medium text-gray-900 hover:underline truncate block">
                              {u.email}
                            </Link>
                            {u.username && (
                              <span className="text-xs" style={{ color: '#94A3B8' }}>@{u.username}</span>
                            )}
                          </div>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: badge.bg, color: badge.text }}>
                            {badge.label}
                          </span>
                          <span className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>
                            {isYearly ? 'jährlich' : 'monatlich'}
                          </span>
                          <span className="text-sm font-semibold flex-shrink-0 w-20 text-right" style={{ color: '#111827' }}>
                            € {fmtEur(u.charge)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="mb-6">
        <Link href="/admin" className="flex items-center gap-2 text-sm mb-5" style={{ color: '#94A3B8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Zurück zum Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">MRR-Kalender</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Zahlungsfälligkeiten nach Datum</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-7">
        <div className="rounded-[20px] p-5 bg-white flex flex-col gap-2"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <span className="text-xs font-medium" style={{ color: '#64748B' }}>Fällig diesen Monat</span>
          <span className="text-3xl font-bold tracking-tight text-gray-900">€ {fmtEur(currentTotal)}</span>
          <span className="text-[11px]" style={{ color: '#94A3B8' }}>
            {currentGroups.reduce((s, g) => s + g.users.length, 0)} Zahlungen · {currentMonthLabel}
          </span>
        </div>
        <div className="rounded-[20px] p-5 bg-white flex flex-col gap-2"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <span className="text-xs font-medium" style={{ color: '#64748B' }}>Fällig nächsten Monat</span>
          <span className="text-3xl font-bold tracking-tight text-gray-900">€ {fmtEur(nextTotal)}</span>
          <span className="text-[11px]" style={{ color: '#94A3B8' }}>
            {nextGroups.reduce((s, g) => s + g.users.length, 0)} Zahlungen · {nextMonthLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {renderSection(currentGroups, `Fällig diesen Monat — ${currentMonthLabel}`, currentTotal)}
        {renderSection(nextGroups, `Fällig nächsten Monat — ${nextMonthLabel}`, nextTotal)}
      </div>
    </div>
  )
}
