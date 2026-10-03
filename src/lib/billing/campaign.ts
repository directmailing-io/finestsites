import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import type { PublicCampaign } from './campaign-shared'

/**
 * Site-wide promotion ("Aktion"): a Stripe promotion code flagged with
 * metadata `sitewide=true`. While it is active, its discount is shown on the
 * marketing site and in the app and is applied automatically at checkout —
 * customers do not have to type the code.
 *
 * Stripe is the single source of truth: as soon as the code expires, is
 * deactivated or is used up, the campaign disappears everywhere by itself.
 */
export interface Campaign extends PublicCampaign {
  promoCodeId: string
}

const CACHE_MS = 60_000
let cache: { at: number; campaigns: Campaign[] } | null = null

async function loadCampaigns(): Promise<Campaign[]> {
  const stripe = getStripe()
  const codes = await stripe.promotionCodes.list({ active: true, limit: 100, expand: ['data.promotion.coupon'] })
  const campaigns: Campaign[] = []
  for (const pc of codes.data) {
    if (pc.metadata?.sitewide !== 'true') continue
    const coupon = pc.promotion?.coupon as Stripe.Coupon | string | null | undefined
    if (!coupon || typeof coupon === 'string' || !coupon.valid) continue
    if (!coupon.percent_off && !coupon.amount_off) continue
    const interval = coupon.metadata?.interval
    campaigns.push({
      promoCodeId: pc.id,
      code: pc.code,
      percentOff: coupon.percent_off ?? null,
      amountOff: coupon.amount_off ?? null,
      duration: coupon.duration,
      durationInMonths: coupon.duration_in_months ?? null,
      interval: interval === 'monthly' || interval === 'yearly' ? interval : 'both',
      endsAt: pc.expires_at ? new Date(pc.expires_at * 1000).toISOString() : null,
    })
  }
  return campaigns
}

/** The currently running site-wide campaign, or null. Never throws. */
export async function getActiveCampaign(): Promise<Campaign | null> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    try {
      cache = { at: Date.now(), campaigns: await loadCampaigns() }
    } catch (e) {
      console.error('[billing/campaign] failed to load campaigns:', e instanceof Error ? e.message : e)
      // Keep serving the last known list (expiry is still enforced below); retry on next call
      if (!cache) return null
    }
  }
  // Expiry is checked on every call, so the campaign ends on the second — independent of the cache
  const now = Date.now()
  return cache.campaigns.find(c => !c.endsAt || new Date(c.endsAt).getTime() > now) ?? null
}

/**
 * Campaign for a specific account — the same rule decides what the UI shows and
 * what checkout applies, so the displayed price is always the charged price.
 *
 * Not eligible:
 * - referred users: they keep their permanent partner discount, and applying
 *   a promotion code would end the partner's commission
 * - anyone who already had a subscription (campaign is for new customers)
 */
export async function getCampaignForProfile(profile: {
  referredByUsername?: string | null
  subscriptionStatus?: string | null
  stripeSubscriptionId?: string | null
} | null | undefined): Promise<Campaign | null> {
  if (profile?.referredByUsername || profile?.subscriptionStatus || profile?.stripeSubscriptionId) return null
  return getActiveCampaign()
}

export function toPublicCampaign(campaign: Campaign | null): PublicCampaign | null {
  if (!campaign) return null
  const { promoCodeId: _promoCodeId, ...pub } = campaign
  return pub
}
