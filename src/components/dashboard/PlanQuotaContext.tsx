'use client'

/**
 * Shared plan-quota state for the dashboard.
 * Single source of truth that:
 *   - holds the current plan + used/limit counts
 *   - exposes a refetch() so any site action (publish / unpublish / delete)
 *     can request a refresh
 *   - auto-refetches on pathname change so the sidebar stays in sync as the
 *     user navigates between sites/templates/etc.
 *
 * Use:
 *   const quota = usePlanQuota()
 *   quota.refetch()
 */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { usePathname } from 'next/navigation'

interface QuotaState {
  plan: string | null
  /** True when the user has an active paid subscription. */
  hasSub: boolean
  used: number
  limit: number  // Infinity for unlimited
  atLimit: boolean
  loading: boolean
  refetch: () => Promise<void>
}

const PLAN_LIMITS: Record<string, number> = { starter: 1, pro: 3, unlimited: Infinity, secret: Infinity }
const ACTIVE_SUB_STATUSES = ['active', 'trialing', 'past_due']

const PlanQuotaContext = createContext<QuotaState | null>(null)

export function PlanQuotaProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<string | null>(null)
  const [hasSub, setHasSub] = useState(false)
  const [used, setUsed] = useState(0)
  const [limit, setLimit] = useState(1)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/user/profile', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const subStatus: string | null = data.subscription_status ?? null
      const activeSub = !!subStatus && ACTIVE_SUB_STATUSES.includes(subStatus)
      // Only treat the plan as set when the user actually has an active subscription.
      // Free users (no subscription) get plan=null so the sidebar shows "Kostenloser Modus".
      const p = activeSub ? (data.plan ?? null) : null
      const u = data.paid_sites_count ?? 0
      const l = p ? (PLAN_LIMITS[p] ?? 1) : 0
      setPlan(p)
      setHasSub(activeSub)
      setUsed(u)
      setLimit(l)
    } catch {
      /* fail silently — old state stays */
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => { refetch() }, [refetch])

  // Re-fetch whenever the user navigates within the dashboard.
  // The user has likely just performed a site action (publish/unpublish/delete).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refetch() }, [pathname])

  const atLimit = limit !== Infinity && used >= limit

  const value: QuotaState = { plan, hasSub, used, limit, atLimit, loading, refetch }
  return <PlanQuotaContext.Provider value={value}>{children}</PlanQuotaContext.Provider>
}

export function usePlanQuota(): QuotaState {
  const ctx = useContext(PlanQuotaContext)
  if (!ctx) {
    // Safe fallback so components don't crash if used outside provider.
    return {
      plan: null, hasSub: false, used: 0, limit: 0, atLimit: false, loading: false,
      refetch: async () => {},
    }
  }
  return ctx
}
