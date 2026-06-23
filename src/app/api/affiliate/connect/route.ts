import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')

// POST /api/affiliate/connect — creates or resumes Stripe Connect Express onboarding
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeConnectId: true, email: true, username: true, firstName: true, lastName: true },
  })

  const stripe = getStripe()
  const origin = req.headers.get('origin') ?? APP_URL

  let accountId = profile?.stripeConnectId

  try {
    // Create a new Connect Express account if none exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'DE',
        email: profile?.email ?? user.email ?? '',
        business_type: 'individual',
        capabilities: {
          transfers: { requested: true },
        },
        // Pre-fill name so Stripe shows it as already entered
        individual: {
          email: profile?.email ?? user.email ?? '',
          ...(profile?.firstName ? { first_name: profile.firstName } : {}),
          ...(profile?.lastName  ? { last_name:  profile.lastName  } : {}),
        },
        // Monthly payouts on the 1st of each month
        settings: {
          payouts: {
            schedule: { interval: 'monthly', monthly_anchor: 1 },
          },
        },
        metadata: {
          user_id: user.id,
          username: profile?.username ?? '',
        },
      })
      accountId = account.id
      await db.update(users)
        .set({ stripeConnectId: accountId })
        .where(eq(users.id, user.id))
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/affiliate?connect=refresh`,
      return_url: `${origin}/api/affiliate/connect/return?account=${accountId}&user=${user.id}`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err: any) {
    const rawMessage: string = err?.message ?? 'Unbekannter Fehler'
    const isConnectNotEnabled = rawMessage.includes('signed up for Connect')

    return NextResponse.json(
      {
        error: isConnectNotEnabled
          ? 'Stripe Connect ist auf diesem Konto nicht aktiviert. Bitte gehe zu dashboard.stripe.com/connect und aktiviere es zuerst.'
          : rawMessage,
        connect_not_enabled: isConnectNotEnabled,
      },
      { status: 400 }
    )
  }
}
