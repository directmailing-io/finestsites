/**
 * Cron: billing enforcement
 *
 * Crontab on the app server (see docs/billing-lifecycle.html):
 *   every 15 min  `?only=reconcile`  — steps 0 + 1
 *   daily 06:00   full run           — all steps
 * Also callable manually with the CRON_SECRET.
 *
 * Rules (payment recovery, see src/lib/billing/payment-recovery.ts):
 *  0. Reconcile — every user's sites match shouldBeOffline(): online during
 *     the grace period / while a SEPA retry is processing, offline after the
 *     grace or the hard deadline. Safety net for missed Stripe webhooks and
 *     the place where time-based transitions actually happen.
 *  1. Recovery mails — day-0 notice, day-3 reminder, offline notice. Each
 *     exactly once per episode (markers on the user row).
 *  2. Hard deadline (HARD_DEADLINE_DAYS after the first failure):
 *     - user.deactivatedAt set, published sites → 'deactivated', KV offline
 *     - open invoice voided + Stripe subscription cancelled → the resulting
 *       customer.subscription.deleted webhook starts the 90-day deletion timer
 *     - "Konto pausiert" mail
 *  3. Unpaid/canceled cleanup — fallback for Stripe-side cancellations
 *  4. 90-day hard deletion — sites with scheduledDeletionAt in the past:
 *     R2 images + site rows (cascades siteData + siteImages)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, userSites, subscriptionEvents } from '@/lib/db/schema'
import { eq, isNull, isNotNull, lte, and, or } from 'drizzle-orm'
import { setSiteOfflineKV, deleteCustomDomainKV } from '@/lib/cloudflare/kv-api'
import { deleteFromR2 } from '@/lib/r2/client'
import { sendEmail } from '@/lib/resend'
import { accountDeactivatedEmail } from '@/lib/email/templates'
import { reconcileAllSiteAccess } from '@/lib/billing/site-access'
import { HARD_DEADLINE_DAYS, cancelForNonPayment } from '@/lib/billing/payment-recovery'
import { runRecoveryNotifications } from '@/lib/billing/recovery-notifications'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const stats = {
    reconciled: { restored: 0, suspended: 0, errors: 0 },
    notified: { notice: 0, reminder: 0, offline: 0, errors: 0 },
    deactivated: 0,
    deleted: 0,
    errors: 0,
  }

  // ── 0. Reconcile site access with the recovery state ──────────────────────
  stats.reconciled = await reconcileAllSiteAccess()

  // ── 1. Recovery mails ──────────────────────────────────────────────────────
  stats.notified = await runRecoveryNotifications(now)

  if (request.nextUrl.searchParams.get('only') === 'reconcile') {
    return NextResponse.json(stats)
  }

  // ── 2. Hard deadline: deactivate + cancel in Stripe ────────────────────────
  const deadlineCutoff = new Date(now.getTime() - HARD_DEADLINE_DAYS * 24 * 60 * 60 * 1000)

  const overdueCandidates = await db.query.users.findMany({
    where: and(
      isNotNull(users.paymentFailedAt),
      lte(users.paymentFailedAt, deadlineCutoff),
      isNull(users.deactivatedAt),
    ),
    columns: { id: true, email: true, stripeSubscriptionId: true, paymentFailedInvoiceId: true },
  })

  // ── 3. Also catch unpaid/canceled users not yet deactivated (Stripe-side fallback)
  const staleCandidates = await db.query.users.findMany({
    where: and(
      or(
        eq(users.subscriptionStatus, 'unpaid'),
        eq(users.subscriptionStatus, 'canceled'),
      ),
      isNull(users.deactivatedAt),
    ),
    columns: { id: true, email: true, stripeSubscriptionId: true, paymentFailedInvoiceId: true },
  })

  const seen = new Set<string>()
  const toDeactivate = [...overdueCandidates, ...staleCandidates].filter(u => {
    if (seen.has(u.id)) return false
    seen.add(u.id)
    return true
  })

  for (const user of toDeactivate) {
    try {
      // Mark user as deactivated first: the subscription.deleted webhook that
      // our cancellation triggers must not send a second mail
      await db.update(users)
        .set({ deactivatedAt: now })
        .where(eq(users.id, user.id))

      const sites = await db.query.userSites.findMany({
        where: and(
          eq(userSites.userId, user.id),
          eq(userSites.status, 'published'),
        ),
        columns: { id: true, customDomain: true },
        with: {
          template: { columns: { domain: true } },
          user:     { columns: { username: true } },
        },
      })

      for (const site of sites) {
        await db.update(userSites)
          .set({ status: 'deactivated', deactivatedAt: now })
          .where(eq(userSites.id, site.id))

        const username       = (site as any).user?.username as string | null
        const templateDomain = (site as any).template?.domain as string | null

        if (username && templateDomain) {
          await setSiteOfflineKV(username, templateDomain).catch(err =>
            console.error(`[billing-enforcement] KV offline error for ${site.id}:`, err)
          )
        }
        if (site.customDomain) {
          await deleteCustomDomainKV(site.customDomain).catch(err =>
            console.error(`[billing-enforcement] KV custom domain delete error for ${site.customDomain}:`, err)
          )
        }
      }

      // Stop collecting: void the open invoice, cancel the subscription.
      // Stripe then fires customer.subscription.deleted → 90-day deletion timer.
      const cancelled = await cancelForNonPayment({
        subscriptionId: user.stripeSubscriptionId,
        trackedInvoiceId: user.paymentFailedInvoiceId,
      })

      await db.insert(subscriptionEvents).values({
        userId: user.id,
        eventType: 'account_deactivated',
        stripeEventId: `cron:deactivate:${user.id}:${now.toISOString().slice(0, 10)}`,
        stripeSubscriptionId: user.stripeSubscriptionId,
        stripeInvoiceId: user.paymentFailedInvoiceId,
        metadata: { sites: sites.length, ...cancelled },
      }).catch(() => {})

      sendEmail({ to: user.email, subject: 'Dein Konto wurde pausiert', html: accountDeactivatedEmail(), type: 'account_deactivated' }).catch(() => {})

      stats.deactivated++
      console.log(`[billing-enforcement] Deactivated user ${user.id} (${user.email})`, cancelled)
    } catch (err) {
      console.error(`[billing-enforcement] deactivation error for ${user.id}:`, err)
      stats.errors++
    }
  }

  // ── 4. 90-day hard deletion ────────────────────────────────────────────────
  const sitesToDelete = await db.query.userSites.findMany({
    where: and(
      eq(userSites.status, 'deactivated'),
      isNotNull(userSites.scheduledDeletionAt),
      lte(userSites.scheduledDeletionAt, now),
    ),
    columns: { id: true, r2PublishedPath: true },
    with: {
      siteImages: { columns: { r2Path: true } },
    },
  })

  for (const site of sitesToDelete) {
    try {
      for (const img of (site as any).siteImages ?? []) {
        if (img.r2Path) {
          await deleteFromR2(img.r2Path).catch(err =>
            console.error(`[billing-enforcement] R2 image delete error ${img.r2Path}:`, err)
          )
        }
      }
      if (site.r2PublishedPath) {
        await deleteFromR2(site.r2PublishedPath).catch(() => {})
      }
      await db.delete(userSites).where(eq(userSites.id, site.id))
      stats.deleted++
      console.log(`[billing-enforcement] Hard deleted site ${site.id}`)
    } catch (err) {
      console.error(`[billing-enforcement] hard-delete error for site ${site.id}:`, err)
      stats.errors++
    }
  }

  console.log(`[billing-enforcement] Done — notified: ${JSON.stringify(stats.notified)}, deactivated: ${stats.deactivated}, deleted: ${stats.deleted}, errors: ${stats.errors}`)
  return NextResponse.json(stats)
}
