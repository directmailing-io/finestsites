// Platzhalter – wird durch src/lib/chat/flags.ts des Backends ersetzt
import { readAppSettings } from '@/lib/push/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
export async function isVisitorChatEnabledForUser(userId: string): Promise<boolean> {
  const s = await readAppSettings(['visitor_chat_enabled', 'visitor_chat_users']).catch(() => ({} as Record<string, string>))
  if (!['true', '1', 'on'].includes((s.visitor_chat_enabled ?? '').trim().toLowerCase())) return false
  const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { username: true } })
  const allowed = (s.visitor_chat_users ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
  return !!row?.username && allowed.includes(row.username.toLowerCase())
}
