/**
 * POST /api/worker/chat/session  (Widget: POST /.finestsites/chat/session)
 * Body { visitorToken?, resumeToken?, pageUrl? }
 * → { enabled, ticket, conversationId, visitorToken, status, visitor:{name,email,phone,notifyByEmail}, messages:[…letzte 50], ownerLastSeenAt, ownerReadAt, resumeCode }
 *   ticket: Pflicht-Header X-FS-Ticket für messages/profile/handoff/read (2 h, src/lib/chat/ticket.ts)
 *
 * Ohne Token (oder ohne bekanntes Gespräch) nur enabled + leere Felder – ein Gespräch entsteht erst
 * mit der ersten Nachricht (POST messages). Ein gültiger resumeToken (Antwort-Mail) übernimmt das
 * Gespräch für den neuen visitorToken und ist danach verbraucht.
 */
import type { NextRequest } from 'next/server'
import { conversationState, resolveVisitor, visitorError, visitorJson } from '@/lib/chat/visitor'
import {
  addSystemMessage, consumeResumeToken, DEVICE_ADDED_TEXT, findConversationByToken, isValidVisitorToken, sha256,
  type ConversationState,
} from '@/lib/chat/service'
import type { ChatConversationRow } from '@/lib/db/schema'
import { issueTicket } from '@/lib/chat/ticket'

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
    const used = await consumeResumeToken(resumeToken, site.siteId, tokenHash)
    conv = used?.conv ?? null
    // Neuer Browser am Gespräch → Hinweiszeile für beide Seiten (wie beim Gesprächs-Code)
    if (used?.attached && used.conv.status !== 'blocked') await addSystemMessage(used.conv.id, DEVICE_ADDED_TEXT)
    // Verbrauchter/abgelaufener Link, aber dieser Browser kennt das Gespräch schon (z. B. Link zweimal geöffnet)
    if (!conv) conv = await findConversationByToken(site.siteId, tokenHash)
    if (!conv) return visitorError('RESUME_INVALID', 410)
  } else if (tokenHash) {
    conv = await findConversationByToken(site.siteId, tokenHash)
  }

  if (!conv) {
    return visitorJson({
      enabled: true, ticket: issueTicket(site.siteId), conversationId: null, visitorToken, status: null, visitor: null, messages: [], ownerLastSeenAt: null, ownerReadAt: null, resumeCode: null,
    } satisfies ConversationState)
  }
  if (conv.status === 'blocked') return visitorError('BLOCKED', 403)

  return visitorJson(await conversationState(conv, site.siteId, visitorToken))
}
