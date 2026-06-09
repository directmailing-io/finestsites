import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'
import Link from 'next/link'

// ── MRR rates in Euro (monthly equivalent) ─────────────────────────────────
const MRR_RATE: Record<string, Record<string, number>> = {
  starter:   { monthly: 17,    yearly: +(170  / 12).toFixed(2) },
  pro:       { monthly: 24,    yearly: +(240  / 12).toFixed(2) },
  unlimited: { monthly: 36,    yearly: +(360  / 12).toFixed(2) },
}

// ── Actual charge amounts in cents per plan+interval ────────────────────────
const PRICE_CENTS: Record<string, Record<string, number>> = {
  starter:   { monthly: 1700,  yearly: 17000 },
  pro:       { monthly: 2400,  yearly: 24000 },
  unlimited: { monthly: 3600,  yearly: 36000 },
}

function mrrFor(plan: string, interval: string | null): number {
  return MRR_RATE[plan]?.[interval ?? 'monthly'] ?? 0
}

function fmtEur(amount: number) {
  return amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtEurCents(cents: number) {
  return fmtEur(cents / 100)
}

// ── Generate last N months ─────────────────────────────────────────────────
function lastNMonths(n: number) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
    return {
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('de-DE', { month: 'short' }),
      year:  d.getFullYear(),
      month: d.getMonth(),
    }
  })
}

export default async function AdminPage() {
  const admin  = createAdminClient()
  const now    = new Date()
  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd       = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthEnd   = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999)
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const sixMonthsAgo  = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()
  const sevenDaysAgo  = new Date(now.getTime() - 7  * 86400_000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000).toISOString()

  // ── Parallel DB queries ──────────────────────────────────────────────────
  const [
    { count: totalUsers },
    { count: newUsersWeek },
    { count: newUsersMonth },
    { count: activeSubsCount },
    { count: canceledCount },
    { count: totalSites },
    { count: totalTemplates },
    { count: publishedTemplates },
    { count: starterCount },
    { count: proCount },
    { count: unlimitedCount },
    { data: activeUsersForMrr },
    { data: signupsRaw },
    { data: recentUsers },
    { data: monthEvents },
    { data: monthCommissions },
    { data: dueThisMonth },
    { data: dueNextMonth },
    { data: historicalEvents },
  ] = await Promise.all([
    admin.from('users').select('*', { count: 'exact', head: true }),
    admin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    admin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    admin.from('users').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    admin.from('users').select('*', { count: 'exact', head: true }).eq('subscription_status', 'canceled'),
    admin.from('user_sites').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    admin.from('templates').select('*', { count: 'exact', head: true }),
    admin.from('templates').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    admin.from('users').select('*', { count: 'exact', head: true }).eq('plan', 'starter').eq('subscription_status', 'active'),
    admin.from('users').select('*', { count: 'exact', head: true }).eq('plan', 'pro').eq('subscription_status', 'active'),
    admin.from('users').select('*', { count: 'exact', head: true }).eq('plan', 'unlimited').eq('subscription_status', 'active'),
    // Active users with sub details for MRR
    admin.from('users').select('plan, billing_interval, stripe_subscription_id').eq('subscription_status', 'active'),
    // All signups last 6 months
    admin.from('users').select('created_at').gte('created_at', sixMonthsAgo),
    // Recent 7 users
    admin.from('users').select('id, email, username, plan, subscription_status, created_at')
      .order('created_at', { ascending: false }).limit(7),
    // Actual payments this month
    admin.from('subscription_events')
      .select('amount_cents')
      .gte('created_at', monthStart.toISOString())
      .in('event_type', ['subscription_created', 'subscription_renewed']),
    // Affiliate commissions this month
    admin.from('affiliate_commissions')
      .select('commission_amount')
      .gte('created_at', monthStart.toISOString()),
    // Subscriptions renewing later this month (noch fällig)
    admin.from('users')
      .select('plan, billing_interval')
      .eq('subscription_status', 'active')
      .gt('current_period_end', now.toISOString())
      .lte('current_period_end', monthEnd.toISOString()),
    // Subscriptions renewing next month (projection)
    admin.from('users')
      .select('plan, billing_interval')
      .eq('subscription_status', 'active')
      .gte('current_period_end', nextMonthStart.toISOString())
      .lte('current_period_end', nextMonthEnd.toISOString()),
    // Historical revenue last 12 months
    admin.from('subscription_events')
      .select('amount_cents, created_at')
      .gte('created_at', twelveMonthsAgo.toISOString())
      .in('event_type', ['subscription_created', 'subscription_renewed']),
  ])

  // ── MRR from DB ─────────────────────────────────────────────────────────
  let currentMrr = 0
  const subIdToMrr = new Map<string, number>()
  for (const u of activeUsersForMrr ?? []) {
    const rate = mrrFor(u.plan, u.billing_interval)
    currentMrr += rate
    if (u.stripe_subscription_id) subIdToMrr.set(u.stripe_subscription_id, rate)
  }

  // ── Stripe: pending cancellations ────────────────────────────────────────
  let pendingCancelCount = 0
  let mrrAtRisk          = 0
  let stripeOk           = false
  try {
    const subs = await getStripe().subscriptions.list({ status: 'active', limit: 100 })
    const cancelling = subs.data.filter(s => s.cancel_at_period_end)
    pendingCancelCount = cancelling.length
    for (const s of cancelling) {
      mrrAtRisk += subIdToMrr.get(s.id) ?? 0
    }
    stripeOk = true
  } catch { /* Stripe unavailable — show DB-only metrics */ }

  const projectedMrr = currentMrr - mrrAtRisk

  // ── Cashflow calculations ────────────────────────────────────────────────
  const actualRevenueCents  = (monthEvents ?? []).reduce((s, e) => s + (e.amount_cents ?? 0), 0)
  const affiliateCommsCents = (monthCommissions ?? []).reduce((s, c) => s + (c.commission_amount ?? 0), 0)
  const netProfitCents      = actualRevenueCents - affiliateCommsCents
  const stillDueCents       = (dueThisMonth ?? []).reduce((s, u) => {
    return s + (PRICE_CENTS[u.plan]?.[u.billing_interval ?? 'monthly'] ?? 0)
  }, 0)
  const nextMonthRevenueCents = (dueNextMonth ?? []).reduce((s, u) => {
    return s + (PRICE_CENTS[u.plan]?.[u.billing_interval ?? 'monthly'] ?? 0)
  }, 0)

  // ── Historical revenue (last 12 months) ─────────────────────────────────
  const revenueMonths = lastNMonths(12)
  const revenueMap: Record<string, number> = {}
  revenueMonths.forEach(m => { revenueMap[m.key] = 0 })
  for (const e of historicalEvents ?? []) {
    const k = (e.created_at as string).slice(0, 7)
    if (k in revenueMap) revenueMap[k] += e.amount_cents ?? 0
  }
  const monthlyRevenue = revenueMonths.map(m => ({ ...m, cents: revenueMap[m.key] ?? 0 }))
  const maxRevenueCents = Math.max(...monthlyRevenue.map(m => m.cents), 1)

  // ── Monthly signups (last 6 months) ─────────────────────────────────────
  const months      = lastNMonths(6)
  const signupMap: Record<string, number> = {}
  months.forEach(m => { signupMap[m.key] = 0 })
  for (const u of signupsRaw ?? []) {
    const k = (u.created_at as string).slice(0, 7)
    if (k in signupMap) signupMap[k]++
  }
  const monthlySignups = months.map(m => ({ ...m, count: signupMap[m.key] ?? 0 }))
  const maxSignups     = Math.max(...monthlySignups.map(m => m.count), 1)

  // ── Derived ─────────────────────────────────────────────────────────────
  const totalActive  = (starterCount ?? 0) + (proCount ?? 0) + (unlimitedCount ?? 0)
  const conversionPct = (totalUsers ?? 0) > 0
    ? Math.round((activeSubsCount ?? 0) / (totalUsers ?? 1) * 100) : 0
  const starterPct   = totalActive > 0 ? (starterCount   ?? 0) / totalActive * 100 : 0
  const proPct       = totalActive > 0 ? (proCount       ?? 0) / totalActive * 100 : 0
  const unlimitedPct = totalActive > 0 ? (unlimitedCount ?? 0) / totalActive * 100 : 0

  const PLAN_META = {
    starter:   { label: 'Starter',   color: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8' },
    pro:       { label: 'Pro',        color: '#8B5CF6', bg: '#F5F3FF', text: '#6D28D9' },
    unlimited: { label: 'Unlimited', color: '#10B981', bg: '#ECFDF5', text: '#065F46' },
  }

  const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    active:   { label: 'Aktiv',      bg: '#F0FDF4', text: '#16A34A', dot: '#22C55E' },
    trialing: { label: 'Trial',      bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
    past_due: { label: 'Überfällig', bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
    canceled: { label: 'Gekündigt',  bg: '#F9FAFB', text: '#6B7280', dot: '#D1D5DB' },
  }

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-7 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Admin</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            {now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link href="/admin/templates/new"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-[14px]"
          style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.2)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Template
        </Link>
      </div>

      {/* ── Finanzen ─────────────────────────────────────────────────────── */}
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#94A3B8' }}>
          Finanzen
        </p>

        {/* Aktueller Monat – dark card */}
        <div className="rounded-[20px] p-6 mb-3"
          style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#475569' }}>
              Aktueller Monat
            </span>
            <span className="text-xs font-medium" style={{ color: '#64748B' }}>
              {now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">

            {/* Eingegangen */}
            <div>
              <div className="text-[11px] font-medium mb-1.5" style={{ color: '#64748B' }}>Eingegangen</div>
              <div className="text-2xl font-bold text-white tracking-tight">
                € {fmtEurCents(actualRevenueCents)}
              </div>
              <div className="text-[11px] mt-1" style={{ color: '#334155' }}>
                tatsächlich geflossen
              </div>
            </div>

            {/* Noch fällig */}
            <div>
              <div className="text-[11px] font-medium mb-1.5" style={{ color: '#64748B' }}>Noch fällig</div>
              <div className="text-2xl font-bold tracking-tight"
                style={{ color: stillDueCents > 0 ? '#FCD34D' : '#94A3B8' }}>
                € {fmtEurCents(stillDueCents)}
              </div>
              <div className="text-[11px] mt-1" style={{ color: '#334155' }}>
                {dueThisMonth?.length ?? 0} Abos erneuern noch
              </div>
            </div>

            {/* Affiliate-Provision */}
            <div>
              <div className="text-[11px] font-medium mb-1.5" style={{ color: '#64748B' }}>Affiliate-Provision</div>
              <div className="text-2xl font-bold tracking-tight"
                style={{ color: affiliateCommsCents > 0 ? '#F87171' : '#94A3B8' }}>
                − € {fmtEurCents(affiliateCommsCents)}
              </div>
              <div className="text-[11px] mt-1" style={{ color: '#334155' }}>
                {(monthCommissions ?? []).length} neue Provisionen
              </div>
            </div>

            {/* Nettogewinn */}
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: 20 }}>
              <div className="text-[11px] font-medium mb-1.5" style={{ color: '#64748B' }}>Nettogewinn</div>
              <div className="text-2xl font-bold tracking-tight"
                style={{ color: netProfitCents > 0 ? '#34D399' : '#94A3B8' }}>
                € {fmtEurCents(netProfitCents)}
              </div>
              <div className="text-[11px] mt-1" style={{ color: '#334155' }}>
                nach Provision · vor Stripe-Geb.
              </div>
            </div>

          </div>
        </div>

        {/* Nächster Monat + 12-Monats-Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

          {/* Nächster Monat */}
          <div className="lg:col-span-2 rounded-[20px] bg-white p-6 flex flex-col gap-4"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Nächster Monat</p>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: '#F0FDF4', color: '#16A34A' }}>
                {nextMonthStart.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Erwartet</span>
                <span className="text-sm font-bold text-gray-900">€ {fmtEurCents(nextMonthRevenueCents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Abos mit Verlängerung</span>
                <span className="text-sm font-medium text-gray-700">{dueNextMonth?.length ?? 0}</span>
              </div>
              {stripeOk && mrrAtRisk > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#F97316' }}>MRR gefährdet</span>
                  <span className="text-sm font-semibold" style={{ color: '#F97316' }}>
                    − € {fmtEur(mrrAtRisk)}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-3 mt-auto" style={{ borderTop: '1px solid #F8FAFC' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#94A3B8' }}>MRR gesamt (aktuell)</span>
                <Link href="/admin/mrr" className="text-xs font-semibold text-gray-900 hover:underline">
                  € {fmtEur(currentMrr)} →
                </Link>
              </div>
              {pendingCancelCount > 0 && (
                <div className="flex items-center justify-between mt-1.5">
                  <Link href="/admin/cancellations" className="text-xs hover:underline" style={{ color: '#F97316' }}>
                    {pendingCancelCount} Kündigung{pendingCancelCount !== 1 ? 'en' : ''} ausstehend →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* 12-month revenue chart */}
          <div className="lg:col-span-3 rounded-[20px] bg-white p-6"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-semibold text-gray-900">Monatsumsatz</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>Letzte 12 Monate</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: '#F0FDF4', color: '#16A34A' }}>
                € {fmtEurCents(monthlyRevenue.reduce((s, m) => s + m.cents, 0))} gesamt
              </span>
            </div>
            <div className="flex items-end gap-1.5 h-28">
              {monthlyRevenue.map(m => {
                const heightPct = maxRevenueCents > 0 ? (m.cents / maxRevenueCents * 100) : 0
                const isCurrentMonth = m.key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                return (
                  <div key={m.key} className="flex flex-col items-center gap-1.5 flex-1">
                    <span className="text-[10px] font-semibold"
                      style={{ color: m.cents > 0 ? '#374151' : '#D1D5DB' }}>
                      {m.cents > 0 ? `${(m.cents / 100).toFixed(0)}` : ''}
                    </span>
                    <div className="w-full rounded-t-[5px] transition-all"
                      style={{
                        height: `${Math.max(heightPct, m.cents > 0 ? 6 : 2)}%`,
                        minHeight: 3,
                        background: isCurrentMonth ? '#0F172A' : m.cents > 0 ? '#CBD5E1' : '#F1F5F9',
                      }} />
                    <span className="text-[9px]" style={{ color: '#94A3B8' }}>{m.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>

      {/* ── User KPIs ────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-3 mt-5" style={{ color: '#94A3B8' }}>
          Nutzer & Wachstum
        </p>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              label: 'Nutzer gesamt', value: totalUsers ?? 0,
              sub: `+${newUsersMonth ?? 0} diesen Monat`,
              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
              accent: '#3B82F6', bg: '#EFF6FF',
            },
            {
              label: 'Neu (7 Tage)', value: newUsersWeek ?? 0,
              sub: `${newUsersMonth ?? 0} im letzten Monat`,
              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
              accent: '#10B981', bg: '#ECFDF5',
            },
            {
              label: 'Aktive Abos', value: activeSubsCount ?? 0,
              sub: `${canceledCount ?? 0} gekündigt`,
              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
              accent: '#8B5CF6', bg: '#F5F3FF',
            },
            {
              label: 'Conversion', value: `${conversionPct}%`,
              sub: 'Nutzer mit Abo',
              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
              accent: '#0EA5E9', bg: '#F0F9FF',
            },
            {
              label: 'Aktive Seiten', value: totalSites ?? 0,
              sub: 'live im Netz',
              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
              accent: '#F59E0B', bg: '#FFFBEB',
              href: '/admin/sites' as string | undefined,
            },
            {
              label: 'Templates', value: totalTemplates ?? 0,
              sub: `${publishedTemplates ?? 0} veröffentlicht`,
              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
              accent: '#EC4899', bg: '#FDF2F8',
            },
          ].map(kpi => {
            const cardClass = `rounded-[18px] bg-white p-4 flex flex-col gap-2.5${(kpi as any).href ? ' hover:bg-gray-50 transition-colors cursor-pointer' : ''}`
            const cardStyle = { boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }
            const inner = (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium leading-tight" style={{ color: '#64748B' }}>{kpi.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 flex items-center justify-center rounded-[8px] flex-shrink-0"
                      style={{ background: kpi.bg, color: kpi.accent }}>
                      {kpi.icon}
                    </span>
                    {(kpi as any).href && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight text-gray-900">{kpi.value}</div>
                  <div className="text-[10px] mt-0.5 leading-tight" style={{ color: '#94A3B8' }}>{kpi.sub}</div>
                </div>
              </>
            )
            return (kpi as any).href ? (
              <Link key={kpi.label} href={(kpi as any).href} className={cardClass} style={cardStyle}>
                {inner}
              </Link>
            ) : (
              <div key={kpi.label} className={cardClass} style={cardStyle}>
                {inner}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Monthly signups chart + Plan distribution ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-6">

        {/* Monthly signups bar chart */}
        <div className="lg:col-span-3 rounded-[20px] bg-white p-6"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-gray-900">Neue Registrierungen</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>Letzte 6 Monate</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
              {monthlySignups.reduce((s, m) => s + m.count, 0)} gesamt
            </span>
          </div>

          {/* Bar chart */}
          <div className="flex items-end gap-2 h-28">
            {monthlySignups.map(m => {
              const heightPct = maxSignups > 0 ? (m.count / maxSignups * 100) : 0
              const isCurrentMonth = m.key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
              return (
                <div key={m.key} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className="text-xs font-semibold text-gray-700"
                    style={{ fontSize: 11, color: m.count > 0 ? '#374151' : '#D1D5DB' }}>
                    {m.count > 0 ? m.count : ''}
                  </span>
                  <div className="w-full rounded-t-[6px] transition-all"
                    style={{
                      height: `${Math.max(heightPct, m.count > 0 ? 6 : 2)}%`,
                      minHeight: 3,
                      background: isCurrentMonth ? '#3B82F6' : m.count > 0 ? '#BFDBFE' : '#F1F5F9',
                    }} />
                  <span className="text-[10px]" style={{ color: '#94A3B8' }}>{m.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Plan distribution */}
        <div className="lg:col-span-2 rounded-[20px] bg-white p-6 flex flex-col gap-4"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Plan-Verteilung</p>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: '#F1F5F9', color: '#475569' }}>
              {totalActive} aktiv
            </span>
          </div>

          {totalActive > 0 ? (
            <div className="flex h-2 rounded-full overflow-hidden gap-px">
              {starterPct   > 0 && <div style={{ width: `${starterPct}%`,    background: '#3B82F6' }} />}
              {proPct       > 0 && <div style={{ width: `${proPct}%`,        background: '#8B5CF6' }} />}
              {unlimitedPct > 0 && <div style={{ width: `${unlimitedPct}%`,  background: '#10B981' }} />}
            </div>
          ) : (
            <div className="h-2 rounded-full" style={{ background: '#F1F5F9' }} />
          )}

          <div className="flex flex-col gap-3">
            {([['starter', starterCount ?? 0], ['pro', proCount ?? 0], ['unlimited', unlimitedCount ?? 0]] as [keyof typeof PLAN_META, number][]).map(([key, count]) => {
              const meta = PLAN_META[key]
              const pct  = totalActive > 0 ? Math.round(count / totalActive * 100) : 0
              const mrr  = count * mrrFor(key, 'monthly')
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                    <span className="text-sm text-gray-700">{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px]" style={{ color: '#94A3B8' }}>€ {fmtEur(mrr)}/Mo</span>
                    <span className="text-sm font-semibold text-gray-900 w-5 text-right">{count}</span>
                    <span className="text-[11px] w-8 text-right" style={{ color: '#CBD5E1' }}>
                      {totalActive > 0 ? `${pct}%` : '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pt-3" style={{ borderTop: '1px solid #F8FAFC' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>MRR gesamt</span>
              <span className="text-sm font-bold text-gray-900">€ {fmtEur(currentMrr)}</span>
            </div>
            {stripeOk && mrrAtRisk > 0 && (
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px]" style={{ color: '#94A3B8' }}>Gefährdet</span>
                <span className="text-xs font-semibold" style={{ color: '#F97316' }}>−€ {fmtEur(mrrAtRisk)}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px]" style={{ color: '#94A3B8' }}>Proj. nächster Monat</span>
              <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>€ {fmtEur(projectedMrr)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Recent users ─────────────────────────────────────────────────── */}
      <div className="rounded-[20px] bg-white overflow-hidden mb-4"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F8FAFC' }}>
          <p className="text-sm font-semibold text-gray-900">Neueste Nutzer</p>
          <Link href="/admin/users" className="text-xs font-medium" style={{ color: '#3B82F6' }}>
            Alle {totalUsers ?? 0} anzeigen →
          </Link>
        </div>
        <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
          {recentUsers?.map((u: any) => {
            const planMeta    = PLAN_META[u.plan as keyof typeof PLAN_META] ?? PLAN_META.starter
            const statusMeta  = u.subscription_status ? (STATUS_META[u.subscription_status] ?? null) : null
            const initials    = u.email.slice(0, 2).toUpperCase()
            return (
              <Link key={u.id} href={`/admin/users/${u.id}`}
                className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-gray-50">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: planMeta.bg, color: planMeta.text }}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                  <p className="text-xs truncate" style={{ color: '#94A3B8' }}>
                    {u.username ? `@${u.username}` : 'Kein Username gesetzt'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: planMeta.bg, color: planMeta.text }}>
                    {planMeta.label}
                  </span>
                  {statusMeta && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: statusMeta.bg, color: statusMeta.text }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.dot }} />
                      {statusMeta.label}
                    </span>
                  )}
                  <span className="text-xs tabular-nums" style={{ color: '#CBD5E1' }}>
                    {new Date(u.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            href: '/admin/templates/new', label: 'Neues Template',
            desc: 'Template hochladen und Felder definieren',
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
            accent: '#EC4899', bg: '#FDF2F8',
          },
          {
            href: '/admin/templates', label: 'Templates verwalten',
            desc: `${totalTemplates ?? 0} gesamt · ${publishedTemplates ?? 0} live`,
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
            accent: '#8B5CF6', bg: '#F5F3FF',
          },
          {
            href: '/admin/users', label: 'Nutzer verwalten',
            desc: `${totalUsers ?? 0} Nutzer · ${activeSubsCount ?? 0} aktive Abos`,
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
            accent: '#3B82F6', bg: '#EFF6FF',
          },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="flex items-center gap-4 p-5 rounded-[20px] bg-white transition-all hover:shadow-md"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
              style={{ background: item.bg, color: item.accent }}>
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 text-sm">{item.label}</div>
              <div className="text-xs mt-0.5 truncate" style={{ color: '#94A3B8' }}>{item.desc}</div>
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" className="flex-shrink-0">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </Link>
        ))}
      </div>

    </div>
  )
}
