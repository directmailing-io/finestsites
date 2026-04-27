/**
 * GET /api/affiliate/dashboard-link
 * Generates a Stripe Express Login Link for the authenticated affiliate.
 * Returns a one-time URL that logs the partner directly into their Stripe Express dashboard.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('stripe_connect_id, affiliate_onboarded')
    .eq('id', user.id)
    .single()

  if (!profile?.affiliate_onboarded || !profile?.stripe_connect_id) {
    return NextResponse.json({ error: 'Kein Stripe-Konto verbunden.' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const loginLink = await stripe.accounts.createLoginLink(profile.stripe_connect_id)
    return NextResponse.json({ url: loginLink.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('[affiliate/dashboard-link] error:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
