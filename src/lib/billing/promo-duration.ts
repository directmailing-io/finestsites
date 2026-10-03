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
