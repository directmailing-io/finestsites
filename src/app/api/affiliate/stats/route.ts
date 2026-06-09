import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'

// GET /api/affiliate/stats — returns the current user's affiliate stats + referred users
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('username, stripe_connect_id, affiliate_onboarded')
    .eq('id', user.id)
    .single()

  const [
    { data: commissions },
    { data: payouts },
    { data: referredUsers },
  ] = await Promise.all([
    admin.from('affiliate_commissions').select('*').eq('referrer_id', user.id).order('created_at', { ascending: false }),
    admin.from('affiliate_payouts').select('*').eq('referrer_id', user.id).order('created_at', { ascending: false }),
    admin.from('users')
      .select('id, email, username, plan, billing_interval, subscription_status, created_at')
      .eq('referred_by_username', profile?.username ?? '')
      .order('created_at', { ascending: false }),
  ])

  const pending = commissions?.filter(c => c.status === 'pending' || c.status === 'available') ?? []
  const paid = commissions?.filter(c => c.status === 'paid') ?? []
  const totalPending = pending.reduce((s, c) => s + c.commission_amount, 0)
  const totalPaid = paid.reduce((s, c) => s + c.commission_amount, 0)

  // Fetch bank account last4 + platform balance from Stripe
  let bank_last4: string | null = null
  let bank_name: string | null = null
  let stripe_balance_available_cents = 0

  if (profile?.stripe_connect_id && profile?.affiliate_onboarded) {
    const stripe = getStripe()
    await Promise.all([
      // Bank account details
      stripe.accounts.listExternalAccounts(profile.stripe_connect_id, { object: 'bank_account', limit: 1 })
        .then(accounts => {
          const bank = accounts.data[0] as any
          if (bank) { bank_last4 = bank.last4 ?? null; bank_name = bank.bank_name ?? null }
        })
        .catch(() => {}),
      // Platform balance (EUR available for transfers)
      stripe.balance.retrieve()
        .then(balance => {
          const eur = balance.available.find(b => b.currency === 'eur')
          stripe_balance_available_cents = eur?.amount ?? 0
        })
        .catch(() => {}),
    ])
  }

  return NextResponse.json({
    username: profile?.username ?? null,
    stripe_connect_id: profile?.stripe_connect_id ?? null,
    affiliate_onboarded: profile?.affiliate_onboarded ?? false,
    bank_last4,
    bank_name,
    stripe_balance_available_cents,
    referral_count: referredUsers?.length ?? 0,
    total_pending_cents: totalPending,
    total_paid_cents: totalPaid,
    commissions: commissions ?? [],
    payouts: payouts ?? [],
    referred_users: referredUsers ?? [],
  })
}
