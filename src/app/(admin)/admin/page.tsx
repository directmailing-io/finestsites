import { db } from '@/lib/db'
import { users, userSites, templates, subscriptionEvents, affiliateCommissions } from '@/lib/db/schema'
import { eq, gte, lte, gt, inArray, count, and, desc } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'
import Link from 'next/link'

// ── MRR rates in Euro (monthly equivalent) ─────────────────────────────────
const MRR_RATE: Record<string, Record<string, number>> = {
  starter:   { monthly: 20,    yearly: +(200  / 12).toFixed(2) },
  pro:       { monthly: 35,    yearly: +(350  / 12).toFixed(2) },
  unlimited: { monthly: 60,    yearly: +(600  / 12).toFixed(2) },
}

// ── Actual charge amounts in cents per plan+interval ────────────────────────
const PRICE_CENTS: Record<string, Record<string, number>> = {
  starter:   { monthly: 2000,  yearly: 20000 },
  pro:       { monthly: 3500,  yearly: 35000 },
  unlimited: { monthly: 6000,  yearly: 60000 },
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
  const now    = new Date()
  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd       = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthEnd   = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999)
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const sixMonthsAgo  = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const sevenDaysAgo  = new Date(now.getTime() - 7  * 86400_000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000)

  // ── Parallel DB queries ──────────────────────────────────────────────────
  const [
    [{ total: totalUsers }],
    [{ total: newUsersWeek }],
    [{ total: newUsersMonth }],
    [{ total: activeSubsCount }],
    [{ total: canceledCount }],
    [{ total: totalSites }],
    [{ total: totalTemplates }],
    [{ total: publishedTemplates }],
    [{ total: starterCount }],
    [{ total: proCount }],
    [{ total: unlimitedCount }],
    activeUsersForMrr,
    signupsRaw,
    recentUsers,
    monthEvents,
    monthCommissions,
    dueThisMonth,
    dueNextMonth,
    historicalEvents,
  ] = await Promise.all([
    db.select({ total: count() }).from(users),
    db.select({ total: count() }).from(users).where(gte(users.createdAt, sevenDaysAgo)),
    db.select({ total: count() }).from(users).where(gte(users.createdAt, thirtyDaysAgo)),
    db.select({ total: count() }).from(users).where(eq(users.subscriptionStatus, 'active')),
    db.select({ total: count() }).from(users).where(eq(users.subscriptionStatus, 'canceled')),
    db.select({ total: count() }).from(userSites).where(eq(userSites.status, 'published')),
    db.select({ total: count() }).from(templates),
    db.select({ total: count() }).from(templates).where(eq(templates.status, 'published')),
    db.select({ total: count() }).from(users).where(and(eq(users.plan, 'starter'), eq(users.subscriptionStatus, 'active'))),
    db.select({ total: count() }).from(users).where(and(eq(users.plan, 'pro'), eq(users.subscriptionStatus, 'active'))),
    db.select({ total: count() }).from(users).where(and(eq(users.plan, 'unlimited'), eq(users.subscriptionStatus, 'active'))),
    // Active users with sub details for MRR
    db.select({ plan: users.plan, billingInterval: users.billingInterval, stripeSubscriptionId: users.stripeSubscriptionId })
      .from(users).where(eq(users.subscriptionStatus, 'active')),
    // All signups last 6 months
    db.select({ createdAt: users.createdAt }).from(users).where(gte(users.createdAt, sixMonthsAgo)),
    // Recent 7 users
    db.select({ id: users.id, email: users.email, username: users.username, plan: users.plan, subscriptionStatus: users.subscriptionStatus, createdAt: users.createdAt })
      .from(users).orderBy(desc(users.createdAt)).limit(7),
    // Actual payments this month
    db.select({ amountCents: subscriptionEvents.amountCents })
      .from(subscriptionEvents)
      .where(and(
        gte(subscriptionEvents.createdAt, monthStart),
        inArray(subscriptionEvents.eventType, ['subscription_created', 'subscription_renewed'])
      )),
    // Affiliate commissions this month
    db.select({ commissionAmount: affiliateCommissions.commissionAmount })
      .from(affiliateCommissions)
      .where(gte(affiliateCommissions.createdAt, monthStart)),
    // Subscriptions renewing later this month (noch fällig)
    db.select({ plan: users.plan, billingInterval: users.billingInterval })
      .from(users)
      .where(and(
        eq(users.subscriptionStatus, 'active'),
        gt(users.currentPeriodEnd, now),
        lte(users.currentPeriodEnd, monthEnd)
      )),
    // Subscriptions renewing next month (projection)
    db.select({ plan: users.plan, billingInterval: users.billingInterval })
      .from(users)
      .where(and(
        eq(users.subscriptionStatus, 'active'),
        gte(users.currentPeriodEnd, nextMonthStart),
        lte(users.currentPeriodEnd, nextMonthEnd)
      )),
    // Historical revenue last 12 months
    db.select({ amountCents: subscriptionEvents.amountCents, createdAt: subscriptionEvents.createdAt })
      .from(subscriptionEvents)
      .where(and(
        gte(subscriptionEvents.createdAt, twelveMonthsAgo),
        inArray(subscriptionEvents.eventType, ['subscription_created', 'subscription_renewed'])
      )),
  ])

  // ── MRR from DB ─────────────────────────────────────────────────────────
  let currentMrr = 0
  const subIdToMrr = new Map<string, number>()
  for (const u of activeUsersForMrr) {
    const rate = mrrFor(u.plan, u.billingInterval)
    currentMrr += rate
    if (u.stripeSubscriptionId) subIdToMrr.set(u.stripeSubscriptionId, rate)
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
  const actualRevenueCents  = monthEvents.reduce((s, e) => s + (e.amountCents ?? 0), 0)
  const affiliateCommsCents = monthCommissions.reduce((s, c) => s + (c.commissionAmount ?? 0), 0)
  const netProfitCents      = actualRevenueCents - affiliateCommsCents
  const stillDueCents       = dueThisMonth.reduce((s, u) => {
    return s + (PRICE_CENTS[u.plan]?.[u.billingInterval ?? 'monthly'] ?? 0)
  }, 0)
  const nextMonthRevenueCents = dueNextMonth.reduce((s, u) => {
    return s + (PRICE_CENTS[u.plan]?.[u.billingInterval ?? 'monthly'] ?? 0)
  }, 0)

  // ── Historical revenue (last 12 months) ─────────────────────────────────
  const revenueMonths = lastNMonths(12)
  const revenueMap: Record<string, number> = {}
  revenueMonths.forEach(m => { revenueMap[m.key] = 0 })
  for (const e of historicalEvents) {
    const k = (e.createdAt as Date).toISOString().slice(0, 7)
    if (k in revenueMap) revenueMap[k] += e.amountCents ?? 0
  }
  const monthlyRevenue = revenueMonths.map(m => ({ ...m, cents: revenueMap[m.key] ?? 0 }))
  const maxRevenueCents = Math.max(...monthlyRevenue.map(m => m.cents), 1)

  // ── Monthly signups (last 6 months) ─────────────────────────────────────
  const months      = lastNMonths(6)
  const signupMap: Record<string, number> = {}
  months.forEach(m => { signupMap[m.key] = 0 })
  for (const u of signupsRaw) {
    const k = (u.createdAt as Date).toISOString().slice(0, 7)
    if (k in signupMap) signupMap[k]++
  }
  const monthlySignups = months.map(m => ({ ...m, count: signupMap[m.key] ?? 0 }))
  const maxSignups     = Math.max(...monthlySignups.map(m => m.count), 1)

  // ── Derived ─────────────────────────────────────────────────────────────
  const totalActive  = starterCount + proCount + unlimitedCount
  const conversionPct = totalUsers > 0
    ? Math.round(activeSubsCount / totalUsers * 100) : 0
  const starterPct   = totalActive > 0 ? starterCount   / totalActive * 100 : 0
  const proPct       = totalActive > 0 ? proCount       / totalActive * 100 : 0
  const unlimitedPct = totalActive > 0 ? unlimitedCount / totalActive * 100 : 0

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
      <div className="mb-7 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Admin</h1>
          <p className="text-sm mt-1 truncate" style={{ color: '#94A3B8' }}>
            {now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link href="/admin/templates/new"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-[14px] flex-shrink-0"
          style={{ background: '#1a1a1a', boxShadow: '0 4px 14px rgba(26,26,26,0.2)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span className="hidden sm:inline">Template</span>
          <span className="sm:hidden">Neu</span>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">

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
                {dueThisMonth.length} Abos erneuern noch
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
                {monthCommissions.length} neue Provisionen
              </div>
            </div>

            {/* Nettogewinn */}
            <div>
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
                <span className="text-sm font-medium text-gray-700">{dueNextMonth.length}</span>
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
              label: 'Nutzer gesamt', value: totalUsers,
              sub: `+${newUsersMonth} diesen Monat`,
              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
              accent: '#3B82F6', bg: '#EFF6FF',
            },
            {
              label: 'Neu (7 Tage)', value: newUsersWeek,
              sub: `${newUsersMonth} im letzten Monat`,
              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
              accent: '#10B981', bg: '#ECFDF5',
            },
            {
              label: 'Aktive Abos', value: activeSubsCount,
              sub: `${canceledCount} gekündigt`,
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
              label: 'Aktive Seiten', value: totalSites,
              sub: 'live im Netz',
              icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
              accent: '#F59E0B', bg: '#FFFBEB',
              href: '/admin/sites' as string | undefined,
            },
            {
              label: 'Templates', value: totalTemplates,
              sub: `${publishedTemplates} veröffentlicht`,
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
            {([['starter', starterCount], ['pro', proCount], ['unlimited', unlimitedCount]] as [keyof typeof PLAN_META, number][]).map(([key, count]) => {
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
            Alle {totalUsers} anzeigen →
          </Link>
        </div>
        <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
          {recentUsers.map((u) => {
            const planMeta    = PLAN_META[u.plan as keyof typeof PLAN_META] ?? PLAN_META.starter
            const statusMeta  = u.subscriptionStatus ? (STATUS_META[u.subscriptionStatus] ?? null) : null
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
                    <span className="hidden sm:flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: statusMeta.bg, color: statusMeta.text }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.dot }} />
                      {statusMeta.label}
                    </span>
                  )}
                  <span className="hidden sm:inline text-xs tabular-nums" style={{ color: '#CBD5E1' }}>
                    {new Date(u.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
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
            desc: `${totalTemplates} gesamt · ${publishedTemplates} live`,
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
            accent: '#8B5CF6', bg: '#F5F3FF',
          },
          {
            href: '/admin/users', label: 'Nutzer verwalten',
            desc: `${totalUsers} Nutzer · ${activeSubsCount} aktive Abos`,
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
