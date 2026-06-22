import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

// GET /api/affiliate/connect/return — Stripe redirects here after onboarding
export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get('account')
  const userId = req.nextUrl.searchParams.get('user')

  if (!accountId || !userId) {
    return NextResponse.redirect(new URL('/affiliate?connect=error', req.url))
  }

  // Verify account is fully onboarded
  const stripe = getStripe()
  const account = await stripe.accounts.retrieve(accountId)
  const onboarded = account.details_submitted && !account.requirements?.currently_due?.length

  await db.update(users)
    .set({ stripeConnectId: accountId, affiliateOnboarded: onboarded })
    .where(eq(users.id, userId))

  const status = onboarded ? 'success' : 'pending'
  return NextResponse.redirect(new URL(`/affiliate?connect=${status}`, req.url))
}
