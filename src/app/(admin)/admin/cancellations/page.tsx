import { db } from '@/lib/db'
import { users as usersTable } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'
import Link from 'next/link'

const MRR_RATE: Record<string, Record<string, number>> = {
  starter:   { monthly: 14,    yearly: 11.67 },
  pro:       { monthly: 21,    yearly: 17.50 },
  unlimited: { monthly: 39,    yearly: 32.50 },
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

export default async function CancellationsPage() {
  let stripeError: string | null = null
  let cancellations: {
    stripeSubId: string
    cancelAt: number | null
  }[] = []

  try {
    const subs = await getStripe().subscriptions.list({ status: 'active', limit: 100 })
    cancellations = subs.data
      .filter(s => s.cancel_at_period_end)
      .map(s => {
        const cancelAt =
          (s.items?.data?.[0] as any)?.current_period_end ??
          (s as any).cancel_at ??
          null
        return { stripeSubId: s.id, cancelAt }
      })
  } catch (err: any) {
    stripeError = err?.message ?? 'Stripe nicht erreichbar'
  }

  const subIds = cancellations.map(c => c.stripeSubId)

  let userRows: Array<{
    id: string
    email: string
    username: string | null
    plan: string
    billing_interval: string | null
    stripe_subscription_id: string | null
    current_period_end: Date | null
  }> = []

  if (subIds.length > 0) {
    userRows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        username: usersTable.username,
        plan: usersTable.plan,
        billing_interval: usersTable.billingInterval,
        stripe_subscription_id: usersTable.stripeSubscriptionId,
        current_period_end: usersTable.currentPeriodEnd,
      })
      .from(usersTable)
      .where(inArray(usersTable.stripeSubscriptionId, subIds))
  }

  const userMap = new Map(userRows.map(u => [u.stripe_subscription_id, u]))

  const rows = cancellations.map(c => ({
    ...c,
    user: userMap.get(c.stripeSubId) ?? null,
  }))

  const totalMrrAtRisk = rows.reduce((sum, r) => {
    if (!r.user) return sum
    return sum + mrrFor(r.user.plan, r.user.billing_interval)
  }, 0)

  return (
    <div style={{ maxWidth: 1000 }}>
      <div className="mb-6">
        <Link href="/admin" className="flex items-center gap-2 text-sm mb-5" style={{ color: '#94A3B8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Zurück zum Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Ausstehende Kündigungen</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Abos mit aktiviertem cancel_at_period_end</p>
      </div>

      {stripeError && (
        <div className="mb-5 rounded-[16px] px-5 py-4 text-sm"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          Stripe-Fehler: {stripeError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-[20px] p-5 bg-white flex flex-col gap-2"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <span className="text-xs font-medium" style={{ color: '#64748B' }}>Kündigungen gesamt</span>
          <span className="text-3xl font-bold tracking-tight"
            style={{ color: rows.length > 0 ? '#C2410C' : '#111827' }}>
            {rows.length}
          </span>
          <span className="text-[11px]" style={{ color: '#94A3B8' }}>
            {rows.length === 1 ? '1 Abo endet bald' : `${rows.length} Abos enden bald`}
          </span>
        </div>
        <div className="rounded-[20px] p-5 bg-white flex flex-col gap-2"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <span className="text-xs font-medium" style={{ color: '#64748B' }}>MRR gefährdet</span>
          <span className="text-3xl font-bold tracking-tight"
            style={{ color: totalMrrAtRisk > 0 ? '#F97316' : '#111827' }}>
            € {fmtEur(totalMrrAtRisk)}
          </span>
          <span className="text-[11px]" style={{ color: '#94A3B8' }}>monatlich äquivalent</span>
        </div>
      </div>

      {rows.length === 0 && !stripeError ? (
        <div className="rounded-[20px] bg-white p-10 text-center"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ background: '#F0FDF4' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">Keine ausstehenden Kündigungen</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Alle aktiven Abos laufen weiter.</p>
        </div>
      ) : rows.length > 0 ? (
        <div className="rounded-[20px] bg-white overflow-hidden"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <div className="grid px-6 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ gridTemplateColumns: '1fr 140px 120px 100px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', color: '#94A3B8' }}>
            <span>Nutzer</span>
            <span>Plan</span>
            <span>Endet am</span>
            <span className="text-right">MRR</span>
          </div>
          <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
            {rows.map(row => {
              const u = row.user
              const badge = u ? (PLAN_BADGE[u.plan] ?? PLAN_BADGE.starter) : null
              const mrr = u ? mrrFor(u.plan, u.billing_interval) : 0
              const initials = u ? u.email.slice(0, 2).toUpperCase() : '??'
              const cancelDate = row.cancelAt
                ? new Date(row.cancelAt * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
                : u?.current_period_end
                  ? new Date(u.current_period_end).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—'

              return (
                <div key={row.stripeSubId}
                  className="grid items-center px-6 py-3.5"
                  style={{ gridTemplateColumns: '1fr 140px 120px 100px' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: badge?.bg ?? '#F1F5F9', color: badge?.text ?? '#6B7280' }}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      {u ? (
                        <Link href={`/admin/users/${u.id}`}
                          className="text-sm font-medium text-gray-900 hover:underline truncate block">
                          {u.email}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400 truncate block">{row.stripeSubId}</span>
                      )}
                      {u?.username && (
                        <span className="text-xs" style={{ color: '#94A3B8' }}>@{u.username}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    {badge ? (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: badge.bg, color: badge.text }}>
                        {badge.label}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: '#94A3B8' }}>—</span>
                    )}
                  </div>
                  <div className="text-sm" style={{ color: '#374151' }}>{cancelDate}</div>
                  <div className="text-sm font-semibold text-right"
                    style={{ color: mrr > 0 ? '#F97316' : '#94A3B8' }}>
                    {mrr > 0 ? `€ ${fmtEur(mrr)}` : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
