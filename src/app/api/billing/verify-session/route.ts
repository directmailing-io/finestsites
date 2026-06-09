import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, getPlanByPriceId } from '@/lib/stripe/client'

// Called by client-side pages after a Stripe redirect when they have a session_id
// but the webhook may not have fired yet. Verifies the session directly with Stripe
// and updates the DB, so subsequent middleware checks pass.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (session.status !== 'complete' || !session.subscription) {
      return NextResponse.json({ ok: false, reason: 'session_incomplete' })
    }

    const sessionUserId = session.metadata?.supabase_user_id
    if (sessionUserId && sessionUserId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sub = session.subscription as Stripe.Subscription
    const priceId = sub.items.data[0]?.price.id ?? ''
    const plan = getPlanByPriceId()[priceId] ?? 'starter'
    const interval =
      sub.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'

    const admin = createAdminClient()
    await admin.from('users').update({
      plan,
      billing_interval: interval,
      subscription_status: sub.status,
      stripe_subscription_id: sub.id,
    }).eq('id', user.id)

    return NextResponse.json({ ok: true, plan, status: sub.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[billing/verify-session] error:', message)
    return NextResponse.json({ error: 'Stripe verification failed' }, { status: 500 })
  }
}
