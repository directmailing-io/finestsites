import { db } from '@/lib/db'
import { users, userSites } from '@/lib/db/schema'
import { desc, inArray } from 'drizzle-orm'
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

function invoiceMrrCents(amountPaid: number, interval: string): number {
  return interval === 'year' ? Math.round(amountPaid / 12) : amountPaid
}

export default async function AdminUsersPage() {
  const [allUsers, allSites] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        plan: users.plan,
        billingInterval: users.billingInterval,
        subscriptionStatus: users.subscriptionStatus,
        currentPeriodEnd: users.currentPeriodEnd,
        createdAt: users.createdAt,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .orderBy(desc(users.createdAt)),

    db
      .select({ userId: userSites.userId, status: userSites.status })
      .from(userSites)
      .where(inArray(userSites.status, ['draft', 'published'])),
  ])

  // Single Stripe pass per customer — fetches both revenue AND MRR/subscription data.
  // Stripe is the single source of truth; the local subscriptionEvents table is NOT used
  // because it has been found to contain data that does not match actual Stripe invoices.
  const stripeMrrByUser: Record<string, number> = {}
  const stripeRevenueByUser: Record<string, number> = {}
  const cancelAtPeriodEndByUser: Record<string, boolean> = {}

  const usersWithStripe = allUsers.filter(u => u.stripeCustomerId)
  if (usersWithStripe.length > 0) {
    const stripe = getStripe()
    await Promise.allSettled(
      usersWithStripe.map(async u => {
        const isActive = u.subscriptionStatus === 'active' && u.stripeSubscriptionId

        // Fetch ALL paid invoices for this customer (revenue ground truth) and,
        // for active subscribers, also the subscription object for MRR + cancellation.
        const [allInvoices, sub] = await Promise.all([
          stripe.invoices.list({ customer: u.stripeCustomerId!, status: 'paid', limit: 100 }),
          isActive
            ? stripe.subscriptions.retrieve(u.stripeSubscriptionId!, {
                // Stripe new API: discount lives in discounts[] not legacy discount field
                expand: ['discounts', 'discounts.coupon'],
              } as Parameters<typeof stripe.subscriptions.retrieve>[1])
            : Promise.resolve(null),
        ])

        // Real total revenue = cash actually received (all time, all subscriptions)
        stripeRevenueByUser[u.id] = allInvoices.data.reduce(
          (s, inv) => s + (inv.amount_paid > 0 ? inv.amount_paid : 0),
          0,
        )

        if (isActive && sub) {
          cancelAtPeriodEndByUser[u.id] = sub.cancel_at_period_end
          const interval = sub.items.data[0]?.price?.recurring?.interval ?? 'month'
          const catalogPrice = sub.items.data[0]?.price?.unit_amount ?? 0

          // Read discount from new Stripe API (discounts array) with fallback to legacy field.
          // Stripe API 2023+: discounts[] is the canonical source; sub.discount is deprecated.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subAny = sub as any
          const disc = subAny.discounts?.[0] ?? subAny.discount ?? null

          // Coupon duration determines whether the discount is permanent or one-time:
          // - 'once':      promo already consumed after first invoice → next charge = catalogPrice
          // - 'forever':   applied every cycle → effectivePrice = catalogPrice − discount
          // - 'repeating': same as forever (conservative)
          const couponDuration: string = disc?.coupon?.duration ?? 'once'
          const applyDiscount = couponDuration === 'forever' || couponDuration === 'repeating'
          const percentOff: number = applyDiscount ? (disc?.coupon?.percent_off ?? 0) : 0
          const amountOff: number = applyDiscount ? (disc?.coupon?.amount_off ?? 0) : 0
          const effectivePrice = Math.max(
            0,
            Math.round(catalogPrice * (1 - percentOff / 100)) - amountOff,
          )

          // MRR logic:
          // - forever 100% discount → effectivePrice = 0 → MRR = 0, ALWAYS (even if latestPaid > 0
          //   from before the discount was applied). This is the true recurring revenue going forward.
          // - otherwise: use last paid invoice if > 0 (real cash), else effectivePrice (next charge).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subInvoice = allInvoices.data.find(inv => (inv as any).subscription === u.stripeSubscriptionId)
          const latestPaid = subInvoice?.amount_paid ?? 0
          const mrrBasis = effectivePrice === 0
            ? 0
            : latestPaid > 0 ? latestPaid : effectivePrice
          stripeMrrByUser[u.id] = invoiceMrrCents(mrrBasis, interval)
        }
      })
    )
  }

  // Published site count per user
  const siteCountByUser: Record<string, number> = {}
  for (const site of allSites) {
    if (site.status === 'published') {
      siteCountByUser[site.userId] = (siteCountByUser[site.userId] ?? 0) + 1
    }
  }

  const rows: UserRow[] = allUsers.map(u => ({
    id: u.id,
    email: u.email,
    username: u.username,
    plan: u.plan,
    billingInterval: u.billingInterval as BillingInterval,
    subscriptionStatus: u.subscriptionStatus,
    currentPeriodEnd: u.currentPeriodEnd,
    cancelAtPeriodEnd: cancelAtPeriodEndByUser[u.id] ?? false,
    createdAt: u.createdAt,
    siteCount: siteCountByUser[u.id] ?? 0,
    // Real cash received — direct from Stripe, not from the local events journal
    totalRevenueCents: stripeRevenueByUser[u.id] ?? 0,
    // MRR only for subscriptions that will actually renew (cancel_at_period_end excluded)
    mrrCents: u.subscriptionStatus === 'active' && !cancelAtPeriodEndByUser[u.id]
      ? (stripeMrrByUser[u.id] ?? mrrCentsFallback(u.plan, u.billingInterval))
      : 0,
    emailVerified: u.emailVerified,
  }))

  return (
    <div style={{ maxWidth: 1200 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Nutzer</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
          Tarif, Status und Umsatz auf einen Blick · Alle Zahlen direkt aus Stripe
        </p>
      </div>

      <AdminUsersTable users={rows} />
    </div>
  )
}
