import type { PromoDuration, DiscountAmount } from './promo-duration'

/**
 * Site-wide promotion ("Aktion") as shown to visitors. Safe for client components.
 * Source of truth is the Stripe promotion code — see campaign.ts.
 */
export interface PublicCampaign {
  /** Promotion code as customers know it, e.g. INNERVISIONDAY. */
  code: string
  percentOff: number | null
  /** Fixed discount in cents. */
  amountOff: number | null
  duration: PromoDuration
  durationInMonths: number | null
  /** Billing intervals the coupon is valid for. */
  interval: 'both' | 'monthly' | 'yearly'
  /** ISO timestamp when the promotion ends; null = no end date. */
  endsAt: string | null
}

/** Discount the campaign gives for a billing interval, or null if it does not apply. */
export function campaignDiscount(
  campaign: PublicCampaign | null | undefined,
  interval: 'monthly' | 'yearly',
): DiscountAmount | null {
  if (!campaign) return null
  if (campaign.interval !== 'both' && campaign.interval !== interval) return null
  return { percent_off: campaign.percentOff, amount_off: campaign.amountOff }
}

/** "20 % Rabatt" / "5 € Rabatt" */
export function campaignAmountLabel(campaign: PublicCampaign): string {
  if (campaign.percentOff) return `${campaign.percentOff} % Rabatt`
  if (campaign.amountOff) return `${String(campaign.amountOff / 100).replace('.', ',')} € Rabatt`
  return 'Rabatt'
}

/** Remaining time for "endet in …": "1 Tag 10 Std.", "3 Std. 12 Min.", "4 Min. 09 Sek." */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (days > 0) return `${days} ${days === 1 ? 'Tag' : 'Tagen'} ${hours} Std.`
  if (hours > 0) return `${hours} Std. ${minutes} Min.`
  return `${minutes} Min. ${String(seconds).padStart(2, '0')} Sek.`
}
