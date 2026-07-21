import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { getStripe } from '@/lib/stripe/client'

function getSubInfo(sub: Stripe.Subscription, plan: string, billingInterval: string | null, couponObj?: { percent_off?: number | null; name?: string | null; id?: string } | null) {
  // In Stripe v22+, current_period_end is per subscription item
  const item = sub.items?.data?.[0]
  const currentPeriodEnd = (item as any)?.current_period_end ?? null

  const discountPercent: number | null = couponObj?.percent_off ?? null
  const discountName: string | null = couponObj?.name ?? couponObj?.id ?? null

  return {
    status: sub.status,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: sub.cancel_at_period_end,
    cancel_at: sub.cancel_at,
    plan,
    billing_interval: billingInterval,
    discount_percent: discountPercent,
    discount_name: discountName,
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeCustomerId: true, plan: true, billingInterval: true, subscriptionStatus: true },
  })

  if (!profile?.stripeCustomerId) {
    return NextResponse.json({ subscription: null })
  }

  try {
    const stripe = getStripe()

    async function resolveCoupon(sub: Stripe.Subscription) {
      // Stripe v22+: discount coupon lives in discounts[0].source.coupon (string ID)
      // Older API: discounts[0].coupon (object) or discount.coupon (object)
      const disc = (sub as any).discounts?.[0] ?? (sub as any).discount ?? null
      if (!disc) return null
      // source.coupon is a string ID in v22+
      const raw = disc?.source?.coupon ?? disc?.coupon ?? null
      if (!raw) return null
      if (typeof raw === 'object') return raw
      // raw is a coupon ID string — fetch the full coupon object
      try { return await stripe.coupons.retrieve(raw as string) } catch { return null }
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripeCustomerId,
      status: 'active',
      limit: 1,
      expand: ['data.items', 'data.discounts'],
    })

    if (!subscriptions.data.length) {
      const allSubs = await stripe.subscriptions.list({
        customer: profile.stripeCustomerId,
        limit: 1,
        expand: ['data.items', 'data.discounts'],
      })
      if (!allSubs.data.length) return NextResponse.json({ subscription: null })
      const coupon = await resolveCoupon(allSubs.data[0])
      return NextResponse.json({ subscription: getSubInfo(allSubs.data[0], profile.plan, profile.billingInterval, coupon) })
    }

    const sub0 = subscriptions.data[0]
    const coupon = await resolveCoupon(sub0)
    return NextResponse.json({
      subscription: getSubInfo(sub0, profile.plan, profile.billingInterval, coupon)
    })
  } catch {
    return NextResponse.json({ subscription: null })
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeCustomerId: true },
  })

  if (!profile?.stripeCustomerId) {
    return NextResponse.json({ error: 'Kein aktives Abonnement.' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripeCustomerId,
      status: 'active',
      limit: 1,
      expand: ['data.items'],
    })

    if (!subscriptions.data.length) {
      return NextResponse.json({ error: 'Kein aktives Abonnement gefunden.' }, { status: 400 })
    }

    const sub = subscriptions.data[0]
    if (!sub.cancel_at_period_end) {
      return NextResponse.json({ error: 'Abonnement ist nicht gekündigt.' }, { status: 400 })
    }

    const updated = await stripe.subscriptions.update(sub.id, {
      cancel_at_period_end: false,
    })

    const item = (updated as any).items?.data?.[0]
    return NextResponse.json({
      cancel_at_period_end: updated.cancel_at_period_end,
      current_period_end: item?.current_period_end ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeCustomerId: true },
  })

  if (!profile?.stripeCustomerId) {
    return NextResponse.json({ error: 'Kein aktives Abonnement.' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripeCustomerId,
      status: 'active',
      limit: 1,
      expand: ['data.items'],
    })

    if (!subscriptions.data.length) {
      return NextResponse.json({ error: 'Kein aktives Abonnement gefunden.' }, { status: 400 })
    }

    const sub = subscriptions.data[0]
    const updated = await stripe.subscriptions.update(sub.id, {
      cancel_at_period_end: true,
    })

    const item = (updated as any).items?.data?.[0]
    return NextResponse.json({
      cancel_at_period_end: updated.cancel_at_period_end,
      current_period_end: item?.current_period_end ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
