/**
 * POST /api/worker/chat/session  (Widget: POST /.finestsites/chat/session)
 * Body { visitorToken?, resumeToken?, pageUrl? }
 * → { enabled, conversationId, visitorToken, status, visitor:{name,email,phone,notifyByEmail}, messages:[…letzte 50], ownerLastSeenAt }
 *
 * Ohne Token (oder ohne bekanntes Gespräch) nur enabled + leere Felder – ein Gespräch entsteht erst
 * mit der ersten Nachricht (POST messages). Ein gültiger resumeToken (Antwort-Mail) übernimmt das
 * Gespräch für den neuen visitorToken und ist danach verbraucht.
 */
import type { NextRequest } from 'next/server'
import { resolveVisitor, visitorError, visitorJson } from '@/lib/chat/visitor'
import {
  consumeResumeToken, findConversationByToken, isValidVisitorToken, listMessages, ownerReadAtOf, sha256, toContractMessage, touchVisitorSeen,
  type ConversationState,
} from '@/lib/chat/service'
import type { ChatConversationRow } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const r = await resolveVisitor(req)
  if (!r.ok) return r.response
  const { h, site } = r.ctx

  let body: { visitorToken?: unknown; resumeToken?: unknown } = {}
  try { body = await req.json() } catch { body = {} }

  const bodyToken = isValidVisitorToken(body.visitorToken) ? body.visitorToken : null
  const visitorToken = h.visitorToken ?? bodyToken
  const tokenHash = visitorToken ? sha256(visitorToken) : null
  const resumeToken = typeof body.resumeToken === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(body.resumeToken) ? body.resumeToken : null

  let conv: ChatConversationRow | null = null
  if (resumeToken) {
    if (!tokenHash) return visitorError('TOKEN_REQUIRED', 400)
    conv = await consumeResumeToken(resumeToken, site.siteId, tokenHash)
    if (!conv) return visitorError('RESUME_INVALID', 410)
  } else if (tokenHash) {
    conv = await findConversationByToken(site.siteId, tokenHash)
  }

  if (!conv) {
    return visitorJson({
      enabled: true, conversationId: null, visitorToken, status: null, visitor: null, messages: [], ownerLastSeenAt: null, ownerReadAt: null,
    } satisfies ConversationState)
  }
  if (conv.status === 'blocked') return visitorError('BLOCKED', 403)

  const [{ messages }, ownerReadAt] = await Promise.all([listMessages(conv.id, { limit: 50 }), ownerReadAtOf(conv.id), touchVisitorSeen(conv.id)])
  return visitorJson({
    enabled: true,
    conversationId: conv.id,
    visitorToken,
    status: conv.status,
    visitor: { name: conv.visitorName, email: conv.visitorEmail, phone: conv.visitorPhone, notifyByEmail: conv.notifyByEmail },
    messages: messages.map(m => toContractMessage(m, 'visitor')),
    ownerLastSeenAt: conv.ownerLastSeenAt?.toISOString() ?? null,
    ownerReadAt,
  } satisfies ConversationState)
}
