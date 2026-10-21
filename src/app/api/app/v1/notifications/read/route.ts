/**
 * POST /api/app/v1/notifications/read — { ids: uuid[] } oder { all: true } als gelesen markieren.
 */
import { db } from '@/lib/db'
import { userNotifications } from '@/lib/db/schema'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { appJson, readJson, requireAppUser } from '@/lib/app-api/http'
import { MarkReadRequest, MarkReadResponse } from '@/lib/contracts/app-v1/notifications'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireAppUser(req, 'notifications-read', 60)
  if (auth.response) return auth.response
  const userId = auth.user.id

  const body = await readJson(req, MarkReadRequest)
  if (body.response) return body.response

  const scope = 'ids' in body.data
    ? and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt), inArray(userNotifications.id, body.data.ids))
    : and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt))

  const updated = await db.update(userNotifications).set({ readAt: new Date() }).where(scope).returning({ id: userNotifications.id })
  const [unread] = await db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(userNotifications)
    .where(and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt)))

  return appJson(MarkReadResponse, { updated: updated.length, unreadCount: unread?.n ?? 0 })
}
