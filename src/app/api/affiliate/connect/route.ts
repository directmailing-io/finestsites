import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://finestsites.vercel.app'

// POST /api/affiliate/connect — creates or resumes Stripe Connect Express onboarding
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('stripe_connect_id, email, username')
    .eq('id', user.id)
    .single()

  const stripe = getStripe()
  const origin = req.headers.get('origin') ?? APP_URL

  let accountId = profile?.stripe_connect_id

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
          supabase_user_id: user.id,
          username: profile?.username ?? '',
        },
      })
      accountId = account.id
      await admin.from('users')
        .update({ stripe_connect_id: accountId })
        .eq('id', user.id)
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
