import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { db } from '@/lib/db'
import { users, affiliateCommissions } from '@/lib/db/schema'
import { eq, isNotNull } from 'drizzle-orm'
import { getRealUserFromRequest } from '@/lib/auth/server'

async function checkAdmin(req: Request) {
  const user = await getRealUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  return profile?.isAdmin ? user : null
}

function getPeriodRange(period: string): { gte?: number; lte?: number } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (period) {
    case 'this_month':
      return { gte: Math.floor(new Date(y, m, 1).getTime() / 1000), lte: Math.floor(new Date(y, m + 1, 0, 23, 59, 59).getTime() / 1000) }
    case 'last_month':
      return { gte: Math.floor(new Date(y, m - 1, 1).getTime() / 1000), lte: Math.floor(new Date(y, m, 0, 23, 59, 59).getTime() / 1000) }
    case 'last_3_months':
      return { gte: Math.floor(new Date(y, m - 2, 1).getTime() / 1000) }
    case 'last_year':
      return { gte: Math.floor(new Date(y - 1, 0, 1).getTime() / 1000) }
    default:
      return {}
  }
}

export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const period = sp.get('period') ?? 'this_month'

  const stripe = getStripe()
  const { gte, lte } = getPeriodRange(period)

  // ── Parallel fetches ─────────────────────────────────────────────────────────────────────────
  // Note: We fetch charges separately (not via invoice expand) because invoice.charge is often
  // null in newer Stripe API versions (PaymentIntent-based flow). Charges have an `invoice` field
  // for reliable matching, and their balance_transaction is straightforward to expand at 1 level.
  const dateFilter = gte || lte ? { created: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } } : {}
  const [invoicesList, chargesList, subscriptionsList, allDbUsers, allCommissions] = await Promise.all([
    stripe.invoices.list({
      limit: 100,
      expand: [
        'data.payment_intent',
        'data.subscription',
        'data.discount.promotion_code',
      ],
      ...dateFilter,
    }),
    stripe.charges.list({
      limit: 100,
      expand: ['data.balance_transaction'],
      ...dateFilter,
    }),
    stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      expand: ['data.customer', 'data.discount.promotion_code', 'data.items.data.price'],
    }),
    db.select({
      id: users.id,
      username: users.username,
      plan: users.plan,
      billingInterval: users.billingInterval,
      stripeCustomerId: users.stripeCustomerId,
      referredByUsername: users.referredByUsername,
    }).from(users).where(isNotNull(users.stripeCustomerId)),
    db.select({
      stripeInvoiceId: affiliateCommissions.stripeInvoiceId,
      commissionAmount: affiliateCommissions.commissionAmount,
      status: affiliateCommissions.status,
      referrerId: affiliateCommissions.referrerId,
    }).from(affiliateCommissions),
  ])

  // ── Charge lookup: match charges → invoices via charge.invoice ───────────────────────────────
  // Each Stripe Charge has an `invoice` field (invoice ID string). This is the reliable way to
  // find the fee and payment method for an invoice regardless of API version.
  const chargeByInvoiceId = new Map<string, Stripe.Charge>()
  for (const charge of chargesList.data) {
    const rawInv = (charge as any).invoice
    const invId = typeof rawInv === 'string' ? rawInv : rawInv?.id
    if (invId) chargeByInvoiceId.set(invId, charge)
  }

  // ── Lookup maps ──────────────────────────────────────────────────────────────────────────────
  const userByCustomerId = new Map<string, typeof allDbUsers[0]>()
  for (const u of allDbUsers) {
    if (u.stripeCustomerId) userByCustomerId.set(u.stripeCustomerId, u)
  }

  // Only count non-reversed commissions (reversed = coupon override or cancellation)
  const commissionByInvoiceId = new Map<string, { amount: number; referrerId: string }>()
  for (const c of allCommissions) {
    if (c.stripeInvoiceId && c.status !== 'reversed') {
      commissionByInvoiceId.set(c.stripeInvoiceId, { amount: c.commissionAmount, referrerId: c.referrerId })
    }
  }

  // Resolve referrer usernames (for commission partner display)
  const referrerIdSet = new Set([...commissionByInvoiceId.values()].map(c => c.referrerId))
  const allReferrers = referrerIdSet.size > 0
    ? await db.select({ id: users.id, username: users.username }).from(users)
    : []
  const referrerUsernameById = new Map<string, string>()
  for (const r of allReferrers) referrerUsernameById.set(r.id, r.username ?? '')

  // ── Process invoices → transactions ─────────────────────────────────────────────────────────
  const transactions = invoicesList.data
    .filter(inv => inv.status !== 'draft')
    .map(inv => {
      const inv_ = inv as any
      // Charge from separate charges.list (matched via charge.invoice ID)
      const charge = chargeByInvoiceId.get(inv.id) || null
      const paymentIntent = inv_.payment_intent as Stripe.PaymentIntent | null
      const discount = inv_.discount as Stripe.Discount | null
      const sub = inv_.subscription as Stripe.Subscription | null

      // ── Status ──────────────────────────────────────────────────────────
      let status: 'paid' | 'pending' | 'failed' | 'void' | 'uncollectible'
      if (inv.status === 'paid') status = 'paid'
      else if (inv.status === 'void') status = 'void'
      else if (inv.status === 'uncollectible') status = 'uncollectible'
      else {
        // 'open' — distinguish between failed payment attempt and awaiting debit
        const piStatus = paymentIntent?.status
        status = (piStatus === 'requires_payment_method' || piStatus === 'canceled') ? 'failed' : 'pending'
      }

      // ── User ────────────────────────────────────────────────────────────
      const customerId = typeof inv.customer === 'string' ? inv.customer : (inv.customer as any)?.id ?? ''
      const userInfo = userByCustomerId.get(customerId)

      // ── Amounts ─────────────────────────────────────────────────────────
      // grossCents: actual money collected (or expected for open invoices)
      const grossCents = status === 'paid' ? (inv.amount_paid || 0) : (inv.amount_due || 0)

      // taxCents: MwSt — Stripe only populates invoice.tax when Tax Rates are configured in Stripe.
      // Since we don't use Stripe Tax, we calculate it from gross: German 19% VAT inclusive formula.
      // (Don't try to read from Stripe — it will always be 0 without Tax Rate configuration.)
      const taxCents = grossCents > 0 ? Math.round(grossCents * 19 / 119) : 0

      // stripFeeCents: from balance_transaction on the matched charge (expanded at fetch time).
      // For SEPA not yet settled: balance_transaction is null → fee correctly 0 until settled.
      const balanceTx = charge?.balance_transaction as Stripe.BalanceTransaction | null
      const stripFeeCents = balanceTx?.fee || 0
      // affiliate commission
      const commission = commissionByInvoiceId.get(inv.id)
      const affiliateCommissionCents = commission?.amount || 0
      const affiliatePartnerUsername = commission
        ? (referrerUsernameById.get(commission.referrerId) || userInfo?.referredByUsername || null)
        : null
      // net = gross - MwSt - stripe fee - affiliate commission
      const netCents = grossCents - taxCents - stripFeeCents - affiliateCommissionCents

      // ── Discount/Coupon ─────────────────────────────────────────────────
      let couponCode: string | null = null
      let couponLabel: string | null = null
      if (discount) {
        const coupon = (discount as any).coupon as Stripe.Coupon | undefined
        const promoCode = (discount as any).promotion_code as Stripe.PromotionCode | null
        couponCode = promoCode?.code || coupon?.name || null
        if (coupon?.percent_off) couponLabel = `−${coupon.percent_off}%`
        else if (coupon?.amount_off) couponLabel = `−${(coupon.amount_off / 100).toFixed(2)} €`
      }

      // ── Payment method ──────────────────────────────────────────────────
      // payment_method_details lives on the Charge object (from chargeByInvoiceId map).
      // Fallback: read payment_method_types from payment_intent (no last4, but gives type).
      let paymentMethod: 'card' | 'sepa_debit' | null = null
      let paymentMethodLast4: string | null = null
      const pmd = charge?.payment_method_details as any
      if (pmd?.type === 'card') { paymentMethod = 'card'; paymentMethodLast4 = pmd.card?.last4 || null }
      else if (pmd?.type === 'sepa_debit') { paymentMethod = 'sepa_debit'; paymentMethodLast4 = pmd.sepa_debit?.last4 || null }
      else {
        // Fallback: payment_intent.payment_method_types when charge pmd is unavailable
        const pmType = paymentIntent?.payment_method_types?.[0]
        if (pmType === 'card') paymentMethod = 'card'
        else if (pmType === 'sepa_debit') paymentMethod = 'sepa_debit'
      }

      // ── Plan info ───────────────────────────────────────────────────────
      const plan = sub?.metadata?.plan || userInfo?.plan || ''
      const billingInterval = (sub?.metadata?.interval || userInfo?.billingInterval || 'monthly') as 'monthly' | 'yearly'

      return {
        id: inv.id,
        date: inv.created,
        username: userInfo?.username || null,
        email: inv.customer_email || '',
        plan,
        billingInterval,
        grossCents,
        taxCents,
        stripFeeCents,
        affiliateCommissionCents,
        affiliatePartnerUsername,
        netCents,
        couponCode,
        couponLabel,
        paymentMethod,
        paymentMethodLast4,
        status,
        stripeInvoiceUrl: inv.hosted_invoice_url || null,
      }
    })

  // ── Planned payments (active subscriptions, not canceling at period end) ─────────────────────
  const plannedPayments = subscriptionsList.data
    .filter(sub => !sub.cancel_at_period_end)
    .map(sub => {
      const sub_ = sub as any
      const customer = sub_.customer as Stripe.Customer | null
      const customerId = typeof sub.customer === 'string' ? sub.customer : customer?.id ?? ''
      const userInfo = userByCustomerId.get(customerId)

      const priceItem = sub.items.data[0]
      const price = priceItem?.price as Stripe.Price | undefined
      const unitAmount = price?.unit_amount || 0
      const interval = price?.recurring?.interval === 'year' ? 'yearly' : 'monthly'

      const discount = sub_.discount as Stripe.Discount | null
      const coupon = (discount as any)?.coupon as Stripe.Coupon | undefined
      const percentOff = coupon?.percent_off || 0
      const promoCode = (discount as any)?.promotion_code as Stripe.PromotionCode | null

      // Expected gross after coupon discount
      const expectedGrossCents = Math.round(unitAmount * (1 - percentOff / 100))
      const affiliatePartner = userInfo?.referredByUsername || null
      const estimatedAffiliateCents = affiliatePartner ? Math.floor(expectedGrossCents * 0.10) : 0
      // MwSt (19% inclusive): tax = gross * 19/119
      const estimatedTaxCents = Math.round(expectedGrossCents * 19 / 119)

      return {
        subscriptionId: sub.id,
        username: userInfo?.username || null,
        email: customer?.email || '',
        plan: sub.metadata?.plan || userInfo?.plan || '',
        billingInterval: interval as 'monthly' | 'yearly',
        // Stripe API 2025+: current_period_end moved from sub root → sub.items.data[0]
        nextPaymentDate: ((sub.items.data[0] as any)?.current_period_end ?? (sub as any).current_period_end ?? null) as number | null,
        expectedGrossCents,
        estimatedTaxCents,
        couponCode: promoCode?.code || coupon?.name || null,
        couponLabel: percentOff ? `−${percentOff}%` : null,
        affiliatePartner,
        estimatedAffiliateCents,
      }
    })

  return NextResponse.json({ transactions, planned: plannedPayments })
}
