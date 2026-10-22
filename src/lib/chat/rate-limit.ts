/**
 * Ratenbegrenzung des Besucher-Chats (docs/chat/konzept.md):
 *   - je IP-Hash 60 Anfragen/Minute                     (In-Memory, je Prozess)
 *   - Gesprächs-Anlagen je IP-Hash 10/Stunde             (In-Memory, je Prozess)
 *   - Nachrichten je Gespräch 20 pro 10 Minuten          (DB, damit beide PM2-Prozesse dasselbe sehen)
 *   - Gesprächs-Code-Eingaben je IP-Hash 5 pro 10 Minuten (In-Memory, je Prozess)
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
  /** Aufrufe ohne Besucher-Token je IP-Hash und Minute (config, erster session-Aufruf) */
  requestsPerMinutePerIp: 60,
  /** Aufrufe je Besucher-Token und Minute (Polling 3 s = 20/min; zwei Tabs = 40) */
  requestsPerMinutePerToken: 120,
  /** Obergrenze je IP-Hash und Minute auch mit Token (Mobilfunk teilt IPs: CGNAT) */
  requestsPerMinutePerIpWithToken: 600,
  sessionsPerHourPerIp: 10,
  /** Neue Gespräche je Webseite: Schutz des Betreibers vor Fluten (Spam-Schutz) */
  newConversationsPerHourPerSite: 30,
  newConversationsPerDayPerSite: 150,
  /** Abgelehnte Nachrichten (Filter) je Besucher-Token in 10 min, danach automatische Sperre */
  rejectionsBeforeAutoBlock: 5,
  messagesPerWindow: 20,
  /** Nachrichten je Gespräch in 10 min, wenn der Browser sich als Automatisierung meldet (navigator.webdriver) */
  messagesPerWindowAutomation: 5,
  messageWindowMs: 10 * 60_000,
  minIntervalMs: 1_500,
  /** Gesprächs-Code-Eingaben je IP-Hash in 10 min (8 Zeichen aus 31 → Raten aussichtslos, niemand wird ausgesperrt) */
  resumeCodeAttemptsPer10Min: 5,
} as const

/**
 * Allgemeine Bremse: mit Besucher-Token zählt vor allem der Token (Polling), die IP nur grob
 * (Mobilfunk-NAT teilt eine IP unter vielen Nutzern); ohne Token streng je IP.
 */
export function allowVisitorRequest(ipHash: string | null, tokenHash: string | null = null): boolean {
  if (tokenHash) {
    return rateLimit('chat-token', tokenHash, CHAT_LIMITS.requestsPerMinutePerToken, 60_000)
      && rateLimit('chat-ip-t', ipHash, CHAT_LIMITS.requestsPerMinutePerIpWithToken, 60_000)
  }
  return rateLimit('chat-ip', ipHash, CHAT_LIMITS.requestsPerMinutePerIp, 60_000)
}

/** Neue Gespräche je Webseite (Stunde + Tag) – je Prozess gezählt, also real bis zu 2× so viel. */
export function allowNewConversationForSite(siteId: string): boolean {
  return rateLimit('chat-site-h', siteId, CHAT_LIMITS.newConversationsPerHourPerSite, 3_600_000)
    && rateLimit('chat-site-d', siteId, CHAT_LIMITS.newConversationsPerDayPerSite, 86_400_000)
}

/** Zählt eine vom Filter abgelehnte Nachricht; true = Grenze erreicht → Besucher automatisch sperren. */
export function countRejection(tokenHash: string): boolean {
  return !rateLimit('chat-reject', tokenHash, CHAT_LIMITS.rejectionsBeforeAutoBlock, 10 * 60_000)
}

/** Eingaben des Gesprächs-Codes je IP-Hash (jeder Versuch zählt, auch der richtige). */
export function allowResumeCodeAttempt(ipHash: string | null): boolean {
  return rateLimit('chat-code', ipHash, CHAT_LIMITS.resumeCodeAttemptsPer10Min, 10 * 60_000)
}

/** Neue Gespräche je IP-Hash. */
export function allowNewConversation(ipHash: string | null): boolean {
  return rateLimit('chat-session', ipHash, CHAT_LIMITS.sessionsPerHourPerIp, 3_600_000)
}

export type MessageRateResult = 'ok' | 'too_many' | 'too_fast'

/** Nachrichten-Takt je Gespräch und Absender (Datenbank). */
export async function checkMessageRate(conversationId: string, sender: 'visitor' | 'owner', opts: { automation?: boolean } = {}): Promise<MessageRateResult> {
  const since = new Date(Date.now() - CHAT_LIMITS.messageWindowMs)
  const maxMessages = opts.automation ? CHAT_LIMITS.messagesPerWindowAutomation : CHAT_LIMITS.messagesPerWindow
  const [[cnt], [last]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(chatMessages)
      .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.sender, sender), gt(chatMessages.createdAt, since))),
    db.select({ createdAt: chatMessages.createdAt }).from(chatMessages)
      .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.sender, sender)))
      .orderBy(desc(chatMessages.createdAt)).limit(1),
  ])
  if ((cnt?.n ?? 0) >= maxMessages) return 'too_many'
  if (last && Date.now() - last.createdAt.getTime() < CHAT_LIMITS.minIntervalMs) return 'too_fast'
  return 'ok'
}
