import { db } from '@/lib/db'
import { users, userSites } from '@/lib/db/schema'
import { desc, inArray } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'
import type { BillingInterval } from '@/lib/plans'
import AdminUsersTable from './AdminUsersTable'
import type { UserRow } from './AdminUsersTable'

// Always fetch fresh data — never serve a cached version.
export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Convert yearly price to monthly equivalent. */
function monthlyEquiv(cents: number, interval: string): number {
  return interval === 'year' ? Math.round(cents / 12) : cents
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

  // Per-user data fetched live from Stripe (single source of truth).
  const stripePlanPriceByUser: Record<string, number> = {}   // catalog monthly price (no discounts)
  const stripeRevenueByUser: Record<string, number> = {}     // total cash actually received
  const cancelAtPeriodEndByUser: Record<string, boolean> = {}
  const stripePromoByUser: Record<string, string | null> = {} // promo code used at checkout

  const usersWithStripe = allUsers.filter(u => u.stripeCustomerId)
  if (usersWithStripe.length > 0) {
    const stripe = getStripe()
    await Promise.allSettled(
      usersWithStripe.map(async u => {
        const isActive = u.subscriptionStatus === 'active' && u.stripeSubscriptionId

        const [allInvoices, sub] = await Promise.all([
          stripe.invoices.list({ customer: u.stripeCustomerId!, status: 'paid', limit: 100 }),
          isActive
            ? stripe.subscriptions.retrieve(u.stripeSubscriptionId!)
            : Promise.resolve(null),
        ])

        // Gesamtumsatz = all cash actually received (invoices with amount_paid > 0)
        stripeRevenueByUser[u.id] = allInvoices.data.reduce(
          (s, inv) => s + (inv.amount_paid > 0 ? inv.amount_paid : 0),
          0,
        )

        if (isActive && sub) {
          cancelAtPeriodEndByUser[u.id] = sub.cancel_at_period_end
          const interval = sub.items.data[0]?.price?.recurring?.interval ?? 'month'
          const catalogPrice = sub.items.data[0]?.price?.unit_amount ?? 0

          // Planpreis = catalog monthly price (what the plan costs, before any discounts).
          // For yearly plans, divide by 12 to get monthly equivalent.
          stripePlanPriceByUser[u.id] = monthlyEquiv(catalogPrice, interval)

          // Promo code used at checkout — stored in subscription metadata by the webhook handler.
          stripePromoByUser[u.id] = sub.metadata?.promo_code || null
        }
      })
    )
  }

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
    // Catalog monthly price — what this plan costs without discounts (direct from Stripe)
    planPriceCents: stripePlanPriceByUser[u.id] ?? 0,
    // Total cash received from this customer across all time (direct from Stripe invoices)
    totalRevenueCents: stripeRevenueByUser[u.id] ?? 0,
    // Promo code applied at checkout (e.g. "ADMIN100")
    activePromoCode: stripePromoByUser[u.id] ?? null,
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
