/**
 * Single source of truth for plan pricing and limits.
 *
 * - Prices are GROSS (incl. VAT where applicable).
 *   Stripe Tax breaks out the VAT on the invoice based on customer location.
 * - Price IDs are read from env vars (different in dev/prod).
 * - This module is safe to import from client components (no Stripe SDK).
 *   Server-side code can still use process.env.* directly.
 */

export type PlanKey = 'starter' | 'pro' | 'unlimited' | 'secret'
export type BillingInterval = 'monthly' | 'yearly'

export interface PlanDef {
  key: PlanKey
  name: string
  /** Gross price per month in EUR (full euros, incl. VAT). */
  monthly_eur: number
  /** Gross price per year in EUR (full euros, incl. VAT). */
  yearly_eur: number
  /** Max published premium sites. -1 = unlimited. */
  max_sites: number
  /** Whether to display the "Beliebt" badge in pricing UIs. */
  popular?: boolean
  /** UI label for the site quota. */
  sites_label: string
}

export const PLANS: Record<PlanKey, PlanDef> = {
  starter: {
    key: 'starter',
    name: 'Starter',
    monthly_eur: 17,
    yearly_eur: 170,
    max_sites: 1,
    sites_label: '1 aktive Premium-Webseite',
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    monthly_eur: 24,
    yearly_eur: 240,
    max_sites: 3,
    popular: true,
    sites_label: '3 aktive Premium-Webseiten',
  },
  unlimited: {
    key: 'unlimited',
    name: 'Unlimited',
    monthly_eur: 42,
    yearly_eur: 420,
    max_sites: -1,
    sites_label: '∞ aktive Premium-Webseiten',
  },
  secret: {
    key: 'secret',
    name: 'Secret',
    monthly_eur: 17,
    yearly_eur: 17, // no yearly option
    max_sites: -1,
    sites_label: '∞ aktive Premium-Webseiten',
  },
}

export const PLAN_ORDER: PlanKey[] = ['starter', 'pro', 'unlimited']

export const PLAN_LIST: PlanDef[] = PLAN_ORDER.map(k => PLANS[k])

export const COMMON_FEATURES = [
  '∞ kostenlose Webseiten',
  'Eigene Subdomain',
  'SSL & DSGVO-konform',
  'Super einfache Bedienung',
  'Online in unter 5 Minuten',
] as const

/** Cents amount (for Stripe API, analytics, internal logs). */
export function planCents(plan: PlanKey, interval: BillingInterval): number {
  const p = PLANS[plan]
  return (interval === 'monthly' ? p.monthly_eur : p.yearly_eur) * 100
}

/** Max sites for a plan (-1 = unlimited). */
export function getPlanMaxSites(plan: string): number {
  return PLANS[plan as PlanKey]?.max_sites ?? 1
}

/** True if targetPlan is strictly higher than currentPlan.
 *  'secret' is not part of PLAN_ORDER — it cannot be self-service upgraded to or from. */
export function canUpgradeTo(currentPlan: string, targetPlan: string): boolean {
  if (currentPlan === 'secret' || targetPlan === 'secret') return false
  return PLAN_ORDER.indexOf(targetPlan as PlanKey) > PLAN_ORDER.indexOf(currentPlan as PlanKey)
}

export const PLAN_LABELS: Record<string, string> = {
  starter: PLANS.starter.name,
  pro: PLANS.pro.name,
  unlimited: PLANS.unlimited.name,
  secret: PLANS.secret.name,
}

/**
 * Server-only: build a price-id → plan mapping from env vars.
 * Don't call this from client components.
 */
export function getPriceIdByPlan(plan: PlanKey, interval: BillingInterval): string {
  const map: Record<PlanKey, Record<BillingInterval, string | undefined>> = {
    starter:   { monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,   yearly: process.env.STRIPE_PRICE_STARTER_YEARLY },
    pro:       { monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,       yearly: process.env.STRIPE_PRICE_PRO_YEARLY },
    unlimited: { monthly: process.env.STRIPE_PRICE_UNLIMITED_MONTHLY, yearly: process.env.STRIPE_PRICE_UNLIMITED_YEARLY },
    secret:    { monthly: process.env.STRIPE_PRICE_SECRET_MONTHLY,    yearly: process.env.STRIPE_PRICE_SECRET_MONTHLY },
  }
  return map[plan][interval] ?? ''
}

/**
 * Server-only: inverse mapping price-id → plan key.
 * Use this in webhooks / activation routes to resolve the plan from a Stripe price.
 */
export function getPlanByPriceId(): Record<string, PlanKey> {
  return {
    [process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '']: 'starter',
    [process.env.STRIPE_PRICE_STARTER_YEARLY ?? '']:  'starter',
    [process.env.STRIPE_PRICE_PRO_MONTHLY ?? '']:     'pro',
    [process.env.STRIPE_PRICE_PRO_YEARLY ?? '']:      'pro',
    [process.env.STRIPE_PRICE_UNLIMITED_MONTHLY ?? '']: 'unlimited',
    [process.env.STRIPE_PRICE_UNLIMITED_YEARLY ?? '']:  'unlimited',
    [process.env.STRIPE_PRICE_SECRET_MONTHLY ?? '']:    'secret',
  }
}
