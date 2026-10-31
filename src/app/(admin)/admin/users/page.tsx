import { db } from '@/lib/db'
import { users, userSites, templates, sessions } from '@/lib/db/schema'
import { desc, inArray, max, eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'
import type { BillingInterval } from '@/lib/plans'
import { getAppUsageByUser, NO_APP_USAGE } from '@/lib/admin/app-usage'
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
  const [allUsers, allSites, appUsageByUser, lastActiveRows] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        plan: users.plan,
        billingInterval: users.billingInterval,
        subscriptionStatus: users.subscriptionStatus,
        currentPeriodEnd: users.currentPeriodEnd,
        pendingPlan: users.pendingPlan,
        pendingPlanAt: users.pendingPlanAt,
        createdAt: users.createdAt,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        emailVerified: users.emailVerified,
        deletionScheduledFor: users.deletionScheduledFor,
        deletedAt: users.deletedAt,
        referredByUsername: users.referredByUsername,
        teamPartnerNumber: users.teamPartnerNumber,
      })
      .from(users)
      .orderBy(desc(users.createdAt)),

    db
      .select({ userId: userSites.userId, status: userSites.status, customDomain: userSites.customDomain, templateTitle: templates.title })
      .from(userSites)
      .leftJoin(templates, eq(templates.id, userSites.templateId))
      .where(inArray(userSites.status, ['draft', 'published'])),

    // Native App: push_devices + App-Sitzungen, je Nutzer aggregiert (2 Abfragen)
    getAppUsageByUser(),

    // Letzte Aktivität = jüngste Sitzung (Web oder App)
    db
      .select({ userId: sessions.userId, lastActiveAt: max(sessions.updatedAt) })
      .from(sessions)
      .groupBy(sessions.userId),
  ])

  // Per-user data fetched live from Stripe (single source of truth).
  const stripePlanPriceByUser: Record<string, number> = {}   // catalog monthly price (no discounts)
  const stripeBilledPriceByUser: Record<string, number> = {} // effective monthly price after active discounts
  const stripeRevenueByUser: Record<string, number> = {}     // total cash actually received
  const cancelAtPeriodEndByUser: Record<string, boolean> = {}
  const stripePromoByUser: Record<string, string | null> = {}      // human-readable promo code string (e.g. "ADMIN100")
  const stripeCouponNameByUser: Record<string, string | null> = {} // coupon name/label (e.g. "Admin 100% Rabatt")

  // Gelöschte Konten (Grabsteine) nicht live bei Stripe abfragen
  const usersWithStripe = allUsers.filter(u => u.stripeCustomerId && !u.deletedAt)
  if (usersWithStripe.length > 0) {
    const stripe = getStripe()
    await Promise.allSettled(
      usersWithStripe.map(async u => {
        const isActive = ['active', 'trialing', 'past_due'].includes(u.subscriptionStatus ?? '') && !!u.stripeSubscriptionId

        const [allInvoices, sub] = await Promise.all([
          stripe.invoices.list({ customer: u.stripeCustomerId!, status: 'paid', limit: 100 }),
          isActive
            // Stripe API 2024+: coupon lives at discounts[].source.coupon (not discounts[].coupon)
            ? stripe.subscriptions.retrieve(
                u.stripeSubscriptionId!,
                { expand: ['discounts.source.coupon'] } as Parameters<typeof stripe.subscriptions.retrieve>[1],
              )
            : Promise.resolve(null),
        ])

        // Eingenommen = all cash actually received (invoices with amount_paid > 0)
        stripeRevenueByUser[u.id] = allInvoices.data.reduce(
          (s, inv) => s + (inv.amount_paid > 0 ? inv.amount_paid : 0),
          0,
        )

        if (isActive && sub) {
          cancelAtPeriodEndByUser[u.id] = sub.cancel_at_period_end
          const interval = sub.items.data[0]?.price?.recurring?.interval ?? 'month'
          const catalogPrice = sub.items.data[0]?.price?.unit_amount ?? 0

          // Planpreis = catalog monthly price before any discounts
          stripePlanPriceByUser[u.id] = monthlyEquiv(catalogPrice, interval)

          // Abgerechnet = what will actually be charged (catalog minus active permanent discount).
          // Stripe API 2024+: coupon is at discounts[].source.coupon (not discounts[].coupon).
          // 'once' coupons are consumed after first invoice → next charge = full catalog price.
          // 'forever'/'repeating' coupons apply every cycle → reduce accordingly.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subAny = sub as any
          const disc = subAny.discounts?.[0] ?? subAny.discount ?? null
          // New API: coupon at disc.source.coupon. Old/legacy API: disc.coupon.
          const coupon = disc?.source?.coupon ?? disc?.coupon ?? null
          const couponDuration: string = coupon?.duration ?? 'once'
          const applyDiscount = couponDuration === 'forever' || couponDuration === 'repeating'
          const percentOff: number = applyDiscount ? (coupon?.percent_off ?? 0) : 0
          const amountOff: number = applyDiscount ? (coupon?.amount_off ?? 0) : 0
          const billedCents = Math.max(0, Math.round(catalogPrice * (1 - percentOff / 100)) - amountOff)
          stripeBilledPriceByUser[u.id] = monthlyEquiv(billedCents, interval)

          // Promo code: disc.source is the PromotionCode object (expanded via discounts.source.coupon).
          // disc.source.code = human-readable string like "ADMIN100".
          // Fall back to coupon.name, then coupon.id as last resort.
          const hasDiscount = billedCents < catalogPrice
          const promoCodeStr: string | null = (disc?.source as any)?.code ?? null
          const couponName: string | null = coupon?.name ?? null
          stripePromoByUser[u.id] = hasDiscount
            ? (promoCodeStr ?? couponName ?? coupon?.id ?? null)
            : null
          stripeCouponNameByUser[u.id] = hasDiscount ? couponName : null
        }
      })
    )
  }

  const siteCountByUser: Record<string, number> = {}
  const draftCountByUser: Record<string, number> = {}
  const customDomainByUser: Record<string, boolean> = {}
  const templatesByUser: Record<string, string[]> = {}
  for (const site of allSites) {
    if (site.status === 'published') {
      siteCountByUser[site.userId] = (siteCountByUser[site.userId] ?? 0) + 1
    } else {
      draftCountByUser[site.userId] = (draftCountByUser[site.userId] ?? 0) + 1
    }
    if (site.customDomain) customDomainByUser[site.userId] = true
    if (site.templateTitle) (templatesByUser[site.userId] ??= []).push(site.templateTitle)
  }
  const lastActiveByUser = new Map(lastActiveRows.map(r => [r.userId, r.lastActiveAt]))

  const rows: UserRow[] = allUsers.map(u => ({
    id: u.id,
    email: u.email,
    username: u.username,
    plan: u.plan,
    billingInterval: u.billingInterval as BillingInterval,
    subscriptionStatus: u.subscriptionStatus,
    currentPeriodEnd: u.currentPeriodEnd,
    cancelAtPeriodEnd: cancelAtPeriodEndByUser[u.id] ?? false,
    pendingPlan: u.pendingPlan,
    pendingPlanAt: u.pendingPlanAt,
    createdAt: u.createdAt,
    siteCount: siteCountByUser[u.id] ?? 0,
    draftCount: draftCountByUser[u.id] ?? 0,
    templateTitles: templatesByUser[u.id] ?? [],
    hasCustomDomain: customDomainByUser[u.id] ?? false,
    lastActiveAt: lastActiveByUser.get(u.id) ?? null,
    referredBy: u.referredByUsername,
    hasTeamPartnerNumber: !!u.teamPartnerNumber?.trim(),
    // Catalog monthly price — what this plan costs without discounts (direct from Stripe)
    planPriceCents: stripePlanPriceByUser[u.id] ?? 0,
    // Effective monthly charge after active permanent discounts (0 for 100% forever coupons)
    billedPriceCents: stripeBilledPriceByUser[u.id] ?? stripePlanPriceByUser[u.id] ?? 0,
    // Total cash received from this customer across all time (direct from Stripe invoices)
    totalRevenueCents: stripeRevenueByUser[u.id] ?? 0,
    // Human-readable promo code string (e.g. "ADMIN100") and coupon label (e.g. "Admin 100% Rabatt")
    activePromoCode: stripePromoByUser[u.id] ?? null,
    activeCouponName: stripeCouponNameByUser[u.id] ?? null,
    emailVerified: u.emailVerified,
    deletionScheduledFor: u.deletionScheduledFor,
    deletedAt: u.deletedAt,
    app: appUsageByUser.get(u.id) ?? NO_APP_USAGE,
  }))

  return (
    <div style={{ maxWidth: 1200 }}>
      <div className="mb-5 sm:mb-6">
        <h1 className="text-[22px] sm:text-2xl font-semibold text-gray-900 tracking-tight">Nutzer</h1>
        <p className="text-[13px] sm:text-sm mt-1" style={{ color: '#94A3B8' }}>
          Tarif, Status und Umsatz auf einen Blick · Alle Zahlen direkt aus Stripe
        </p>
      </div>

      <AdminUsersTable users={rows} />
    </div>
  )
}
