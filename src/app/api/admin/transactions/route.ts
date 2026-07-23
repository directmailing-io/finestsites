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
        // Stripe 2025: discount → discounts (array), subscription → parent.subscription_details
        'data.discounts.promotion_code',
        'data.discounts.coupon',
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
      // Stripe 2025: discount → discounts (array); expand promotion_code for display
      expand: ['data.customer', 'data.discounts.promotion_code', 'data.items.data.price'],
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

  // ── Charge matching: Stripe 2025 API removed invoice/payment_intent cross-refs ──────────────
  // invoice.charge, invoice.payment_intent, charge.invoice, pi.invoice are all gone.
  // We match charges to invoices by: customer ID + amount + closest timestamp.
  const chargesByCustomer = new Map<string, Stripe.Charge[]>()
  for (const c of chargesList.data) {
    const custId = typeof c.customer === 'string' ? c.customer : (c.customer as any)?.id
    if (!custId) continue
    if (!chargesByCustomer.has(custId)) chargesByCustomer.set(custId, [])
    chargesByCustomer.get(custId)!.push(c)
  }

  function findChargeForInvoice(inv: Stripe.Invoice): Stripe.Charge | null {
    const custId = typeof inv.customer === 'string' ? inv.customer : (inv.customer as any)?.id
    if (!custId) return null
    const invAmount = (inv as any).amount_paid || (inv as any).amount_due || 0
    if (invAmount === 0) return null
    const candidates = (chargesByCustomer.get(custId) || []).filter(c => c.amount === invAmount)
    if (candidates.length === 0) return null
    // Tie-break by closest creation timestamp (charges are created at invoice payment time)
    return candidates.reduce((best, c) =>
      Math.abs(c.created - inv.created) < Math.abs(best.created - inv.created) ? c : best
    )
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
      // Charge matched by customer + amount + timestamp (Stripe 2025: no cross-ref IDs)
      const charge = findChargeForInvoice(inv)
      // Stripe 2025: invoice.discount → invoice.discounts (array); invoice.subscription → parent
      const discountArr = (inv_.discounts as any[] | null) ?? null
      const discount = discountArr?.[0] ?? null
      const parentSub = inv_.parent?.subscription_details?.subscription as string | null

      // ── Status ──────────────────────────────────────────────────────────
      let status: 'paid' | 'pending' | 'failed' | 'void' | 'uncollectible'
      if (inv.status === 'paid') status = 'paid'
      else if (inv.status === 'void') status = 'void'
      else if (inv.status === 'uncollectible') status = 'uncollectible'
      else {
        // 'open' — use matched charge status (SEPA = pending, failed card = failed)
        status = charge?.status === 'failed' ? 'failed' : 'pending'
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
      // Stripe 2025: discounts is an array; each element may have coupon/promotion_code
      let couponCode: string | null = null
      let couponLabel: string | null = null
      if (discount) {
        const coupon = discount.coupon as Stripe.Coupon | undefined
        const promoCode = discount.promotion_code as Stripe.PromotionCode | null
        couponCode = (typeof promoCode === 'object' ? promoCode?.code : null)
          || (typeof coupon === 'object' ? (coupon?.name || null) : null)
        if (coupon && typeof coupon === 'object' && coupon.percent_off) couponLabel = `−${coupon.percent_off}%`
        else if (coupon && typeof coupon === 'object' && coupon.amount_off) couponLabel = `−${(coupon.amount_off / 100).toFixed(2)} €`
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
        // Fallback: infer type from charge payment_method field (exists even without pmd)
        const pmType = (charge as any)?.payment_method_types?.[0]
        if (pmType === 'card') paymentMethod = 'card'
        else if (pmType === 'sepa_debit') paymentMethod = 'sepa_debit'
      }

      // ── Plan info ───────────────────────────────────────────────────────
      // Stripe 2025: invoice.subscription moved to invoice.parent.subscription_details.subscription
      // We fall back to DB userInfo which always has current plan/interval
      const plan = userInfo?.plan || ''
      const billingInterval = (userInfo?.billingInterval || 'monthly') as 'monthly' | 'yearly'

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

  // ── Coupon lookup for planned payments ──────────────────────────────────────────────────────
  // Stripe 2025: sub.discount → undefined; coupons live in sub.discounts[0].source.coupon (string ID).
  // percent_off is not inlined — fetch coupon objects separately.
  const subCouponIdSet = new Set<string>()
  for (const sub of subscriptionsList.data) {
    const discArr = (sub as any).discounts as any[] | null
    const couponId = discArr?.[0]?.source?.coupon
    if (couponId && typeof couponId === 'string') subCouponIdSet.add(couponId)
  }
  const subCouponById = new Map<string, { percentOff: number; name: string | null }>()
  await Promise.all([...subCouponIdSet].map(async id => {
    try {
      const c = await stripe.coupons.retrieve(id)
      subCouponById.set(id, { percentOff: c.percent_off || 0, name: c.name || null })
    } catch {}
  }))

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

      // Stripe 2025: discounts[] array; coupon ID in discounts[0].source.coupon
      const discountsArr = sub_.discounts as any[] | null
      const firstDiscount = discountsArr?.[0] ?? null
      const couponId = firstDiscount?.source?.coupon
      const couponInfo = couponId ? subCouponById.get(couponId) : null
      const percentOff = couponInfo?.percentOff || 0
      // promotion_code expanded in list call → has .code field
      const promoCode = firstDiscount?.promotion_code as Stripe.PromotionCode | null

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
        couponCode: (typeof promoCode === 'object' ? promoCode?.code : null) || couponInfo?.name || null,
        couponLabel: percentOff ? `−${percentOff}%` : null,
        affiliatePartner,
        estimatedAffiliateCents,
      }
    })

  return NextResponse.json({ transactions, planned: plannedPayments })
}
