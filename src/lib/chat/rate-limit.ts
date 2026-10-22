/**
 * Ratenbegrenzung des Besucher-Chats (docs/chat/konzept.md):
 *   - je IP-Hash 60 Anfragen/Minute                     (In-Memory, je Prozess)
 *   - Gesprächs-Anlagen je IP-Hash 10/Stunde             (In-Memory, je Prozess)
 *   - Nachrichten je Gespräch 20 pro 10 Minuten          (DB, damit beide PM2-Prozesse dasselbe sehen)
 *   - frühestens alle 1,5 s eine Nachricht desselben Absenders (DB)
 *
 * Der In-Memory-Limiter ist `rateLimit` aus src/lib/security/request.ts (dasselbe, das
 * requireAppUser benutzt).
 */
import { db } from '@/lib/db'
import { chatMessages } from '@/lib/db/schema'
import { and, desc, eq, gt, sql } from 'drizzle-orm'
import { rateLimit } from '@/lib/security/request'

export const CHAT_LIMITS = {
  requestsPerMinutePerIp: 60,
  sessionsPerHourPerIp: 10,
  messagesPerWindow: 20,
  messageWindowMs: 10 * 60_000,
  minIntervalMs: 1_500,
} as const

/** Allgemeine Bremse je IP-Hash (alle Besucher-Endpunkte). */
export function allowVisitorRequest(ipHash: string | null): boolean {
  return rateLimit('chat-ip', ipHash, CHAT_LIMITS.requestsPerMinutePerIp, 60_000)
}

/** Neue Gespräche je IP-Hash. */
export function allowNewConversation(ipHash: string | null): boolean {
  return rateLimit('chat-session', ipHash, CHAT_LIMITS.sessionsPerHourPerIp, 3_600_000)
}

export type MessageRateResult = 'ok' | 'too_many' | 'too_fast'

/** Nachrichten-Takt je Gespräch und Absender (Datenbank). */
export async function checkMessageRate(conversationId: string, sender: 'visitor' | 'owner'): Promise<MessageRateResult> {
  const since = new Date(Date.now() - CHAT_LIMITS.messageWindowMs)
  const [[cnt], [last]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(chatMessages)
      .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.sender, sender), gt(chatMessages.createdAt, since))),
    db.select({ createdAt: chatMessages.createdAt }).from(chatMessages)
      .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.sender, sender)))
      .orderBy(desc(chatMessages.createdAt)).limit(1),
  ])
  if ((cnt?.n ?? 0) >= CHAT_LIMITS.messagesPerWindow) return 'too_many'
  if (last && Date.now() - last.createdAt.getTime() < CHAT_LIMITS.minIntervalMs) return 'too_fast'
  return 'ok'
}
