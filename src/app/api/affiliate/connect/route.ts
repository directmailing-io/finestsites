import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://finestsites.vercel.app'

// POST /api/affiliate/connect — creates or resumes Stripe Connect Express onboarding
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeConnectId: true, email: true, username: true },
  })

  const stripe = getStripe()
  const origin = req.headers.get('origin') ?? APP_URL

  let accountId = profile?.stripeConnectId

  try {
    // Create a new Connect Express account if none exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: profile?.email ?? user.email ?? '',
        capabilities: {
          transfers: { requested: true },
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
