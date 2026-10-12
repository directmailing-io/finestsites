import { db } from '@/lib/db'
import { userSites, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/** Eigene Seite – oder jede Seite, wenn der Aufrufer Admin ist (z. B. Domain-Verbindung als Service). */
export async function siteWhereForUser(siteId: string, userId: string) {
  const me = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { isAdmin: true } })
  return me?.isAdmin ? eq(userSites.id, siteId) : and(eq(userSites.id, siteId), eq(userSites.userId, userId))
}
