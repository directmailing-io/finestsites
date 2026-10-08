import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'
import { getUserFromRequest } from '@/lib/auth/server'

// GET /api/affiliate/connect/return — Stripe redirects here after onboarding.
// Nur der eingeloggte Nutzer selbst, und nur ein Connect-Konto, das beim Anlegen
// mit seiner user_id markiert wurde – sonst könnte jemand fremde Auszahlungen
// auf sein eigenes Stripe-Konto umbiegen.
export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')
  const accountId = req.nextUrl.searchParams.get('account')
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.redirect(`${appUrl}/login?next=/affiliate`)

  if (!accountId || !/^acct_[A-Za-z0-9]+$/.test(accountId)) {
    return NextResponse.redirect(`${appUrl}/affiliate?connect=error`)
  }

  // Verify account is fully onboarded and belongs to this user
  const stripe = getStripe()
  const account = await stripe.accounts.retrieve(accountId)
  if (account.metadata?.user_id !== user.id) {
    return NextResponse.redirect(`${appUrl}/affiliate?connect=error`)
  }
  const onboarded = account.details_submitted && !account.requirements?.currently_due?.length

  await db.update(users)
    .set({ stripeConnectId: accountId, affiliateOnboarded: onboarded })
    .where(eq(users.id, user.id))

  const status = onboarded ? 'success' : 'pending'
  return NextResponse.redirect(`${appUrl}/affiliate?connect=${status}`)
}
