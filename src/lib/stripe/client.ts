import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
  typescript: true,
})

export const PLANS = {
  starter: {
    name: 'Starter',
    monthly_price_id: process.env.STRIPE_PRICE_STARTER_MONTHLY!,
    yearly_price_id: process.env.STRIPE_PRICE_STARTER_YEARLY!,
    monthly_amount: 1700, // €17.00 in cents
    yearly_amount: 17000, // €170.00 in cents
    max_sites: 1,
  },
  pro: {
    name: 'Pro',
    monthly_price_id: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    yearly_price_id: process.env.STRIPE_PRICE_PRO_YEARLY!,
    monthly_amount: 2900,
    yearly_amount: 29000,
    max_sites: 3,
  },
  unlimited: {
    name: 'Unlimited',
    monthly_price_id: process.env.STRIPE_PRICE_UNLIMITED_MONTHLY!,
    yearly_price_id: process.env.STRIPE_PRICE_UNLIMITED_YEARLY!,
    monthly_amount: 3900,
    yearly_amount: 39000,
    max_sites: -1, // unlimited
  },
} as const

export function getPlanMaxSites(plan: string): number {
  return PLANS[plan as keyof typeof PLANS]?.max_sites ?? 1
}

export function canUpgradeTo(currentPlan: string, targetPlan: string): boolean {
  const order = ['starter', 'pro', 'unlimited']
  return order.indexOf(targetPlan) > order.indexOf(currentPlan)
}
