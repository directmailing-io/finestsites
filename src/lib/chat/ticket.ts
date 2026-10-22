/**
 * Ticket-Handshake des Besucher-Chats (Spam-Schutz, docs/chat/konzept.md):
 * `POST session` gibt ein Ticket aus, das bei allen schreibenden Besucher-Aufrufen (messages, profile,
 * handoff, read) als Header `X-FS-Ticket` mitkommen muss. Skripte, die direkt auf `messages` feuern,
 * scheitern mit 403 TICKET_REQUIRED; der Handshake ist dadurch der Ort für Ratenbremsen.
 *
 * Aufbau: base64url(siteId:expiresAt:random) + '.' + HMAC-SHA256 (Schlüssel aus WORKER_SECRET).
 * Nicht an die IP gebunden (Mobilfunk wechselt IPs), 2 Stunden gültig, zustandslos.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const TICKET_TTL_MS = 2 * 60 * 60_000

function key(): Buffer {
  const secret = process.env.WORKER_SECRET || ''
  return createHmac('sha256', 'finestsites-chat-ticket').update(secret).digest()
}

function sign(payload: string): string {
  return createHmac('sha256', key()).update(payload).digest('base64url')
}

export function issueTicket(siteId: string, now = Date.now()): string {
  const payload = Buffer.from(`${siteId}:${now + TICKET_TTL_MS}:${randomBytes(6).toString('base64url')}`).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export type TicketCheck = 'ok' | 'missing' | 'invalid' | 'expired'

export function verifyTicket(raw: string | null | undefined, siteId: string, now = Date.now()): TicketCheck {
  if (!raw) return 'missing'
  const dot = raw.indexOf('.')
  if (dot <= 0 || raw.length > 400) return 'invalid'
  const payload = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const expected = sign(payload)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return 'invalid'
  let decoded = ''
  try { decoded = Buffer.from(payload, 'base64url').toString('utf8') } catch { return 'invalid' }
  const [tSite, tExp] = decoded.split(':')
  if (tSite !== siteId) return 'invalid'
  const exp = Number(tExp)
  if (!Number.isFinite(exp)) return 'invalid'
  if (exp < now) return 'expired'
  return 'ok'
}
