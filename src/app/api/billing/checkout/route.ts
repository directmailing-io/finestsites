import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICE_IDS: Record<string, Record<string, string>> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_STARTER_YEARLY!,
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY!,
  },
  unlimited: {
    monthly: process.env.STRIPE_PRICE_UNLIMITED_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_UNLIMITED_YEARLY!,
  },
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, interval = 'monthly' } = await req.json()
  const priceId = PRICE_IDS[plan]?.[interval]
  if (!priceId) return NextResponse.json({ error: 'Ungültiger Plan.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('stripe_customer_id, email').eq('id', user.id).single()

  let customerId = profile?.stripe_customer_id as string | undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? '',
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await admin.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const taxRateId = process.env.STRIPE_TAX_RATE_ID

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card', 'sepa_debit'],
    line_items: [{
      price: priceId,
      quantity: 1,
      ...(taxRateId ? { tax_rates: [taxRateId] } : {}),
    }],
    success_url: `${appUrl}/billing?success=1`,
    cancel_url: `${appUrl}/billing?canceled=1`,
    metadata: { supabase_user_id: user.id, plan, interval },
  })

  return NextResponse.json({ url: session.url })
}
