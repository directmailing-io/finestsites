import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PLAN_BY_PRICE: Record<string, string> = {
  [process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '']: 'starter',
  [process.env.STRIPE_PRICE_STARTER_YEARLY ?? '']: 'starter',
  [process.env.STRIPE_PRICE_PRO_MONTHLY ?? '']: 'pro',
  [process.env.STRIPE_PRICE_PRO_YEARLY ?? '']: 'pro',
  [process.env.STRIPE_PRICE_UNLIMITED_MONTHLY ?? '']: 'unlimited',
  [process.env.STRIPE_PRICE_UNLIMITED_YEARLY ?? '']: 'unlimited',
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  async function updateUserByCustomer(customerId: string, updates: Record<string, unknown>) {
    await admin.from('users').update(updates).eq('stripe_customer_id', customerId)
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      const priceId = subscription.items.data[0]?.price.id ?? ''
      const plan = PLAN_BY_PRICE[priceId] ?? 'starter'
      const interval = subscription.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'
      const userId = session.metadata?.supabase_user_id

      if (userId) {
        await admin.from('users').update({
          plan,
          billing_interval: interval,
          subscription_status: subscription.status,
          stripe_subscription_id: subscription.id,
        }).eq('id', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const priceId = sub.items.data[0]?.price.id ?? ''
      const plan = PLAN_BY_PRICE[priceId] ?? 'starter'
      const interval = sub.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'
      await updateUserByCustomer(sub.customer as string, {
        plan,
        billing_interval: interval,
        subscription_status: sub.status,
        stripe_subscription_id: sub.id,
      })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await updateUserByCustomer(sub.customer as string, {
        plan: 'starter',
        subscription_status: 'canceled',
        stripe_subscription_id: null,
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await updateUserByCustomer(invoice.customer as string, {
        subscription_status: 'past_due',
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}
