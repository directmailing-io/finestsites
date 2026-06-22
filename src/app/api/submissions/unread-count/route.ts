import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { userSites, formSubmissions } from '@/lib/db/schema'
import { eq, inArray, and, isNull, count } from 'drizzle-orm'

/**
 * GET /api/submissions/unread-count
 * Returns the total unread submission count across all the user's sites.
 * Used by the sidebar badge.
 */
export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ count: 0 })

  try {
    // Get all user site IDs
    const ownedSites = await db
      .select({ id: userSites.id })
      .from(userSites)
      .where(and(
        eq(userSites.userId, user.id),
        inArray(userSites.status, ['draft', 'published'])
      ))

    if (ownedSites.length === 0) return NextResponse.json({ count: 0 })

    const siteIds = ownedSites.map(s => s.id)

    const [{ total }] = await db
      .select({ total: count() })
      .from(formSubmissions)
      .where(and(
        inArray(formSubmissions.userSiteId, siteIds),
        isNull(formSubmissions.readAt),
        isNull(formSubmissions.archivedAt),
        eq(formSubmissions.isSpam, false)
      ))

    return NextResponse.json({ count: total })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
