export type PromoDuration = 'once' | 'repeating' | 'forever'

/**
 * Describes how long a Stripe coupon reduces the price for a given billing interval.
 *
 * Stripe applies a coupon to every invoice created while it is active. A yearly
 * subscription has one invoice per year, so a "3 months" coupon discounts the
 * whole first yearly invoice — not just 3/12 of it.
 */
export function promoDurationInfo(
  duration: PromoDuration | null | undefined,
  durationInMonths: number | null | undefined,
  interval: 'monthly' | 'yearly',
): { text: string; limited: boolean } {
  if (!duration || duration === 'forever') return { text: 'dauerhaft', limited: false }

  const months = duration === 'repeating' ? Math.max(1, durationInMonths ?? 1) : 1

  if (interval === 'yearly') {
    const years = Math.ceil(months / 12)
    return { text: years === 1 ? 'im ersten Jahr' : `in den ersten ${years} Jahren`, limited: true }
  }
  return { text: months === 1 ? 'im ersten Monat' : `in den ersten ${months} Monaten`, limited: true }
}

export interface DiscountAmount {
  percent_off?: number | null
  /** Fixed discount in cents (Stripe coupon.amount_off). */
  amount_off?: number | null
}

/**
 * Amount in EUR that is actually charged for one billing period.
 * Mirrors Stripe: the discount is taken off the invoice total and rounded to cents.
 * Always pass the full period price (monthly price or yearly price), never a per-month equivalent.
 */
export function discountedTotal(baseTotalEur: number, discount: DiscountAmount | null | undefined): number {
  const baseCents = Math.round(baseTotalEur * 100)
  if (discount?.percent_off) return (baseCents - Math.round(baseCents * discount.percent_off / 100)) / 100
  if (discount?.amount_off) return Math.max(0, baseCents - discount.amount_off) / 100
  return baseTotalEur
}

/** "14" for whole euros, otherwise "13,60" — never rounds cents away. */
export function formatEur(amount: number): string {
  const cents = Math.round(amount * 100)
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',')
}
