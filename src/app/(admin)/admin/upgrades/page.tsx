import { db } from '@/lib/db'
import { subscriptionEvents, users as usersTable } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'

function fmtEur(cents: number | null) {
  if (!cents) return '—'
  return '€ ' + (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

const EVENT_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  subscription_created:  { bg: '#F0FDF4', text: '#15803D', label: 'Neu' },
  subscription_updated:  { bg: '#EFF6FF', text: '#1D4ED8', label: 'Update' },
  subscription_deleted:  { bg: '#FFF7ED', text: '#C2410C', label: 'Kündigung' },
  payment_failed:        { bg: '#FEF2F2', text: '#DC2626', label: 'Zahlung fehlgeschlagen' },
}

const PLAN_BADGE: Record<string, { bg: string; text: string }> = {
  starter:   { bg: '#EFF6FF', text: '#1D4ED8' },
  pro:       { bg: '#F5F3FF', text: '#6D28D9' },
  unlimited: { bg: '#ECFDF5', text: '#065F46' },
  free:      { bg: '#F8FAFC', text: '#64748B' },
}

function intervalLabel(interval: string | null) {
  if (interval === 'monthly') return 'monatlich'
  if (interval === 'yearly') return 'jährlich'
  return interval ?? '—'
}

export default async function UpgradesPage() {
  const rows = await db
    .select({
      id: subscriptionEvents.id,
      eventType: subscriptionEvents.eventType,
      plan: subscriptionEvents.plan,
      billingInterval: subscriptionEvents.billingInterval,
      amountCents: subscriptionEvents.amountCents,
      metadata: subscriptionEvents.metadata,
      createdAt: subscriptionEvents.createdAt,
      userId: subscriptionEvents.userId,
      userEmail: usersTable.email,
      userName: usersTable.name,
      username: usersTable.username,
    })
    .from(subscriptionEvents)
    .leftJoin(usersTable, eq(subscriptionEvents.userId, usersTable.id))
    .orderBy(desc(subscriptionEvents.createdAt))
    .limit(200)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const thisMonth = rows.filter(r => r.createdAt >= startOfMonth)
  const newThisMonth = thisMonth.filter(r => r.eventType === 'subscription_created').length
  const cancelledThisMonth = thisMonth.filter(r => r.eventType === 'subscription_deleted').length
  const failedThisMonth = thisMonth.filter(r => r.eventType === 'payment_failed').length
  const newMrrThisMonth = thisMonth
    .filter(r => r.eventType === 'subscription_created' && r.amountCents)
    .reduce((sum, r) => {
      const monthly = r.billingInterval === 'yearly'
        ? Math.round((r.amountCents ?? 0) / 12)
        : (r.amountCents ?? 0)
      return sum + monthly
    }, 0)

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="mb-6">
        <Link href="/admin" className="flex items-center gap-2 text-sm mb-5" style={{ color: '#94A3B8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Zurück zum Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Upgrades & Abos</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Abo-Ereignisse aus subscription_events</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Neue Abos', value: newThisMonth, sub: 'diesen Monat', color: '#15803D' },
          { label: 'Neuer MRR', value: fmtEur(newMrrThisMonth), sub: 'diesen Monat', color: '#1D4ED8' },
          { label: 'Kündigungen', value: cancelledThisMonth, sub: 'diesen Monat', color: cancelledThisMonth > 0 ? '#C2410C' : '#111827' },
          { label: 'Zahlungsfehler', value: failedThisMonth, sub: 'diesen Monat', color: failedThisMonth > 0 ? '#DC2626' : '#111827' },
        ].map(s => (
          <div key={s.label} className="rounded-[20px] p-5 bg-white flex flex-col gap-1"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
            <span className="text-xs font-medium" style={{ color: '#64748B' }}>{s.label}</span>
            <span className="text-3xl font-bold tracking-tight" style={{ color: s.color }}>{s.value}</span>
            <span className="text-[11px]" style={{ color: '#94A3B8' }}>{s.sub}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-[20px] bg-white overflow-hidden"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
        <div className="grid px-6 py-3 text-xs font-semibold uppercase tracking-wider"
          style={{ gridTemplateColumns: '130px 120px 1fr 120px 80px 100px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', color: '#94A3B8' }}>
          <span>Datum</span>
          <span>Ereignis</span>
          <span>Nutzer</span>
          <span>Plan</span>
          <span>Turnus</span>
          <span className="text-right">Betrag</span>
        </div>

        <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
          {rows.map(row => {
            const badge = EVENT_BADGE[row.eventType] ?? { bg: '#F1F5F9', text: '#6B7280', label: row.eventType }
            const planBadge = PLAN_BADGE[row.plan ?? ''] ?? PLAN_BADGE.free
            const initials = row.userEmail ? row.userEmail.slice(0, 2).toUpperCase() : '??'

            return (
              <div key={row.id}
                className="grid items-center px-6 py-3.5"
                style={{ gridTemplateColumns: '130px 120px 1fr 120px 80px 100px' }}>

                {/* Date */}
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-800">{fmtDate(row.createdAt)}</span>
                  <span className="text-[11px]" style={{ color: '#94A3B8' }}>{fmtTime(row.createdAt)}</span>
                </div>

                {/* Event badge */}
                <div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
                    style={{ background: badge.bg, color: badge.text }}>
                    {badge.label}
                  </span>
                </div>

                {/* User */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={{ background: planBadge.bg, color: planBadge.text }}>
                    {initials}
                  </div>
                  <div className="min-w-0">
                    {row.userId ? (
                      <Link href={`/admin/users/${row.userId}`}
                        className="text-sm font-medium text-gray-900 hover:underline truncate block">
                        {row.userEmail ?? row.userId}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400 truncate block">Unbekannt</span>
                    )}
                    {row.username && (
                      <span className="text-[11px]" style={{ color: '#94A3B8' }}>@{row.username}</span>
                    )}
                  </div>
                </div>

                {/* Plan */}
                <div>
                  {row.plan ? (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{ background: planBadge.bg, color: planBadge.text }}>
                      {row.plan.charAt(0).toUpperCase() + row.plan.slice(1)}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: '#94A3B8' }}>—</span>
                  )}
                </div>

                {/* Interval */}
                <div className="text-xs" style={{ color: '#6B7280' }}>
                  {intervalLabel(row.billingInterval)}
                </div>

                {/* Amount */}
                <div className="text-sm font-semibold text-right"
                  style={{ color: row.amountCents ? '#111827' : '#94A3B8' }}>
                  {fmtEur(row.amountCents)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs mt-3 text-center" style={{ color: '#CBD5E1' }}>
        Zeigt die letzten 200 Ereignisse
      </p>
    </div>
  )
}
