/**
 * Zähler fürs App-Symbol (iOS-Badge) in einer Push-Mitteilung – dieselbe Regel wie die App selbst
 * (mobile/src/app/(tabs)/_layout.tsx: ungelesene Anfragen + Support + Besucher-Chat, Chat nur wenn freigeschaltet)
 * und wie /api/app/v1/overview. Fehler → null (Mitteilung geht ohne Badge raus).
 */
import { db } from '@/lib/db'
import { formSubmissions, supportConversations, userSites } from '@/lib/db/schema'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { isVisitorChatEnabledForUser } from '@/lib/chat/flags'
import { ownerUnread } from '@/lib/chat/service'

export async function badgeCountFor(userId: string): Promise<number | null> {
  try {
    const [subs, support, chatOn] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int`.mapWith(Number) })
        .from(formSubmissions)
        .innerJoin(userSites, eq(formSubmissions.userSiteId, userSites.id))
        .where(and(
          eq(userSites.userId, userId),
          inArray(userSites.status, ['draft', 'published']),
          isNull(formSubmissions.readAt),
          isNull(formSubmissions.archivedAt),
          eq(formSubmissions.isSpam, false),
        )),
      db.select({ n: sql<number>`coalesce(sum(${supportConversations.unreadByUser}), 0)::int`.mapWith(Number) })
        .from(supportConversations)
        .where(and(eq(supportConversations.userId, userId), eq(supportConversations.deletedByUser, false))),
      isVisitorChatEnabledForUser(userId),
    ])
    const chat = chatOn ? (await ownerUnread(userId)).count : 0
    return (subs[0]?.n ?? 0) + (support[0]?.n ?? 0) + chat
  } catch (err) {
    console.error('[push/badge] failed:', err instanceof Error ? err.message : err)
    return null
  }
}
