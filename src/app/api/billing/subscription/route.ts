import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { getStripe } from '@/lib/stripe/client'

function getSubInfo(sub: Stripe.Subscription, plan: string, billingInterval: string | null) {
  // In Stripe v22+, current_period_end is per subscription item
  const item = sub.items?.data?.[0]
  const currentPeriodEnd = (item as any)?.current_period_end ?? null

  // Discount on the subscription (e.g. ADMIN100 promo code)
  // Stripe API v22+: discounts is an array; first entry is the active discount
  const firstDiscount = (sub as any).discounts?.[0] ?? (sub as any).discount ?? null
  const coupon = firstDiscount?.coupon ?? null
  const discountPercent: number | null = coupon?.percent_off ?? null
  const discountName: string | null = coupon?.name ?? coupon?.id ?? null

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
      return NextResponse.json({ subscription: getSubInfo(allSubs.data[0], profile.plan, profile.billingInterval) })
    }

    return NextResponse.json({
      subscription: getSubInfo(subscriptions.data[0], profile.plan, profile.billingInterval)
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
