/**
 * GET /api/app/v1/notifications?limit=20&before=<ISO> — Mitteilungs-Postfach (user_notifications),
 * neueste zuerst, Seite für Seite über `nextCursor`.
 */
import { db } from '@/lib/db'
import { userNotifications } from '@/lib/db/schema'
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm'
import { appError, appJson, requireAppUser, toIso } from '@/lib/app-api/http'
import { NotificationsQuery, NotificationsResponse } from '@/lib/contracts/app-v1/notifications'
import { syncNotificationReads } from '@/lib/push/notification-sync'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireAppUser(req, 'notifications')
  if (auth.response) return auth.response
  const userId = auth.user.id

  const sp = new URL(req.url).searchParams
  const q = NotificationsQuery.safeParse({ limit: sp.get('limit') ?? undefined, before: sp.get('before') ?? undefined })
  if (!q.success) return appError('VALIDATION_FAILED')
  const { limit, before } = q.data

  const where = before
    ? and(eq(userNotifications.userId, userId), lt(userNotifications.createdAt, new Date(before)))
    : eq(userNotifications.userId, userId)

  await syncNotificationReads(userId)
  const [rows, unread] = await Promise.all([
    db.select().from(userNotifications).where(where).orderBy(desc(userNotifications.createdAt)).limit(limit + 1),
    db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(userNotifications)
      .where(and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt))),
  ])

  const page = rows.slice(0, limit)
  return appJson(NotificationsResponse, {
    items: page.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      data: (n.data && typeof n.data === 'object' && !Array.isArray(n.data) ? n.data : {}) as Record<string, unknown>,
      readAt: toIso(n.readAt),
      createdAt: toIso(n.createdAt)!,
    })),
    unreadCount: unread[0]?.n ?? 0,
    nextCursor: rows.length > limit ? toIso(page[page.length - 1].createdAt) : null,
  })
}
