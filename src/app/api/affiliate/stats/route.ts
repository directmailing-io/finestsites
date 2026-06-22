import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, affiliateCommissions, affiliatePayouts } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

// GET /api/affiliate/stats — returns the current user's affiliate stats + referred users
export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { username: true, stripeConnectId: true, affiliateOnboarded: true },
  })

  const [commissions, payouts, referredUsers] = await Promise.all([
    db.select().from(affiliateCommissions)
      .where(eq(affiliateCommissions.referrerId, user.id))
      .orderBy(desc(affiliateCommissions.createdAt)),
    db.select().from(affiliatePayouts)
      .where(eq(affiliatePayouts.referrerId, user.id))
      .orderBy(desc(affiliatePayouts.createdAt)),
    db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      plan: users.plan,
      billingInterval: users.billingInterval,
      subscriptionStatus: users.subscriptionStatus,
      createdAt: users.createdAt,
    })
      .from(users)
      .where(eq(users.referredByUsername, profile?.username ?? ''))
      .orderBy(desc(users.createdAt)),
  ])

  const pending = commissions.filter(c => c.status === 'pending' || c.status === 'available')
  const paid = commissions.filter(c => c.status === 'paid')
  const totalPending = pending.reduce((s, c) => s + c.commissionAmount, 0)
  const totalPaid = paid.reduce((s, c) => s + c.commissionAmount, 0)

  // Fetch bank account last4 + platform balance from Stripe
  let bank_last4: string | null = null
  let bank_name: string | null = null
  let stripe_balance_available_cents = 0

  if (profile?.stripeConnectId && profile?.affiliateOnboarded) {
    const stripe = getStripe()
    await Promise.all([
      // Bank account details
      stripe.accounts.listExternalAccounts(profile.stripeConnectId, { object: 'bank_account', limit: 1 })
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
    stripe_connect_id: profile?.stripeConnectId ?? null,
    affiliate_onboarded: profile?.affiliateOnboarded ?? false,
    bank_last4,
    bank_name,
    stripe_balance_available_cents,
    referral_count: referredUsers.length,
    total_pending_cents: totalPending,
    total_paid_cents: totalPaid,
    commissions,
    payouts,
    referred_users: referredUsers,
  })
}
