import { redirect } from 'next/navigation'
import type Stripe from 'stripe'
import { getServerUser } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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

  const user = await getServerUser()
  if (!user) redirect('/login')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  })

  // Real active subscription: status is valid AND a Stripe subscription ID exists
  const hasRealSubscription =
    !!profile?.subscriptionStatus &&
    ACTIVE_STATUSES.includes(profile.subscriptionStatus) &&
    !!profile?.stripeSubscriptionId

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
        await db.update(users)
          .set({
            plan,
            billingInterval: interval,
            subscriptionStatus: sub.status,
            stripeSubscriptionId: sub.id,
          })
          .where(eq(users.id, user.id))

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
