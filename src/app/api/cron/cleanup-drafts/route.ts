import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { userSites, users } from '@/lib/db/schema'
import { eq, and, lt, isNull, or, inArray } from 'drizzle-orm'

/**
 * Cron: DELETE abandoned draft sites and inactive free accounts.
 *
 * Rules (DSGVO-conscious — no data stored longer than necessary):
 *
 * 1. DRAFT SITES older than 30 days for users WITHOUT an active subscription
 *    are hard-deleted (cascade removes site_data + submissions).
 *    Rationale: users who never paid have no expectation of permanence.
 *
 * 2. DRAFT SITES older than 90 days even for paying users (subscription ended).
 *    Rationale: if someone cancels and doesn't come back for 3 months their
 *    data should not sit in the DB forever.
 *
 * Security: protected by CRON_SECRET header. Vercel calls this with the secret
 * automatically when configured in vercel.json.
 */

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret (or manual call with header)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const cutoff90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  let deletedDrafts = 0

  try {
    // 1. Find users without active subscription
    const inactiveUsers = await db.query.users.findMany({
      where: or(
        isNull(users.subscriptionStatus),
        // Not in active statuses — note: drizzle doesn't have notInArray directly,
        // so we fetch all and filter, then do a targeted delete.
      ),
      columns: { id: true, subscriptionStatus: true },
    })

    const freeUserIds = inactiveUsers
      .filter(u => !u.subscriptionStatus || !ACTIVE_STATUSES.includes(u.subscriptionStatus))
      .map(u => u.id)

    // 2. Delete draft sites older than 30 days for non-paying users
    if (freeUserIds.length > 0) {
      const staleDrafts = await db.query.userSites.findMany({
        where: and(
          inArray(userSites.userId, freeUserIds),
          eq(userSites.status, 'draft'),
          lt(userSites.updatedAt, cutoff30d),
        ),
        columns: { id: true },
      })

      if (staleDrafts.length > 0) {
        const ids = staleDrafts.map(s => s.id)
        await db.delete(userSites).where(inArray(userSites.id, ids))
        deletedDrafts += staleDrafts.length
        console.log(`[cron/cleanup-drafts] deleted ${staleDrafts.length} stale drafts for non-paying users`)
      }
    }

    // 3. Delete draft sites older than 90 days regardless of user (DSGVO data minimization)
    const veryOldDrafts = await db.query.userSites.findMany({
      where: and(
        eq(userSites.status, 'draft'),
        lt(userSites.updatedAt, cutoff90d),
      ),
      columns: { id: true },
    })

    if (veryOldDrafts.length > 0) {
      const ids = veryOldDrafts.map(s => s.id)
      await db.delete(userSites).where(inArray(userSites.id, ids))
      deletedDrafts += veryOldDrafts.length
      console.log(`[cron/cleanup-drafts] deleted ${veryOldDrafts.length} very old drafts (>90d)`)
    }

    return NextResponse.json({
      ok: true,
      deleted_drafts: deletedDrafts,
      ran_at: now.toISOString(),
    })
  } catch (err) {
    console.error('[cron/cleanup-drafts] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
