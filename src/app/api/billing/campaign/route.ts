import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { getCampaignForProfile, toPublicCampaign } from '@/lib/billing/campaign'

/**
 * GET /api/billing/campaign — the site-wide promotion this visitor would get
 * automatically at checkout (or null). Public; for logged-in users the
 * eligibility rules of the checkout are applied.
 */
export async function GET(req: NextRequest) {
  let profile: { referredByUsername: string | null; subscriptionStatus: string | null; stripeSubscriptionId: string | null } | null = null
  try {
    const user = await getUserFromRequest(req)
    if (user) {
      profile = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { referredByUsername: true, subscriptionStatus: true, stripeSubscriptionId: true },
      }) ?? null
    }
  } catch { /* not logged in / DB error → treat as anonymous visitor */ }

  const campaign = toPublicCampaign(await getCampaignForProfile(profile))
  return NextResponse.json({ campaign }, { headers: { 'Cache-Control': 'no-store' } })
}
