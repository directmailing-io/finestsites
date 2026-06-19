import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'

function getSubInfo(sub: Stripe.Subscription, plan: string, billingInterval: string | null) {
  // In Stripe v22+, current_period_end is per subscription item
  const item = sub.items?.data?.[0]
  const currentPeriodEnd = (item as any)?.current_period_end ?? null

  return {
    status: sub.status,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: sub.cancel_at_period_end,
    cancel_at: sub.cancel_at,
    plan,
    billing_interval: billingInterval,
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('stripe_customer_id, plan, billing_interval, subscription_status')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ subscription: null })
  }

  try {
    const stripe = getStripe()
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'active',
      limit: 1,
      expand: ['data.items'],
    })

    if (!subscriptions.data.length) {
      const allSubs = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        limit: 1,
        expand: ['data.items'],
      })
      if (!allSubs.data.length) return NextResponse.json({ subscription: null })
      return NextResponse.json({ subscription: getSubInfo(allSubs.data[0], profile.plan, profile.billing_interval) })
    }

    return NextResponse.json({
      subscription: getSubInfo(subscriptions.data[0], profile.plan, profile.billing_interval)
    })
  } catch {
    return NextResponse.json({ subscription: null })
  }
}

export async function PATCH() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'Kein aktives Abonnement.' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
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

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'Kein aktives Abonnement.' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
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
