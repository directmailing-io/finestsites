import { db } from '@/lib/db'
import { users, userSites, templates, subscriptionEvents, affiliateCommissions } from '@/lib/db/schema'
import { eq, gte, lte, gt, and, desc, count, sql, inArray, isNotNull } from 'drizzle-orm'
import { getStripe, getPlanByPriceId } from '@/lib/stripe/client'
import Link from 'next/link'
import MonthSelector from './MonthSelector'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ── Plan-Preise (aus plans.ts — Single Source of Truth) ──────────────────────
const MRR_RATE: Record<string, Record<string, number>> = {
  starter:   { monthly: 21,    yearly: 17.50 },  // 210/12
  pro:       { monthly: 27,    yearly: 22.50 },  // 270/12
  unlimited: { monthly: 47,    yearly: 39.17 },  // 470/12
}
const PLAN_FULL_PRICE: Record<string, Record<string, number>> = {
  starter:   { monthly: 21,   yearly: 210 },
  pro:       { monthly: 27,   yearly: 270 },
  unlimited: { monthly: 47,   yearly: 470 },
}
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

function mrrFor(plan: string, interval: string | null): number {
  return MRR_RATE[plan]?.[interval ?? 'monthly'] ?? 0
}
function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtEurCents(cents: number) { return fmtEur(cents / 100) }

function genMonths(n: number) {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    }
  })
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const sp = await searchParams
  const now = new Date()

  // ── Selected month (for month-picker section) ───────────────────────────
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const selectedMonth   = sp.month ?? currentMonthKey
  const [selYear, selMonthNum] = selectedMonth.split('-').map(Number)
  const selStart = new Date(selYear, selMonthNum - 1, 1)
  const selEnd   = new Date(selYear, selMonthNum, 0, 23, 59, 59, 999)

  // ── Fixed date ranges ────────────────────────────────────────────────────
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd    = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const nextMStart  = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMEnd    = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999)
  const yearStart   = new Date(now.getFullYear(), 0, 1)
  const prevMStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMEnd    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  // ── All DB queries in parallel ───────────────────────────────────────────
  const [
    // Active subscriber breakdown
    activeUsersRaw,
    // Published sites count
    [{ total: publishedSites }],
    // Total users
    [{ total: totalUsers }],
    // New users last 30 days
    [{ total: newUsersMonth }],
    // Current month subscription events (real cash in)
    curMonthEvents,
    // Still due this month (active, period ending this month)
    dueThisMonth,
    // Renewing next month
    dueNextMonth,
    // Selected month events
    selMonthEvents,
    // Selected month cancellations (period ended, status=canceled)
    selMonthCanceled,
    // Year-to-date events
    ytdEvents,
    // Template popularity
    templateStats,
    // Top affiliates
    affiliateStats,
    // Recent users
    recentUsers,
    // Last 12 months revenue (for mini chart)
    historicalEvents,
  ] = await Promise.all([
    // Active users with plan+interval for MRR (only real Stripe subscribers)
    db.select({
      plan: users.plan,
      billingInterval: users.billingInterval,
      stripeSubscriptionId: users.stripeSubscriptionId,
    }).from(users).where(and(
      eq(users.subscriptionStatus, 'active'),
      isNotNull(users.stripeSubscriptionId)  // NUR echte Stripe-Subscriber
    )),

    db.select({ total: count() }).from(userSites).where(eq(userSites.status, 'published')),

    db.select({ total: count() }).from(users),

    db.select({ total: count() }).from(users).where(
      gte(users.createdAt, new Date(now.getTime() - 30 * 86400_000))
    ),

    // Current month: subscription_created + subscription_renewed
    db.select({
      eventType: subscriptionEvents.eventType,
      amountCents: subscriptionEvents.amountCents,
    }).from(subscriptionEvents).where(and(
      gte(subscriptionEvents.createdAt, monthStart),
      lte(subscriptionEvents.createdAt, monthEnd),
      inArray(subscriptionEvents.eventType, ['subscription_created', 'subscription_renewed']),
    )),

    // Due this month (haven't renewed yet = period still in future but ends this month)
    db.select({ plan: users.plan, billingInterval: users.billingInterval, stripeSubscriptionId: users.stripeSubscriptionId })
      .from(users).where(and(
        eq(users.subscriptionStatus, 'active'),
        gt(users.currentPeriodEnd, now),
        lte(users.currentPeriodEnd, monthEnd),
      )),

    // Due next month
    db.select({ plan: users.plan, billingInterval: users.billingInterval, stripeSubscriptionId: users.stripeSubscriptionId })
      .from(users).where(and(
        eq(users.subscriptionStatus, 'active'),
        gte(users.currentPeriodEnd, nextMStart),
        lte(users.currentPeriodEnd, nextMEnd),
      )),

    // Selected month events
    db.select({
      eventType: subscriptionEvents.eventType,
      amountCents: subscriptionEvents.amountCents,
    }).from(subscriptionEvents).where(and(
      gte(subscriptionEvents.createdAt, selStart),
      lte(subscriptionEvents.createdAt, selEnd),
      inArray(subscriptionEvents.eventType, ['subscription_created', 'subscription_renewed']),
    )),

    // Selected month: users who canceled (period ended in that month)
    db.select({ total: count() }).from(users).where(and(
      inArray(users.subscriptionStatus, ['canceled']),
      gte(users.currentPeriodEnd, selStart),
      lte(users.currentPeriodEnd, selEnd),
    )),

    // Year-to-date events
    db.select({
      eventType: subscriptionEvents.eventType,
      amountCents: subscriptionEvents.amountCents,
      createdAt: subscriptionEvents.createdAt,
    }).from(subscriptionEvents).where(and(
      gte(subscriptionEvents.createdAt, yearStart),
      inArray(subscriptionEvents.eventType, ['subscription_created', 'subscription_renewed']),
    )),

    // Template popularity (published sites per template)
    db.select({
      id: templates.id,
      title: templates.title,
      domain: templates.domain,
      siteCount: sql<number>`COUNT(${userSites.id})`.as('site_count'),
    })
      .from(templates)
      .leftJoin(userSites, and(
        eq(userSites.templateId, templates.id),
        eq(userSites.status, 'published'),
      ))
      .where(eq(templates.status, 'published'))
      .groupBy(templates.id, templates.title, templates.domain)
      .orderBy(desc(sql`COUNT(${userSites.id})`))
      .limit(8),

    // Top affiliates by commission count
    db.select({
      referrerId: affiliateCommissions.referrerId,
      username: users.username,
      email: users.email,
      totalCommissions: count(affiliateCommissions.id),
      totalAmount: sql<number>`COALESCE(SUM(${affiliateCommissions.commissionAmount}), 0)`.as('total_amount'),
      paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${affiliateCommissions.status} = 'paid' THEN ${affiliateCommissions.commissionAmount} ELSE 0 END), 0)`.as('paid_amount'),
    })
      .from(affiliateCommissions)
      .leftJoin(users, eq(users.id, affiliateCommissions.referrerId))
      .groupBy(affiliateCommissions.referrerId, users.username, users.email)
      .orderBy(desc(count(affiliateCommissions.id)))
      .limit(6),

    // Recent users
    db.select({
      id: users.id, email: users.email, username: users.username,
      plan: users.plan, subscriptionStatus: users.subscriptionStatus, createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)).limit(5),

    // Historical monthly revenue (last 12 months)
    db.select({ amountCents: subscriptionEvents.amountCents, createdAt: subscriptionEvents.createdAt })
      .from(subscriptionEvents)
      .where(and(
        gte(subscriptionEvents.createdAt, new Date(now.getFullYear(), now.getMonth() - 11, 1)),
        inArray(subscriptionEvents.eventType, ['subscription_created', 'subscription_renewed']),
      )),
  ])

  // ── Stripe: pending cancellations ────────────────────────────────────────
  const subIdToMrr = new Map<string, number>()
  let currentMrr = 0
  let monthlyCount = 0, yearlyCount = 0

  for (const u of activeUsersRaw) {
    const rate = mrrFor(u.plan, u.billingInterval)
    currentMrr += rate
    if (u.stripeSubscriptionId) subIdToMrr.set(u.stripeSubscriptionId, rate)
    if (u.billingInterval === 'yearly') yearlyCount++
    else monthlyCount++
  }
  const activeSubsCount = activeUsersRaw.length
  const monthlyPct = activeSubsCount > 0 ? Math.round(monthlyCount / activeSubsCount * 100) : 0
  const yearlyPct  = activeSubsCount > 0 ? Math.round(yearlyCount  / activeSubsCount * 100) : 0

  let pendingCancelCount = 0, mrrAtRisk = 0
  const subEffectiveCents = new Map<string, number>()
  let actualMrr = 0

  try {
    // Parallel: subscriptions + coupons holen
    const [subs, couponsResult] = await Promise.all([
      getStripe().subscriptions.list({ status: 'active', limit: 100, expand: ['data.discounts'] }),
      getStripe().coupons.list({ limit: 100 }),
    ])

    // Coupon-Lookup-Map aufbauen (ID → percent_off, amount_off, duration)
    const couponsMap = new Map<string, { percent_off: number | null; amount_off: number | null; duration: string }>()
    for (const c of couponsResult.data) {
      couponsMap.set(c.id, { percent_off: c.percent_off, amount_off: c.amount_off, duration: c.duration })
    }

    const cancelling = subs.data.filter(s => s.cancel_at_period_end)
    pendingCancelCount = cancelling.length
    for (const s of cancelling) mrrAtRisk += subIdToMrr.get(s.id) ?? 0

    // subEffectiveCents: Discount aus discounts[] Array lesen (flexible billing)
    for (const s of subs.data) {
      const priceId = s.items.data[0]?.price.id ?? ''
      const planKey = s.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'
      const plan = getPlanByPriceId()[priceId] ?? 'starter'
      const fullCents = (PLAN_FULL_PRICE[plan]?.[planKey] ?? 0) * 100

      // Flexible billing: discounts ist Array (nicht discount singular)
      const discounts: any[] = (s as any).discounts ?? []
      let effective = fullCents
      for (const d of discounts) {
        // coupon ID steht in d.source.coupon (string) oder d.coupon.id (object)
        const couponId: string | undefined =
          typeof d?.source?.coupon === 'string' ? d.source.coupon
          : typeof d?.coupon === 'string' ? d.coupon
          : d?.coupon?.id
        if (!couponId) continue
        const coupon = couponsMap.get(couponId)
        if (!coupon || (coupon.duration !== 'forever' && coupon.duration !== 'repeating')) continue
        if (coupon.percent_off) effective = Math.round(fullCents * (1 - coupon.percent_off / 100))
        else if (coupon.amount_off) effective = Math.max(0, fullCents - coupon.amount_off)
        break
      }
      subEffectiveCents.set(s.id, effective)

      // Actual MRR berechnen (monatliches Äquivalent nach Rabatten)
      const interval = s.items.data[0]?.price.recurring?.interval
      actualMrr += interval === 'year' ? effective / 12 / 100 : effective / 100
    }
  } catch { /* Stripe unavailable */ }

  // ── Stripe invoices: actual revenue (post-coupon, post-discount) ─────────
  // Source of truth for "Eingegangen" figures — never uses planCents() fallback
  const stripeRevByMonth = new Map<string, number>()
  try {
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const invoices = await getStripe().invoices.list({
      status: 'paid',
      created: { gte: Math.floor(twelveMonthsAgo.getTime() / 1000) },
      limit: 100,
    })
    for (const inv of invoices.data) {
      const paidTs = (inv as any).status_transitions?.paid_at ?? inv.created
      const d = new Date(paidTs * 1000)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      stripeRevByMonth.set(key, (stripeRevByMonth.get(key) ?? 0) + (inv.amount_paid ?? 0))
    }
  } catch { /* Stripe unavailable — fall back to DB data below */ }

  const useStripeRev = stripeRevByMonth.size > 0

  // ── Plan breakdown ───────────────────────────────────────────────────────
  const planCounts: Record<string, number> = {}
  for (const u of activeUsersRaw) {
    planCounts[u.plan] = (planCounts[u.plan] ?? 0) + 1
  }
  const starterCount   = planCounts['starter']   ?? 0
  const proCount       = planCounts['pro']        ?? 0
  const unlimitedCount = planCounts['unlimited']  ?? 0

  // ── Current month calcs ──────────────────────────────────────────────────
  const curNewSubs    = curMonthEvents.filter(e => e.eventType === 'subscription_created').length
  const curRenewals   = curMonthEvents.filter(e => e.eventType === 'subscription_renewed').length
  // Use Stripe-sourced revenue (actual amount_paid post-coupon); fall back to DB if Stripe unavailable
  const curRevCents   = useStripeRev
    ? (stripeRevByMonth.get(currentMonthKey) ?? 0)
    : curMonthEvents.reduce((s, e) => s + (e.amountCents ?? 0), 0)
  const stillDueCents = dueThisMonth.reduce((s, u) => {
    if (u.stripeSubscriptionId && subEffectiveCents.has(u.stripeSubscriptionId)) {
      return s + subEffectiveCents.get(u.stripeSubscriptionId)!
    }
    return s + (PLAN_FULL_PRICE[u.plan]?.[u.billingInterval ?? 'monthly'] ?? 0) * 100
  }, 0)

  let nextMonthRevCents = 0
  try {
    const upcomingAmounts = await Promise.all(
      dueNextMonth.map(async u => {
        if (!u.stripeSubscriptionId) {
          return (PLAN_FULL_PRICE[u.plan]?.[u.billingInterval ?? 'monthly'] ?? 0) * 100
        }
        if (subEffectiveCents.has(u.stripeSubscriptionId)) {
          return subEffectiveCents.get(u.stripeSubscriptionId)!
        }
        try {
          const upcoming = await getStripe().invoices.retrieveUpcoming({ subscription: u.stripeSubscriptionId })
          return upcoming.amount_due ?? 0
        } catch {
          return (PLAN_FULL_PRICE[u.plan]?.[u.billingInterval ?? 'monthly'] ?? 0) * 100
        }
      })
    )
    nextMonthRevCents = upcomingAmounts.reduce((s, a) => s + a, 0)
  } catch {
    nextMonthRevCents = dueNextMonth.reduce((s, u) => s + (PLAN_FULL_PRICE[u.plan]?.[u.billingInterval ?? 'monthly'] ?? 0) * 100, 0)
  }

  // ── Selected month calcs ─────────────────────────────────────────────────
  const selNewSubs  = selMonthEvents.filter(e => e.eventType === 'subscription_created').length
  const selRenewals = selMonthEvents.filter(e => e.eventType === 'subscription_renewed').length
  // Stripe revenue for selected month (may fall back to DB for months > 12 months ago)
  const selRevCents = useStripeRev
    ? (stripeRevByMonth.get(selectedMonth) ?? selMonthEvents.reduce((s, e) => s + (e.amountCents ?? 0), 0))
    : selMonthEvents.reduce((s, e) => s + (e.amountCents ?? 0), 0)
  const selCanceled = selMonthCanceled[0]?.total ?? 0
  const selChurnPct = activeSubsCount > 0 ? (selCanceled / activeSubsCount * 100).toFixed(1) : '0.0'
  const isCurrentMonth = selectedMonth === currentMonthKey

  // ── Year-to-date calcs ───────────────────────────────────────────────────
  const ytdRevCents = useStripeRev
    ? Array.from(stripeRevByMonth.entries())
        .filter(([k]) => k >= `${now.getFullYear()}-01`)
        .reduce((s, [, v]) => s + v, 0)
    : ytdEvents.reduce((s, e) => s + (e.amountCents ?? 0), 0)
  const ytdNewSubs   = ytdEvents.filter(e => e.eventType === 'subscription_created').length
  const ytdRenewals  = ytdEvents.filter(e => e.eventType === 'subscription_renewed').length
  const monthsElapsed = now.getMonth() + 1 // Jan = 1
  const avgMonthlyRev = ytdRevCents / monthsElapsed

  // ── Historical revenue chart data (last 12 months) ───────────────────────
  const chartMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    return {
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('de-DE', { month: 'short' }),
      cents: 0,
    }
  })
  if (useStripeRev) {
    for (const m of chartMonths) {
      m.cents = stripeRevByMonth.get(m.key) ?? 0
    }
  } else {
    for (const e of historicalEvents) {
      const k = (e.createdAt as Date).toISOString().slice(0, 7)
      const m = chartMonths.find(m => m.key === k)
      if (m) m.cents += e.amountCents ?? 0
    }
  }
  const maxCents = Math.max(...chartMonths.map(m => m.cents), 1)

  // ── Available months for picker ──────────────────────────────────────────
  const availableMonths = genMonths(18)
  const selLabel = availableMonths.find(m => m.value === selectedMonth)?.label
    ?? new Date(selYear, selMonthNum - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  // ── Total template site count (for % calc) ───────────────────────────────
  const totalTemplateSites = templateStats.reduce((s, t) => s + (t.siteCount ?? 0), 0) || 1

  const cardStyle = { boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }

  return (
    <div style={{ maxWidth: 1080 }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Übersicht</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            {now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link href="/admin/templates/new"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-[14px] flex-shrink-0"
          style={{ background: '#1a1a1a' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Template
        </Link>
      </div>

      {/* ── 4 Hero KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">

        {/* Zahlende Nutzer */}
        <div className="rounded-[20px] bg-white p-5" style={cardStyle}>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-3" style={{ color: '#94A3B8' }}>Zahlende Nutzer</p>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{activeSubsCount}</p>
          <p className="text-xs mt-1.5" style={{ color: '#94A3B8' }}>
            {totalUsers} Nutzer gesamt &bull; +{newUsersMonth} (30 Tage)
          </p>
          {pendingCancelCount > 0 && (
            <Link href="/admin/cancellations" className="text-xs mt-2 block font-medium" style={{ color: '#F97316' }}>
              {pendingCancelCount} Kündigung{pendingCancelCount !== 1 ? 'en' : ''} ausstehend →
            </Link>
          )}
        </div>

        {/* Veröffentlichte Seiten */}
        <Link href="/admin/sites" className="rounded-[20px] bg-white p-5 block hover:bg-gray-50 transition-colors" style={cardStyle}>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-3" style={{ color: '#94A3B8' }}>Veröff. Seiten</p>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{publishedSites}</p>
          <p className="text-xs mt-1.5" style={{ color: '#94A3B8' }}>Live im Netz</p>
        </Link>

        {/* MRR */}
        <Link href="/admin/mrr" className="rounded-[20px] bg-white p-5 block hover:bg-gray-50 transition-colors" style={cardStyle}>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-3" style={{ color: '#94A3B8' }}>MRR (nominell)</p>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">€ {fmtEur(currentMrr)}</p>
          <p className="text-xs mt-1" style={{ color: actualMrr < currentMrr * 0.99 ? '#F97316' : '#94A3B8' }}>
            Effektiv: € {fmtEur(actualMrr)}{actualMrr === 0 && currentMrr > 0 ? ' (alle Rabatt-Nutzer)' : ''}
          </p>
          {mrrAtRisk > 0 && (
            <p className="text-xs mt-0.5" style={{ color: '#F97316' }}>− € {fmtEur(mrrAtRisk)} gefährdet</p>
          )}
        </Link>

        {/* Billing Split */}
        <div className="rounded-[20px] bg-white p-5" style={cardStyle}>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-3" style={{ color: '#94A3B8' }}>Abo-Laufzeit</p>
          <div className="flex items-end gap-3">
            <div>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">{monthlyPct}%</p>
              <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>Monatlich</p>
            </div>
            <div className="mb-1 text-gray-300 font-light">·</div>
            <div>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">{yearlyPct}%</p>
              <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>Jährlich</p>
            </div>
          </div>
          <p className="text-xs mt-1.5" style={{ color: '#94A3B8' }}>{monthlyCount} / {yearlyCount} aktive Abos</p>
        </div>

      </div>

      {/* ── Aktueller Monat – dunkle Karte ────────────────────────────────── */}
      <div className="rounded-[20px] p-6 mb-4" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>
        <div className="flex items-center justify-between mb-5">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#475569' }}>
            Aktueller Monat
          </span>
          <span className="text-xs font-medium" style={{ color: '#64748B' }}>
            {now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">

          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: '#64748B' }}>Eingegangen</p>
            <p className="text-2xl font-bold text-white tracking-tight">€ {fmtEurCents(curRevCents)}</p>
            <p className="text-[11px] mt-1" style={{ color: '#334155' }}>tatsächlich geflossen</p>
          </div>

          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: '#64748B' }}>Noch ausstehend</p>
            <p className="text-2xl font-bold tracking-tight" style={{ color: stillDueCents > 0 ? '#FCD34D' : '#475569' }}>
              € {fmtEurCents(stillDueCents)}
            </p>
            <p className="text-[11px] mt-1" style={{ color: '#334155' }}>{dueThisMonth.length} Abos erneuern noch</p>
          </div>

          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: '#64748B' }}>Neukunden</p>
            <p className="text-2xl font-bold text-white tracking-tight">{curNewSubs}</p>
            <p className="text-[11px] mt-1" style={{ color: '#334155' }}>neue Abos diesen Monat</p>
          </div>

          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: '#64748B' }}>Verlängerungen</p>
            <p className="text-2xl font-bold text-white tracking-tight">{curRenewals}</p>
            <p className="text-[11px] mt-1" style={{ color: '#334155' }}>Bestandskunden verlängert</p>
          </div>

          <div>
            <p className="text-[11px] font-medium mb-1.5" style={{ color: '#64748B' }}>Nächster Monat</p>
            <p className="text-2xl font-bold tracking-tight" style={{ color: '#34D399' }}>
              € {fmtEurCents(nextMonthRevCents)}
            </p>
            <p className="text-[11px] mt-1" style={{ color: '#334155' }}>{dueNextMonth.length} Verlängerungen erwartet</p>
          </div>

        </div>
      </div>

      {/* ── Monatsanalyse + Jahresübersicht ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-4">

        {/* Monatsanalyse */}
        <div className="lg:col-span-3 rounded-[20px] bg-white p-6" style={cardStyle}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-gray-900">Monatsanalyse</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>Wähle jeden Monat zum Vergleich</p>
            </div>
            <MonthSelector selected={selectedMonth} months={availableMonths} />
          </div>

          <div className="grid grid-cols-2 gap-3">

            <div className="rounded-[14px] p-4" style={{ background: '#F8FAFC' }}>
              <p className="text-[11px] font-medium mb-1" style={{ color: '#94A3B8' }}>Umsatz eingegangen</p>
              <p className="text-2xl font-bold text-gray-900">€ {fmtEurCents(selRevCents)}</p>
            </div>

            <div className="rounded-[14px] p-4" style={{ background: '#F8FAFC' }}>
              <p className="text-[11px] font-medium mb-1" style={{ color: '#94A3B8' }}>Neukunden</p>
              <p className="text-2xl font-bold text-gray-900">{selNewSubs}</p>
            </div>

            <div className="rounded-[14px] p-4" style={{ background: '#F8FAFC' }}>
              <p className="text-[11px] font-medium mb-1" style={{ color: '#94A3B8' }}>Verlängerungen</p>
              <p className="text-2xl font-bold text-gray-900">{selRenewals}</p>
            </div>

            <div className="rounded-[14px] p-4" style={{ background: '#F8FAFC' }}>
              <p className="text-[11px] font-medium mb-1" style={{ color: '#94A3B8' }}>
                Kündigungen {isCurrentMonth ? '(Periode endet)' : '(Periode abgelaufen)'}
              </p>
              <p className="text-2xl font-bold" style={{ color: selCanceled > 0 ? '#EF4444' : '#1a1a1a' }}>
                {selCanceled}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>
                ≈ {selChurnPct} % Churn
              </p>
            </div>

          </div>
        </div>

        {/* Jahresübersicht */}
        <div className="lg:col-span-2 rounded-[20px] bg-white p-6 flex flex-col" style={cardStyle}>
          <div className="mb-5">
            <p className="text-sm font-semibold text-gray-900">Jahr {now.getFullYear()}</p>
            <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>Jan – {now.toLocaleDateString('de-DE', { month: 'short' })}</p>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            <div>
              <p className="text-[11px] font-medium" style={{ color: '#94A3B8' }}>Gesamtumsatz</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">€ {fmtEurCents(ytdRevCents)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[12px] p-3 text-center" style={{ background: '#F0FDF4' }}>
                <p className="text-lg font-bold" style={{ color: '#16A34A' }}>{ytdNewSubs}</p>
                <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>Neukunden</p>
              </div>
              <div className="rounded-[12px] p-3 text-center" style={{ background: '#EFF6FF' }}>
                <p className="text-lg font-bold" style={{ color: '#2563EB' }}>{ytdRenewals}</p>
                <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>Verlänger.</p>
              </div>
              <div className="rounded-[12px] p-3 text-center" style={{ background: '#F9FAFB' }}>
                <p className="text-lg font-bold text-gray-900">€ {fmtEurCents(avgMonthlyRev)}</p>
                <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>Ø / Monat</p>
              </div>
            </div>
          </div>

          {/* Mini revenue chart */}
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #F1F5F9' }}>
            <p className="text-[10px] mb-2" style={{ color: '#94A3B8' }}>Umsatz letzte 12 Monate</p>
            <div className="flex items-end gap-1 h-10">
              {chartMonths.map(m => {
                const h = maxCents > 0 ? Math.max((m.cents / maxCents) * 100, m.cents > 0 ? 8 : 2) : 2
                const isCur = m.key === currentMonthKey
                return (
                  <div key={m.key} className="flex-1 rounded-t-[3px]"
                    style={{ height: `${h}%`, background: isCur ? '#0F172A' : m.cents > 0 ? '#CBD5E1' : '#F1F5F9', minHeight: 2 }}
                    title={`${m.label}: € ${fmtEurCents(m.cents)}`}
                  />
                )
              })}
            </div>
          </div>
        </div>

      </div>

      {/* ── Plan-Verteilung ───────────────────────────────────────────────── */}
      <div className="rounded-[20px] bg-white p-6 mb-4" style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">Plan-Verteilung</p>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: '#F1F5F9', color: '#475569' }}>
            {activeSubsCount} aktive Abos
          </span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden gap-px mb-4">
          {starterCount > 0 && <div style={{ width: `${starterCount / activeSubsCount * 100}%`, background: '#3B82F6' }} />}
          {proCount > 0 && <div style={{ width: `${proCount / activeSubsCount * 100}%`, background: '#8B5CF6' }} />}
          {unlimitedCount > 0 && <div style={{ width: `${unlimitedCount / activeSubsCount * 100}%`, background: '#10B981' }} />}
          {activeSubsCount === 0 && <div style={{ width: '100%', background: '#F1F5F9' }} />}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {([['starter', starterCount], ['pro', proCount], ['unlimited', unlimitedCount]] as [keyof typeof PLAN_META, number][]).map(([key, cnt]) => {
            const meta = PLAN_META[key]
            const pct  = activeSubsCount > 0 ? Math.round(cnt / activeSubsCount * 100) : 0
            const mrr  = cnt * mrrFor(key, 'monthly')
            return (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
                  <span className="text-sm text-gray-700 font-medium">{meta.label}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{cnt}</p>
                  <p className="text-[10px]" style={{ color: '#94A3B8' }}>{pct}% · € {fmtEur(mrr)}/Mo</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid #F8FAFC' }}>
          <span className="text-xs font-medium text-gray-600">MRR gesamt (nominell)</span>
          <div className="flex items-center gap-4">
            {mrrAtRisk > 0 && (
              <span className="text-xs font-medium" style={{ color: '#F97316' }}>− € {fmtEur(mrrAtRisk)} gefährdet</span>
            )}
            <span className="text-sm font-bold text-gray-900">€ {fmtEur(currentMrr)}</span>
          </div>
        </div>
      </div>

      {/* ── Template-Ranking + Top-Affiliates ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">

        {/* Template-Ranking */}
        <div className="rounded-[20px] bg-white overflow-hidden" style={cardStyle}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F8FAFC' }}>
            <p className="text-sm font-semibold text-gray-900">Beliebteste Templates</p>
            <Link href="/admin/templates" className="text-xs font-medium" style={{ color: '#3B82F6' }}>Alle →</Link>
          </div>
          {templateStats.length === 0 ? (
            <p className="px-6 py-8 text-sm text-center" style={{ color: '#94A3B8' }}>Noch keine veröffentlichten Templates.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
              {templateStats.map((t, i) => {
                const pct = Math.round((t.siteCount ?? 0) / totalTemplateSites * 100)
                return (
                  <Link key={t.id} href={`/admin/templates/${t.id}`}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                    <span className="text-[11px] font-bold w-4 flex-shrink-0" style={{ color: i === 0 ? '#F59E0B' : '#CBD5E1' }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                      <p className="text-[10px] truncate" style={{ color: '#94A3B8' }}>{t.domain}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">{t.siteCount ?? 0}</p>
                      <p className="text-[10px]" style={{ color: '#94A3B8' }}>{pct}%</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Top-Affiliates */}
        <div className="rounded-[20px] bg-white overflow-hidden" style={cardStyle}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F8FAFC' }}>
            <p className="text-sm font-semibold text-gray-900">Top Affiliates</p>
            <Link href="/admin/affiliate" className="text-xs font-medium" style={{ color: '#3B82F6' }}>Alle →</Link>
          </div>
          {affiliateStats.length === 0 ? (
            <p className="px-6 py-8 text-sm text-center" style={{ color: '#94A3B8' }}>Noch keine Affiliate-Daten.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
              {affiliateStats.map((a, i) => (
                <div key={a.referrerId ?? i} className="flex items-center gap-3 px-6 py-3">
                  <span className="text-[11px] font-bold w-4 flex-shrink-0" style={{ color: i === 0 ? '#F59E0B' : '#CBD5E1' }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {a.username ? `@${a.username}` : (a.email ?? '–')}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: '#94A3B8' }}>{a.totalCommissions} Empfehlung{a.totalCommissions !== 1 ? 'en' : ''}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">€ {fmtEurCents(Number(a.totalAmount))}</p>
                    <p className="text-[10px]" style={{ color: '#94A3B8' }}>
                      € {fmtEurCents(Number(a.paidAmount))} ausgezahlt
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Neueste Nutzer ────────────────────────────────────────────────── */}
      <div className="rounded-[20px] bg-white overflow-hidden" style={cardStyle}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F8FAFC' }}>
          <p className="text-sm font-semibold text-gray-900">Neueste Nutzer</p>
          <Link href="/admin/users" className="text-xs font-medium" style={{ color: '#3B82F6' }}>
            Alle {totalUsers} anzeigen →
          </Link>
        </div>
        <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
          {recentUsers.map(u => {
            const planMeta   = PLAN_META[u.plan as keyof typeof PLAN_META] ?? PLAN_META.starter
            const statusMeta = u.subscriptionStatus ? (STATUS_META[u.subscriptionStatus] ?? null) : null
            return (
              <Link key={u.id} href={`/admin/users/${u.id}`}
                className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-gray-50">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: planMeta.bg, color: planMeta.text }}>
                  {u.email.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                  <p className="text-xs truncate" style={{ color: '#94A3B8' }}>
                    {u.username ? `@${u.username}` : 'Kein Username'}
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

    </div>
  )
}
