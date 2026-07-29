import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import Link from 'next/link'

const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, unlimited: 3 }

const PLAN_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  starter:   { bg: '#EFF6FF', text: '#1D4ED8', label: 'Starter' },
  pro:       { bg: '#F5F3FF', text: '#6D28D9', label: 'Pro' },
  unlimited: { bg: '#ECFDF5', text: '#065F46', label: 'Unlimited' },
  free:      { bg: '#F8FAFC', text: '#64748B', label: 'Free' },
}

function PlanBadge({ plan }: { plan: string | null }) {
  const b = PLAN_BADGE[plan ?? 'free'] ?? PLAN_BADGE.free
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: b.bg, color: b.text }}>
      {b.label}
    </span>
  )
}

function fmtEur(cents: number | null) {
  if (!cents) return null
  return '€ ' + (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function intervalLabel(interval: string | null) {
  if (interval === 'monthly') return 'monatlich'
  if (interval === 'yearly') return 'jährlich'
  return '—'
}

type UpgradeRow = {
  id: string
  user_id: string
  event_type: string
  plan: string | null
  prev_plan: string | null
  billing_interval: string | null
  amount_cents: number | null
  created_at: Date
  email: string | null
  username: string | null
}

export default async function UpgradesPage() {
  // Use LAG() to get the previous plan per user, then filter only upgrades
  const rows = await db.execute<UpgradeRow>(sql`
    WITH ranked AS (
      SELECT
        se.id,
        se.user_id,
        se.event_type,
        se.plan,
        se.billing_interval,
        se.amount_cents,
        se.created_at,
        LAG(se.plan) OVER (PARTITION BY se.user_id ORDER BY se.created_at) AS prev_plan,
        u.email,
        u.username
      FROM subscription_events se
      LEFT JOIN users u ON se.user_id = u.id
      WHERE se.plan IS NOT NULL
        AND se.event_type IN ('subscription_created', 'subscription_updated')
    )
    SELECT *
    FROM ranked
    WHERE
      -- subscription_created: new paying customer (always an upgrade)
      (event_type = 'subscription_created' AND plan != 'free')
      OR
      -- subscription_updated: plan actually went up
      (
        event_type = 'subscription_updated'
        AND prev_plan IS NOT NULL
        AND plan != prev_plan
        AND (
          CASE plan
            WHEN 'starter' THEN 1
            WHEN 'pro' THEN 2
            WHEN 'unlimited' THEN 3
            ELSE 0
          END
          >
          CASE prev_plan
            WHEN 'starter' THEN 1
            WHEN 'pro' THEN 2
            WHEN 'unlimited' THEN 3
            ELSE 0
          END
        )
      )
    ORDER BY created_at DESC
    LIMIT 200
  `)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const thisMonth = rows.filter(r => new Date(r.created_at) >= startOfMonth)
  const newThisMonth = thisMonth.filter(r => r.event_type === 'subscription_created').length
  const upgradesThisMonth = thisMonth.filter(r => r.event_type === 'subscription_updated').length
  const newMrrThisMonth = thisMonth
    .filter(r => r.amount_cents)
    .reduce((sum, r) => {
      const monthly = r.billing_interval === 'yearly'
        ? Math.round((r.amount_cents ?? 0) / 12)
        : (r.amount_cents ?? 0)
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
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Upgrades</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Neue Abos und Plan-Upgrades</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-[20px] p-5 bg-white flex flex-col gap-1"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <span className="text-xs font-medium" style={{ color: '#64748B' }}>Neue Abos</span>
          <span className="text-3xl font-bold tracking-tight" style={{ color: '#15803D' }}>{newThisMonth}</span>
          <span className="text-[11px]" style={{ color: '#94A3B8' }}>diesen Monat</span>
        </div>
        <div className="rounded-[20px] p-5 bg-white flex flex-col gap-1"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <span className="text-xs font-medium" style={{ color: '#64748B' }}>Plan-Upgrades</span>
          <span className="text-3xl font-bold tracking-tight" style={{ color: '#6D28D9' }}>{upgradesThisMonth}</span>
          <span className="text-[11px]" style={{ color: '#94A3B8' }}>diesen Monat</span>
        </div>
        <div className="rounded-[20px] p-5 bg-white flex flex-col gap-1"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <span className="text-xs font-medium" style={{ color: '#64748B' }}>Neuer MRR</span>
          <span className="text-3xl font-bold tracking-tight" style={{ color: '#1D4ED8' }}>
            {newMrrThisMonth > 0 ? fmtEur(newMrrThisMonth) : '€ 0'}
          </span>
          <span className="text-[11px]" style={{ color: '#94A3B8' }}>diesen Monat (aus neuen Abos)</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[20px] bg-white p-10 text-center"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <p className="text-sm font-medium text-gray-900">Noch keine Upgrades</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Sobald jemand ein Abo abschließt oder upgradet, erscheint es hier.</p>
        </div>
      ) : (
        <div className="rounded-[20px] bg-white overflow-hidden"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <div className="grid px-6 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ gridTemplateColumns: '130px 1fr 240px 80px 110px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', color: '#94A3B8' }}>
            <span>Datum</span>
            <span>Nutzer</span>
            <span>Upgrade</span>
            <span>Turnus</span>
            <span className="text-right">Betrag</span>
          </div>

          <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
            {rows.map(row => {
              const isNew = row.event_type === 'subscription_created'
              const fromPlan = isNew ? null : row.prev_plan
              const toPlan = row.plan
              const initials = row.email ? row.email.slice(0, 2).toUpperCase() : '??'
              const planBadge = PLAN_BADGE[toPlan ?? 'free'] ?? PLAN_BADGE.free
              const createdAt = new Date(row.created_at)

              return (
                <div key={row.id}
                  className="grid items-center px-6 py-4"
                  style={{ gridTemplateColumns: '130px 1fr 240px 80px 110px' }}>

                  {/* Date */}
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-800">{fmtDate(createdAt)}</span>
                    <span className="text-[11px]" style={{ color: '#94A3B8' }}>{fmtTime(createdAt)}</span>
                  </div>

                  {/* User */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{ background: planBadge.bg, color: planBadge.text }}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      {row.user_id ? (
                        <Link href={`/admin/users/${row.user_id}`}
                          className="text-sm font-medium text-gray-900 hover:underline truncate block">
                          {row.email ?? row.user_id}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400 truncate block">Unbekannt</span>
                      )}
                      {row.username && (
                        <span className="text-[11px]" style={{ color: '#94A3B8' }}>@{row.username}</span>
                      )}
                    </div>
                  </div>

                  {/* Upgrade path */}
                  <div className="flex items-center gap-2">
                    {isNew ? (
                      <>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ background: '#F1F5F9', color: '#94A3B8' }}>
                          Neu
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" className="flex-shrink-0">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        <PlanBadge plan={toPlan} />
                      </>
                    ) : (
                      <>
                        <PlanBadge plan={fromPlan} />
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" className="flex-shrink-0">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        <PlanBadge plan={toPlan} />
                      </>
                    )}
                  </div>

                  {/* Interval */}
                  <div className="text-xs" style={{ color: '#6B7280' }}>
                    {intervalLabel(row.billing_interval)}
                  </div>

                  {/* Amount */}
                  <div className="text-sm font-semibold text-right"
                    style={{ color: row.amount_cents ? '#111827' : '#94A3B8' }}>
                    {fmtEur(row.amount_cents) ?? '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-xs mt-3 text-center" style={{ color: '#CBD5E1' }}>
        Zeigt die letzten 200 Einträge
      </p>
    </div>
  )
}
