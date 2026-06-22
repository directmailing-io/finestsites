/**
 * GET /api/affiliate/dashboard-link
 * Generates a Stripe Express Login Link for the authenticated affiliate.
 * Returns a one-time URL that logs the partner directly into their Stripe Express dashboard.
 */

import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeConnectId: true, affiliateOnboarded: true },
  })

  if (!profile?.affiliateOnboarded || !profile?.stripeConnectId) {
    return NextResponse.json({ error: 'Kein Stripe-Konto verbunden.' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const loginLink = await stripe.accounts.createLoginLink(profile.stripeConnectId)
    return NextResponse.json({ url: loginLink.url })
  } catch (err: unknown) {
    console.error('[affiliate/dashboard-link] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 400 })
  }
}
