/**
 * Cron: Daily billing enforcement
 *
 * Runs daily at 06:00 UTC (set up in VPS crontab).
 * Also callable manually via GET with CRON_SECRET for testing.
 *
 * Rules:
 *  1. 7-day warning — users with paymentFailedAt between 6-8 days ago
 *  2. 14-day deactivation — users with paymentFailedAt older than 14 days:
 *     - Set deactivatedAt on user
 *     - Set published sites to 'deactivated' status
 *     - Push offline marker to KV
 *     - Delete custom domain KV entries
 *     - Send deactivation email
 *  3. Unpaid/canceled cleanup — fallback for Stripe-side cancellations
 *  4. 90-day hard deletion — sites with scheduledDeletionAt in the past:
 *     - Delete R2 images
 *     - Delete site records from DB (cascades siteData + siteImages)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, userSites } from '@/lib/db/schema'
import { eq, isNull, isNotNull, lte, gte, and, inArray, or } from 'drizzle-orm'
import { setSiteOfflineKV, deleteCustomDomainKV } from '@/lib/cloudflare/kv-api'
import { deleteFromR2 } from '@/lib/r2/client'
import { sendEmail } from '@/lib/resend'
import { paymentWarningEmail, accountDeactivatedEmail } from '@/lib/email/templates'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const stats = { warned: 0, deactivated: 0, deleted: 0, errors: 0 }

  // ── 1. Send 7-day warning ──────────────────────────────────────────────────
  // Window: 6–8 days after paymentFailedAt to handle slight cron drift.
  const warnFrom = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
  const warnTo   = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)

  const warnCandidates = await db.query.users.findMany({
    where: and(
      eq(users.subscriptionStatus, 'past_due'),
      isNotNull(users.paymentFailedAt),
      gte(users.paymentFailedAt, warnFrom),
      lte(users.paymentFailedAt, warnTo),
      isNull(users.deactivatedAt),
    ),
    columns: { id: true, email: true, paymentFailedAt: true },
  })

  for (const user of warnCandidates) {
    try {
      await sendEmail({ to: user.email, subject: 'Zahlung ausstehend – dein Konto wird in 7 Tagen deaktiviert', html: paymentWarningEmail({ daysLeft: 7 }), type: 'payment_warning' })
      stats.warned++
    } catch (err) {
      console.error(`[billing-enforcement] warning email error for ${user.id}:`, err)
      stats.errors++
    }
  }

  // ── 2. Deactivate after 14-day grace period ────────────────────────────────
  const graceCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const overdueCandidates = await db.query.users.findMany({
    where: and(
      eq(users.subscriptionStatus, 'past_due'),
      isNotNull(users.paymentFailedAt),
      lte(users.paymentFailedAt, graceCutoff),
      isNull(users.deactivatedAt),
    ),
    columns: { id: true, email: true },
  })

  // Also catch unpaid/canceled users not yet deactivated (Stripe-side fallback)
  const staleCandidates = await db.query.users.findMany({
    where: and(
      or(
        eq(users.subscriptionStatus, 'unpaid'),
        eq(users.subscriptionStatus, 'canceled'),
      ),
      isNull(users.deactivatedAt),
    ),
    columns: { id: true, email: true },
  })

  const toDeactivate = [...overdueCandidates, ...staleCandidates]
  // Deduplicate by id
  const seen = new Set<string>()
  const deduped = toDeactivate.filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true })

  for (const user of deduped) {
    try {
      // Mark user as deactivated
      await db.update(users)
        .set({ deactivatedAt: now })
        .where(eq(users.id, user.id))

      // Find published sites to take offline
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
        // Update DB status
        await db.update(userSites)
          .set({ status: 'deactivated', deactivatedAt: now })
          .where(eq(userSites.id, site.id))

        const username      = (site as any).user?.username as string | null
        const templateDomain = (site as any).template?.domain as string | null

        // Push offline marker to KV so Worker shows offline page
        if (username && templateDomain) {
          await setSiteOfflineKV(username, templateDomain).catch(err =>
            console.error(`[billing-enforcement] KV offline error for ${site.id}:`, err)
          )
        }

        // Remove custom domain KV entry so the domain 404s
        if (site.customDomain) {
          await deleteCustomDomainKV(site.customDomain).catch(err =>
            console.error(`[billing-enforcement] KV custom domain delete error for ${site.customDomain}:`, err)
          )
        }
      }

      // Send deactivation email (fire-and-forget)
      sendEmail({ to: user.email, subject: 'Dein FinestSites-Konto wurde deaktiviert', html: accountDeactivatedEmail(), type: 'account_deactivated' }).catch(() => {})

      stats.deactivated++
      console.log(`[billing-enforcement] Deactivated user ${user.id} (${user.email})`)
    } catch (err) {
      console.error(`[billing-enforcement] deactivation error for ${user.id}:`, err)
      stats.errors++
    }
  }

  // ── 4. 90-day hard deletion ────────────────────────────────────────────────
  // Sites where scheduledDeletionAt has passed: delete R2 files then DB records
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
      // Delete all uploaded images from R2
      for (const img of (site as any).siteImages ?? []) {
        if (img.r2Path) {
          await deleteFromR2(img.r2Path).catch(err =>
            console.error(`[billing-enforcement] R2 image delete error ${img.r2Path}:`, err)
          )
        }
      }
      // Delete published R2 path if exists
      if (site.r2PublishedPath) {
        await deleteFromR2(site.r2PublishedPath).catch(() => {})
      }
      // Delete site from DB (cascades siteData + siteImages)
      await db.delete(userSites).where(eq(userSites.id, site.id))
      stats.deleted++
      console.log(`[billing-enforcement] Hard deleted site ${site.id}`)
    } catch (err) {
      console.error(`[billing-enforcement] hard-delete error for site ${site.id}:`, err)
      stats.errors++
    }
  }

  console.log(`[billing-enforcement] Done — warned: ${stats.warned}, deactivated: ${stats.deactivated}, deleted: ${stats.deleted}, errors: ${stats.errors}`)
  return NextResponse.json(stats)
}
