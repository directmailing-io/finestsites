/**
 * Site access enforcement — the ONE place that takes a user's sites offline
 * for billing reasons and brings them back.
 *
 * Design goals (this replaced ad-hoc logic spread across three webhook cases
 * that missed reactivations when Stripe events arrived out of order):
 *
 *  - Idempotent: every function can run any number of times, in any order,
 *    and converges on the same state. Callers don't need to know "was the
 *    user deactivated before?" — they just call reconcile().
 *  - DB is the source of truth. Cloudflare KV is only a cache: every offline
 *    marker we write carries a TTL, and the Worker re-asks the app after it
 *    expires. So even if every KV write here fails, the live state converges
 *    within OFFLINE_TTL_SECONDS.
 *  - Billing suspension never destroys anything: no scheduledDeletionAt, and a
 *    suspended site remembers via publishedAt whether it was live.
 *
 * Called from the Stripe webhook (after each status update), the billing cron
 * (hourly safety net) and the admin panel.
 */

import { db } from '@/lib/db'
import { users, userSites } from '@/lib/db/schema'
import { and, eq, inArray, isNull, isNotNull, or } from 'drizzle-orm'
import { shouldBeOffline, recoveryColumns } from '@/lib/billing/payment-recovery'
import {
  setSiteOfflineKV,
  clearSiteMetaKV,
  deleteCustomDomainKV,
  setCustomDomainKV,
} from '@/lib/cloudflare/kv-api'

/** Subscription states in which the user's sites may be online. */
export const ONLINE_STATUSES = ['active', 'trialing'] as const

/**
 * Whether the sites must be offline is decided by shouldBeOffline() in
 * payment-recovery.ts (grace period, in-flight SEPA retry, hard deadline).
 * Stripe's `past_due` alone never takes a site offline: Stripe also reports it
 * while a SEPA payment is merely still processing.
 */
export { shouldBeOffline }

type SiteRow = {
  id: string
  customDomain: string | null
  publishedAt: Date | null
  template: { domain: string } | null
  user: { username: string | null } | null
}

const siteSelect = {
  columns: { id: true, customDomain: true, publishedAt: true },
  with: {
    template: { columns: { domain: true } },
    user: { columns: { username: true } },
  },
} as const

function logKvError(what: string, siteId: string) {
  return (err: unknown) => console.error(`[site-access] KV ${what} failed for site ${siteId}:`, err)
}

/**
 * Take every live site of the user offline.
 *
 * - `published` → `deactivated` (drafts are left alone — they're not online)
 * - offline marker pushed to KV (TTL-bound), custom-domain mapping removed
 * - `scheduleDeletionAt` is only set for permanent cancellations
 *   (subscription.deleted); billing suspensions leave it null so restore()
 *   can tell them apart.
 *
 * Returns the number of sites taken offline (0 when already suspended).
 */
export async function suspendSites(
  userId: string,
  opts: { scheduleDeletionAt?: Date | null } = {},
): Promise<number> {
  const now = new Date()

  // Permanent cancellation: sites that were already suspended for an open
  // payment (past_due → Stripe gave up) must get the deletion timer too.
  if (opts.scheduleDeletionAt) {
    await db.update(userSites)
      .set({ scheduledDeletionAt: opts.scheduleDeletionAt })
      .where(and(
        eq(userSites.userId, userId),
        eq(userSites.status, 'deactivated'),
        isNull(userSites.scheduledDeletionAt),
      ))
  }

  const live = await db.query.userSites.findMany({
    where: and(eq(userSites.userId, userId), eq(userSites.status, 'published')),
    ...siteSelect,
  }) as SiteRow[]
  if (live.length === 0) return 0

  await db.update(userSites)
    .set({
      status: 'deactivated',
      deactivatedAt: now,
      ...(opts.scheduleDeletionAt ? { scheduledDeletionAt: opts.scheduleDeletionAt } : {}),
    })
    .where(inArray(userSites.id, live.map(s => s.id)))

  for (const site of live) {
    const username = site.user?.username
    const domain = site.template?.domain
    if (username && domain) {
      await setSiteOfflineKV(username, domain).catch(logKvError('offline', site.id))
    }
    if (site.customDomain) {
      await deleteCustomDomainKV(site.customDomain).catch(logKvError('custom-domain delete', site.id))
    }
  }
  return live.length
}

/**
 * Bring the user's suspended sites back online.
 *
 * By default only billing suspensions are restored (deactivated AND no
 * scheduledDeletionAt). Pass `includeScheduledDeletion` when a fully
 * cancelled account comes back (new subscription) — that also clears the
 * deletion timer.
 *
 * A site that was never published (publishedAt null — legacy rows from the
 * time drafts were suspended too) comes back as a draft, never as published.
 *
 * Returns the number of sites restored (0 when nothing was suspended).
 */
export async function restoreSites(
  userId: string,
  opts: { includeScheduledDeletion?: boolean } = {},
): Promise<number> {
  const suspended = await db.query.userSites.findMany({
    where: and(
      eq(userSites.userId, userId),
      eq(userSites.status, 'deactivated'),
      ...(opts.includeScheduledDeletion ? [] : [isNull(userSites.scheduledDeletionAt)]),
    ),
    ...siteSelect,
  }) as SiteRow[]
  if (suspended.length === 0) return 0

  for (const site of suspended) {
    await db.update(userSites)
      .set({
        status: site.publishedAt ? 'published' : 'draft',
        deactivatedAt: null,
        scheduledDeletionAt: null,
      })
      .where(eq(userSites.id, site.id))

    const username = site.user?.username
    const domain = site.template?.domain
    if (username && domain) {
      // Drop the offline marker so the Worker re-fetches from the DB (now published)
      await clearSiteMetaKV(username, domain).catch(logKvError('meta clear', site.id))
      if (site.customDomain && site.publishedAt) {
        await setCustomDomainKV(site.customDomain, username, domain).catch(logKvError('custom-domain restore', site.id))
      }
    }
  }
  return suspended.length
}

export type ReconcileResult =
  | { action: 'suspended'; sites: number }
  | { action: 'restored'; sites: number }
  | { action: 'unchanged' }

/**
 * Make the user's sites match their subscription status in the DB.
 *
 *   shouldBeOffline() → all published sites go offline
 *   active / trialing / past_due (processing or in grace)
 *                     → all billing-suspended sites come back online
 *   anything else     → untouched (canceled/expired accounts are handled by
 *                       subscription.deleted and the cron, which set
 *                       deactivatedAt + a deletion timer)
 *
 * Safe to call after every webhook regardless of event order: whichever
 * event lands last sees the final Stripe status and the sites follow it.
 */
export async function reconcileSiteAccess(userId: string, now: Date = new Date()): Promise<ReconcileResult> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { ...recoveryColumns, deactivatedAt: true },
  })
  if (!user || user.deactivatedAt) return { action: 'unchanged' }

  if (shouldBeOffline(user, now)) {
    const sites = await suspendSites(userId)
    return sites > 0 ? { action: 'suspended', sites } : { action: 'unchanged' }
  }

  const status = user.subscriptionStatus ?? ''
  // active/trialing, a SEPA payment still processing (past_due without a
  // recorded failure) or an arrears episode inside its grace → online
  const mayBeOnline = (ONLINE_STATUSES as readonly string[]).includes(status) || status === 'past_due'
  if (!mayBeOnline) return { action: 'unchanged' }

  const sites = await restoreSites(userId)
  return sites > 0 ? { action: 'restored', sites } : { action: 'unchanged' }
}

/**
 * Cron safety net: find every user whose sites don't match their subscription
 * status and fix them. Cheap — only users with a mismatch are touched.
 */
export async function reconcileAllSiteAccess(): Promise<{ restored: number; suspended: number; errors: number }> {
  const stats = { restored: 0, suspended: 0, errors: 0 }

  // Candidates with billing-suspended sites (may need to come back online)
  const suspendedCandidates = await db
    .selectDistinct({ userId: userSites.userId })
    .from(userSites)
    .innerJoin(users, eq(users.id, userSites.userId))
    .where(and(
      inArray(users.subscriptionStatus, [...ONLINE_STATUSES, 'past_due']),
      isNull(users.deactivatedAt),
      eq(userSites.status, 'deactivated'),
      isNull(userSites.scheduledDeletionAt),
    ))

  // Candidates with live sites and an open arrears episode (may need to go
  // offline — grace end and hard deadline are time-based, so the hourly run
  // is what actually flips them)
  const arrearsCandidates = await db
    .selectDistinct({ userId: userSites.userId })
    .from(userSites)
    .innerJoin(users, eq(users.id, userSites.userId))
    .where(and(
      or(eq(users.subscriptionStatus, 'unpaid'), isNotNull(users.paymentFailedAt)),
      isNull(users.deactivatedAt),
      eq(userSites.status, 'published'),
    ))

  const seen = new Set<string>()
  const candidates = [...suspendedCandidates, ...arrearsCandidates].filter(({ userId }) => {
    if (seen.has(userId)) return false
    seen.add(userId)
    return true
  })

  for (const { userId } of candidates) {
    try {
      const r = await reconcileSiteAccess(userId)
      if (r.action === 'restored') stats.restored += r.sites
      if (r.action === 'suspended') stats.suspended += r.sites
      if (r.action !== 'unchanged') console.log(`[site-access] reconcile ${userId}: ${r.action} ${r.sites}`)
    } catch (err) {
      stats.errors++
      console.error(`[site-access] reconcile error for ${userId}:`, err)
    }
  }
  return stats
}
