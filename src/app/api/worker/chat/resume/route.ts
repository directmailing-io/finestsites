/**
 * POST /api/worker/chat/resume  (Widget: POST /.finestsites/chat/resume, „Gespräch fortsetzen“)
 * Body { code, visitorToken? } → ConversationState wie `session` (Gespräch, Nachrichten, Ticket, resumeCode)
 *
 * Der Besucher gibt den Gesprächs-Code ein („7K4M-2P9X“, Groß-/Kleinschreibung und Bindestrich egal); dieser
 * Browser wird als weiterer Zugang an das Gespräch gehängt (chat_visitor_tokens) – andere Browser behalten
 * ihren. Der Code bleibt gültig (nicht einmalig), bis 90 Tage nach der letzten Nachricht.
 *
 * Fehler: 400 TOKEN_REQUIRED | VALIDATION_FAILED (kein 8-stelliger Code), 403 BLOCKED | TICKET_*,
 *         404 CODE_INVALID (unbekannt auf dieser Seite), 410 CODE_EXPIRED, 429 RATE_LIMITED (5 Eingaben/10 min je IP).
 * Jeder Versuch zählt – 31^8 Möglichkeiten je Seite machen Raten aussichtslos, ohne dass echte Besucher
 * ausgesperrt werden. Fehlversuche verraten nicht, ob ein Gespräch existiert (immer 404).
 */
import type { NextRequest } from 'next/server'
import { conversationState, resolveVisitor, visitorError, visitorJson } from '@/lib/chat/visitor'
import { allowResumeCodeAttempt } from '@/lib/chat/rate-limit'
import {
  addSystemMessage, attachVisitorToken, DEVICE_ADDED_TEXT, findConversationByResumeCode, isResumeCodeValid, isValidVisitorToken,
  normalizeResumeCode, sha256,
} from '@/lib/chat/service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const r = await resolveVisitor(req, { requireTicket: true })
  if (!r.ok) return r.response
  const { h, site } = r.ctx

  let body: { code?: unknown; visitorToken?: unknown } = {}
  try { body = await req.json() } catch { body = {} }

  const visitorToken = h.visitorToken ?? (isValidVisitorToken(body.visitorToken) ? body.visitorToken : null)
  if (!visitorToken) return visitorError('TOKEN_REQUIRED', 400)
  const code = normalizeResumeCode(body.code)
  if (!code) return visitorError('VALIDATION_FAILED', 400)
  if (!allowResumeCodeAttempt(h.ipHash)) return visitorError('RATE_LIMITED', 429)

  const conv = await findConversationByResumeCode(site.siteId, code)
  if (!conv) return visitorError('CODE_INVALID', 404)
  if (conv.status === 'blocked') return visitorError('BLOCKED', 403)
  if (!isResumeCodeValid(conv)) return visitorError('CODE_EXPIRED', 410)

  const attached = await attachVisitorToken(conv, sha256(visitorToken))
  if (attached) await addSystemMessage(conv.id, DEVICE_ADDED_TEXT)
  return visitorJson(await conversationState(conv, site.siteId, visitorToken))
}
