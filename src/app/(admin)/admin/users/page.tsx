import { db } from '@/lib/db'
import { users, userSites, subscriptionEvents } from '@/lib/db/schema'
import { desc, inArray, gt, sum } from 'drizzle-orm'
import { PLANS } from '@/lib/plans'
import { getStripe } from '@/lib/stripe/client'
import type { PlanKey, BillingInterval } from '@/lib/plans'
import AdminUsersTable from './AdminUsersTable'
import type { UserRow } from './AdminUsersTable'

/** Monthly-equivalent revenue in cents for an active subscription. */
function mrrCentsFallback(plan: string, interval: string): number {
  const p = PLANS[plan as PlanKey]
  if (!p) return 0
  if (interval === 'yearly') return Math.round((p.yearly_eur * 100) / 12)
  return p.monthly_eur * 100
}

/** Calculate MRR in cents from a Stripe subscription (accounts for discounts). */
function stripeMrrCents(sub: {
  items: { data: Array<{ price: { unit_amount: number | null; recurring?: { interval: string } | null } }> }
  discount?: { coupon?: { percent_off?: number | null; amount_off?: number | null } | null } | null
}): number {
  const item = sub.items.data[0]
  if (!item) return 0
  const baseAmount = item.price.unit_amount ?? 0
  const coupon = sub.discount?.coupon
  let discounted = baseAmount
  if (coupon?.percent_off) {
    discounted = Math.round(baseAmount * (1 - coupon.percent_off / 100))
  } else if (coupon?.amount_off) {
    discounted = Math.max(0, baseAmount - coupon.amount_off)
  }
  const interval = item.price.recurring?.interval
  return interval === 'year' ? Math.round(discounted / 12) : discounted
}

export default async function AdminUsersPage() {
  const [allUsers, allSites, revenueTotals] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        plan: users.plan,
        billingInterval: users.billingInterval,
        subscriptionStatus: users.subscriptionStatus,
        createdAt: users.createdAt,
        stripeSubscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .orderBy(desc(users.createdAt)),

    db
      .select({
        userId: userSites.userId,
        status: userSites.status,
      })
      .from(userSites)
      .where(inArray(userSites.status, ['draft', 'published'])),

    // Sum all recorded payment amounts per user from subscription events
    db
      .select({
        userId: subscriptionEvents.userId,
        totalCents: sum(subscriptionEvents.amountCents),
      })
      .from(subscriptionEvents)
      .where(gt(subscriptionEvents.amountCents, 0))
      .groupBy(subscriptionEvents.userId),
  ])

  // Fetch real MRR from Stripe for active subscribers (parallel, best-effort)
  const activeWithStripe = allUsers.filter(
    u => u.subscriptionStatus === 'active' && u.stripeSubscriptionId
  )
  const stripeMrrByUser: Record<string, number> = {}
  if (activeWithStripe.length > 0) {
    const stripe = getStripe()
    const results = await Promise.allSettled(
      activeWithStripe.map(u =>
        stripe.subscriptions.retrieve(u.stripeSubscriptionId!, {
          expand: ['discount.coupon'],
        })
      )
    )
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        stripeMrrByUser[activeWithStripe[i].id] = stripeMrrCents(result.value as any)
      }
    })
  }

  // Published site count per user
  const siteCountByUser: Record<string, number> = {}
  for (const site of allSites) {
    if (site.status === 'published') {
      siteCountByUser[site.userId] = (siteCountByUser[site.userId] ?? 0) + 1
    }
  }

  // Revenue total per user
  const revenueByUser: Record<string, number> = {}
  for (const r of revenueTotals) {
    revenueByUser[r.userId] = Number(r.totalCents ?? 0)
  }

  const rows: UserRow[] = allUsers.map(u => ({
    id: u.id,
    email: u.email,
    username: u.username,
    plan: u.plan,
    billingInterval: u.billingInterval as BillingInterval,
    subscriptionStatus: u.subscriptionStatus,
    createdAt: u.createdAt,
    siteCount: siteCountByUser[u.id] ?? 0,
    totalRevenueCents: revenueByUser[u.id] ?? 0,
    mrrCents: u.subscriptionStatus === 'active'
      ? (stripeMrrByUser[u.id] ?? mrrCentsFallback(u.plan, u.billingInterval))
      : 0,
  }))

  return (
    <div style={{ maxWidth: 1200 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Nutzer</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
          Tarif, Status und Umsatz auf einen Blick
        </p>
      </div>

      <AdminUsersTable users={rows} />
    </div>
  )
}
