/**
 * Besucher-Nachrichten (Widget: /.finestsites/chat/messages)
 *
 * GET  ?after=<messageId>  Polling → { messages, status, ownerLastSeenAt, ownerReadAt }; setzt visitor_last_seen_at
 * POST { body, clientId?, pageUrl? } → { message, conversationId }
 *      Erste Nachricht ohne bekanntes Gespräch legt eines an (Token Pflicht).
 *      422 MESSAGE_REJECTED (Filter), 429 RATE_LIMITED, 403 BLOCKED, 400 TOKEN_REQUIRED
 */
import type { NextRequest } from 'next/server'
import { resolveVisitor, visitorError, visitorJson } from '@/lib/chat/visitor'
import {
  createConversation, findConversationByToken, findMessageByClientId, listMessages, ownerReadAtOf, pathOf, recentBodies, recordMessage,
  toContractMessage, touchVisitorSeen,
} from '@/lib/chat/service'
import { checkChatMessage, CHAT_REJECT_MESSAGE } from '@/lib/chat/filter'
import { allowNewConversation, checkMessageRate } from '@/lib/chat/rate-limit'
import { pushTriggers } from '@/lib/push/triggers'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const r = await resolveVisitor(req)
  if (!r.ok) return r.response
  const { h, site } = r.ctx
  if (!h.tokenHash) return visitorJson({ messages: [], status: null, ownerLastSeenAt: null, ownerReadAt: null })

  const conv = await findConversationByToken(site.siteId, h.tokenHash)
  if (!conv) return visitorJson({ messages: [], status: null, ownerLastSeenAt: null, ownerReadAt: null })
  if (conv.status === 'blocked') return visitorError('BLOCKED', 403)

  const afterRaw = req.nextUrl.searchParams.get('after') ?? ''
  const after = UUID_RE.test(afterRaw) ? afterRaw : undefined
  const [{ messages }, ownerReadAt] = await Promise.all([
    listMessages(conv.id, after ? { after, limit: 100 } : { limit: 50 }),
    ownerReadAtOf(conv.id),
    touchVisitorSeen(conv.id),
  ])
  return visitorJson({
    messages: messages.map(m => toContractMessage(m, 'visitor')),
    status: conv.status,
    ownerLastSeenAt: conv.ownerLastSeenAt?.toISOString() ?? null,
    ownerReadAt,
  })
}

export async function POST(req: NextRequest) {
  const r = await resolveVisitor(req)
  if (!r.ok) return r.response
  const { h, site } = r.ctx
  if (!h.tokenHash) return visitorError('TOKEN_REQUIRED', 400)

  let body: { body?: unknown; clientId?: unknown; pageUrl?: unknown } = {}
  try { body = await req.json() } catch { body = {} }
  if (typeof body.body !== 'string') return visitorError('VALIDATION_FAILED', 400)
  const clientId = typeof body.clientId === 'string' && body.clientId.length > 0 && body.clientId.length <= 64 ? body.clientId : null

  let conv = await findConversationByToken(site.siteId, h.tokenHash)
  if (conv?.status === 'blocked') return visitorError('BLOCKED', 403)

  // Idempotenz: dieselbe clientId liefert dieselbe Nachricht (vor Filter und Ratenbremse)
  if (conv && clientId) {
    const dup = await findMessageByClientId(conv.id, 'visitor', clientId)
    if (dup) return visitorJson({ message: toContractMessage(dup, 'visitor'), conversationId: conv.id })
  }

  // Filter VOR dem Anlegen eines Gesprächs (kein leeres Gespräch durch abgelehnte Nachrichten)
  const recent = conv ? await recentBodies(conv.id, 'visitor') : []
  const check = checkChatMessage(body.body, recent)
  if (!check.ok) return visitorError('MESSAGE_REJECTED', 422, { message: CHAT_REJECT_MESSAGE })

  if (!conv) {
    if (!allowNewConversation(h.ipHash)) return visitorError('RATE_LIMITED', 429)
    conv = await createConversation({
      siteId: site.siteId,
      userId: site.userId,
      tokenHash: h.tokenHash,
      ipHash: h.ipHash,
      userAgent: h.userAgent,
      startedOnPath: pathOf(body.pageUrl),
    })
  } else {
    const rate = await checkMessageRate(conv.id, 'visitor')
    if (rate !== 'ok') return visitorError('RATE_LIMITED', 429)
  }

  const { message, created } = await recordMessage(conv, 'visitor', check.body, clientId)
  if (created) void pushTriggers.newChatMessage(conv.id)
  return visitorJson({ message: toContractMessage(message, 'visitor'), conversationId: conv.id })
}
