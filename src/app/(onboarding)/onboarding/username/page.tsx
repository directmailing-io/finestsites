import { redirect } from 'next/navigation'
import type Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, getPlanByPriceId } from '@/lib/stripe/client'
import { UsernameForm } from './UsernameForm'

// Statuses that represent a paid, active subscription
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

export default async function OnboardingUsernamePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id: sessionId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('subscription_status, stripe_subscription_id, username')
    .eq('id', user.id)
    .single()

  // Real active subscription: status is valid AND a Stripe subscription ID exists
  const hasRealSubscription =
    !!profile?.subscription_status &&
    ACTIVE_STATUSES.includes(profile.subscription_status) &&
    !!profile?.stripe_subscription_id

  if (hasRealSubscription) {
    // Subscription already recorded — go to dashboard if username is set, else collect it
    if (profile?.username) redirect('/sites')
    return <UsernameForm />
  }

  // ── Webhook timing fallback ─────────────────────────────────────────────
  // With the /api/billing/activate route, the DB is normally already updated
  // before the user reaches this page. This block is a safety net for edge
  // cases (direct URL navigation, webhook timing issues, etc.).
  let sessionVerified = false
  if (sessionId) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      })

      // For subscriptions, payment_status can be 'unpaid' for SEPA/mandate payments
      // that are still processing. We only need the session to be 'complete' and
      // a subscription to have been created — webhook will confirm payment later.
      if (session.status === 'complete' && session.subscription) {
        const sub = session.subscription as Stripe.Subscription
        const priceId = sub.items.data[0]?.price.id ?? ''
        const plan = getPlanByPriceId()[priceId] ?? 'starter'
        const interval =
          sub.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'

        // Update the DB — webhook will no-op when it arrives
        await admin.from('users').update({
          plan,
          billing_interval: interval,
          subscription_status: sub.status,
          stripe_subscription_id: sub.id,
        }).eq('id', user.id)

        sessionVerified = true
      }
    } catch {
      // Invalid session_id or Stripe error — fall through to payment wall
    }
  }

  // redirect() throws internally in Next.js — must be called OUTSIDE try/catch
  if (!hasRealSubscription && !sessionVerified) {
    redirect('/onboarding/plan')
  }

  // User has a verified subscription (either from DB or just confirmed above).
  // If they already have a username, send them straight to the dashboard.
  if (profile?.username) redirect('/sites')
  return <UsernameForm />
}
