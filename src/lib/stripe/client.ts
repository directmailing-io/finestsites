import Stripe from 'stripe'

// Lazy singleton — created on first use, not at module init.
// This ensures STRIPE_SECRET_KEY is available (Vercel injects env vars before
// the first request, but module-level init runs at bundle load time which can
// race on cold starts).
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  // Next.js 15 patches globalThis.fetch for server-side caching.
  // Without cache: 'no-store', Next.js intercepts Stripe's POST requests and
  // tries to cache them — this breaks the connection on Node.js 24 / Vercel.
  // Wrapping fetch to always pass cache: 'no-store' fixes this definitively.
  const noStoreFetch: typeof globalThis.fetch = (input, init) =>
    globalThis.fetch(input, { ...init, cache: 'no-store' })

  _stripe = new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(noStoreFetch),
  })
  return _stripe
}

// Re-export from the UI-safe plans module for convenience.
// Server-side code can import either from '@/lib/stripe/client' or '@/lib/plans'.
export {
  PLANS,
  PLAN_ORDER,
  PLAN_LIST,
  PLAN_LABELS,
  COMMON_FEATURES,
  planCents,
  getPlanMaxSites,
  canUpgradeTo,
  getPriceIdByPlan,
  getPlanByPriceId,
} from '@/lib/plans'
export type { PlanKey, BillingInterval, PlanDef } from '@/lib/plans'
