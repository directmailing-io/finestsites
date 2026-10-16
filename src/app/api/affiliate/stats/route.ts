import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, affiliateCommissions, affiliatePayouts } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'
import { syncConnectStatus } from '@/lib/affiliate/connect-status'
import { maskEmail } from '@/lib/affiliate/mask'
import { resolveReferralTerms } from '@/lib/affiliate/referral-model'
import { modelCStartFromEnv } from '@/lib/affiliate/referral-offer'

// GET /api/affiliate/stats — returns the current user's affiliate stats + referred users
export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { username: true, stripeConnectId: true, affiliateOnboarded: true, plan: true, affiliatePayoutMode: true, isAdmin: true },
  })

  if (!profile?.plan || profile.plan === 'free') {
    return NextResponse.json({ error: 'Nur für aktive Kunden.' }, { status: 403 })
  }

  // Each query is wrapped so a single failure doesn't crash the whole response.
  // The username (profile) is fetched first and is never affected by these.
  const [commissions, payouts, referredUsers] = await Promise.all([
    db.select().from(affiliateCommissions)
      .where(eq(affiliateCommissions.referrerId, user.id))
      .orderBy(desc(affiliateCommissions.createdAt))
      .catch(() => []),
    db.select().from(affiliatePayouts)
      .where(eq(affiliatePayouts.referrerId, user.id))
      .orderBy(desc(affiliatePayouts.createdAt))
      .catch(() => []),
    db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      username: users.username,
      plan: users.plan,
      billingInterval: users.billingInterval,
      subscriptionStatus: users.subscriptionStatus,
      createdAt: users.createdAt,
    })
      .from(users)
      .where(eq(users.referredByUsername, profile?.username ?? ''))
      .orderBy(desc(users.createdAt))
      .catch(() => []),
  ])

  const pending = commissions.filter(c => c.status === 'pending' || c.status === 'available')
  const paid = commissions.filter(c => c.status === 'paid')
  const totalPending = pending.reduce((s, c) => s + c.commissionAmount, 0)
  const totalPaid = paid.reduce((s, c) => s + c.commissionAmount, 0)

  // Onboarding-Status mit Stripe abgleichen: affiliate_onboarded wurde früher nur beim
  // Rücksprung aus dem Onboarding gesetzt und blieb danach für immer stehen (z. B. wenn
  // Stripe die Prüfung erst später abschließt oder das Konto später sperrt).
  let affiliateOnboarded = profile?.affiliateOnboarded ?? false
  if (profile?.stripeConnectId) {
    const synced = await syncConnectStatus(user.id, profile.stripeConnectId, { current: profile.affiliateOnboarded })
    if (synced !== null) affiliateOnboarded = synced
  }

  // Bankverbindung (nur letzte 4 Ziffern) des eigenen Connect-Kontos.
  // Das Plattform-Guthaben wird hier bewusst NICHT mehr ausgeliefert – das sind
  // Finanzdaten von FinestSites und gehen keinen Partner etwas an.
  let bank_last4: string | null = null
  let bank_name: string | null = null

  if (profile?.stripeConnectId && affiliateOnboarded) {
    await getStripe().accounts.listExternalAccounts(profile.stripeConnectId, { object: 'bank_account', limit: 1 })
      .then(accounts => {
        const bank = accounts.data[0] as any
        if (bank) { bank_last4 = bank.last4 ?? null; bank_name = bank.bank_name ?? null }
      })
      .catch(() => {})
  }

  return NextResponse.json({
    username: profile?.username ?? null,
    stripe_connect_id: profile?.stripeConnectId ?? null,
    affiliate_onboarded: affiliateOnboarded,
    payout_mode: profile?.affiliatePayoutMode === 'payout' ? 'payout' : 'credit',
    // Konditionen für NEU geworbene Kunden dieses Partners (Admin = Modell C sofort, sonst ab Stichtag)
    referral_terms_new: resolveReferralTerms({ now: new Date(), startAt: modelCStartFromEnv(), referrerIsAdmin: !!profile?.isAdmin, termsOnUser: null }),
    bank_last4,
    bank_name,
    referral_count: referredUsers.length,
    total_pending_cents: totalPending,
    total_paid_cents: totalPaid,
    // Explicit snake_case mapping — the dashboard UI consumes these keys
    commissions: commissions.map(c => ({
      id: c.id,
      gross_amount: c.grossAmount,
      net_amount: c.netAmount,
      commission_amount: c.commissionAmount,
      status: c.status,
      available_at: c.availableAt,
      paid_at: c.paidAt,
      payout_id: c.payoutId,
      created_at: c.createdAt,
    })),
    payouts: payouts.map(p => ({
      id: p.id,
      total_amount: p.totalAmount,
      commission_count: p.commissionCount,
      period_start: p.periodStart,
      period_end: p.periodEnd,
      status: p.status,
      paid_at: p.paidAt,
      payout_method: p.payoutMethod === 'credit' ? 'credit' : 'transfer',
    })),
    // Partner sehen Vorname, Tarif und Status – die E-Mail nur maskiert ("ma***@web.de")
    referred_users: referredUsers.map(u => ({
      id: u.id,
      email: maskEmail(u.email),
      first_name: u.firstName?.trim() || null,
      username: u.username,
      plan: u.plan,
      billing_interval: u.billingInterval,
      subscription_status: u.subscriptionStatus,
      created_at: u.createdAt,
    })),
  })
}
