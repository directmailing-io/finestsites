import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { getStripe, getPlanByPriceId } from '@/lib/stripe/client'
import { sendEmail } from '@/lib/resend'
import { subscriptionConfirmationEmail } from '@/lib/email/templates'

// Stripe success-URL handler.
// Called server-side (redirect) — no race conditions, no client-side JS needed.
// 1. Verifies the Stripe session
// 2. Updates the DB + logs subscription_events
// 3. Redirects to /dashboard (middleware then handles username check)
export async function GET(req: NextRequest) {
  // Always use the canonical app URL for redirects.
  // req.url reflects the internal VPS address (http://0.0.0.0:3002/...) through the
  // CF Worker → Caddy proxy chain, which would send users to the wrong host.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')

  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.redirect(`${appUrl}/onboarding/plan`)
  }

  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`)
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (session.status !== 'complete' || !session.subscription) {
      console.error('[billing/activate] session not complete:', session.status, sessionId)
      return NextResponse.redirect(`${appUrl}/onboarding/plan`)
    }

    // Guard: session must belong to this user
    const sessionUserId = session.metadata?.supabase_user_id ?? session.metadata?.user_id
    if (sessionUserId && sessionUserId !== user.id) {
      console.error('[billing/activate] user mismatch', sessionUserId, user.id)
      return NextResponse.redirect(`${appUrl}/onboarding/plan`)
    }

    const sub = session.subscription as Stripe.Subscription
    const priceId = sub.items.data[0]?.price.id ?? ''
    const plan = getPlanByPriceId()[priceId] ?? 'starter'
    const interval =
      sub.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'

    // In Stripe API 2025+, current_period_end moved to SubscriptionItem
    const itemTs = (sub.items.data[0] as any)?.current_period_end
    const rootTs = (sub as any).current_period_end
    const ts = itemTs ?? rootTs
    const currentPeriodEnd = ts ? new Date(ts * 1000) : null

    try {
      await db.update(users).set({
        plan,
        billingInterval: interval,
        subscriptionStatus: sub.status,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd,
        paymentFailedAt: null,
        deactivatedAt: null,
      }).where(eq(users.id, user.id))
    } catch (dbErr) {
      console.error('[billing/activate] DB update error:', dbErr instanceof Error ? dbErr.message : dbErr)
    }

    // Note: subscription_created event is logged by the Stripe webhook (checkout.session.completed)
    // Do NOT log it here to avoid double-counting in financial reports.

    // Send confirmation email (fire-and-forget, don't block redirect)
    const emailAddress = user.email
    if (emailAddress) {
      sendEmail({ to: emailAddress, subject: `Buchung bestätigt – ${plan.charAt(0).toUpperCase() + plan.slice(1)}-Plan · FinestSites`, html: subscriptionConfirmationEmail({ plan, interval }), type: 'subscription_confirmation' }).catch(() => {})
    }

    // Redirect to home, or back to the editor if site_id was passed (publish-gate flow).
    // Middleware will redirect to /onboarding/username if username is not yet set.
    const siteId = req.nextUrl.searchParams.get('site_id')
    const redirectTarget = siteId
      ? `${appUrl}/sites/${siteId}/edit?just_paid=1`
      : `${appUrl}/sites`
    return NextResponse.redirect(redirectTarget)
  } catch (err) {
    console.error('[billing/activate] error:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(`${appUrl}/onboarding/plan`)
  }
}
