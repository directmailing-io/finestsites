import { db } from '@/lib/db'
import { users, userSites, subscriptionEvents } from '@/lib/db/schema'
import { desc, inArray, gt, sum } from 'drizzle-orm'
import { PLANS } from '@/lib/plans'
import { getStripe } from '@/lib/stripe/client'
import type { PlanKey, BillingInterval } from '@/lib/plans'
import AdminUsersTable from './AdminUsersTable'
import type { UserRow } from './AdminUsersTable'

// Always fetch fresh data — never serve a cached version.
export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Monthly-equivalent revenue in cents for an active subscription (plan-price fallback). */
function mrrCentsFallback(plan: string, interval: string): number {
  const p = PLANS[plan as PlanKey]
  if (!p) return 0
  if (interval === 'yearly') return Math.round((p.yearly_eur * 100) / 12)
  return p.monthly_eur * 100
}

/**
 * Calculate true MRR from a Stripe invoice (most recent paid invoice = ground truth).
 * Handles one-time coupons, promotional codes, and customer/subscription discounts
 * because it uses the actual charged amount, not the catalog price.
 */
function invoiceMrrCents(amountPaid: number, interval: 'month' | 'year' | string): number {
  return interval === 'year' ? Math.round(amountPaid / 12) : amountPaid
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

  // Fetch true MRR from the most recent paid Stripe invoice (ground truth — reflects
  // all discounts including one-time promo codes, even after subscription.discount expires).
  // We store results as `number | null`:
  //   number  = Stripe returned an invoice → use it (even if 0 = 100% discounted)
  //   null    = Stripe call failed / no invoice → use plan-price fallback
  const activeWithStripe = allUsers.filter(
    u => u.subscriptionStatus === 'active' && u.stripeSubscriptionId
  )
  const stripeMrrByUser: Record<string, number | null> = {}
  if (activeWithStripe.length > 0) {
    const stripe = getStripe()
    const results = await Promise.allSettled(
      activeWithStripe.map(async u => {
        // Fetch the subscription (for billing interval) + latest paid invoice in parallel
        const [sub, invoices] = await Promise.all([
          stripe.subscriptions.retrieve(u.stripeSubscriptionId!),
          stripe.invoices.list({
            subscription: u.stripeSubscriptionId!,
            limit: 1,
            status: 'paid',
          }),
        ])
        const interval = sub.items.data[0]?.price?.recurring?.interval ?? 'month'
        // amount_paid can legitimately be 0 (100% coupon). Keep it as-is.
        // Only return null when there is truly no invoice to read from.
        const amountPaid = invoices.data.length > 0 ? (invoices.data[0].amount_paid ?? 0) : null
        return { userId: u.id, amountPaid, interval }
      })
    )
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        // null means "no invoice found" → leave entry absent so fallback applies
        // number (including 0) means "Stripe told us exactly this amount"
        if (result.value.amountPaid !== null) {
          stripeMrrByUser[result.value.userId] = invoiceMrrCents(
            result.value.amountPaid,
            result.value.interval,
          )
        }
      } else {
        console.error('[admin/users] Stripe MRR fetch failed:', result.reason?.message ?? result.reason)
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
