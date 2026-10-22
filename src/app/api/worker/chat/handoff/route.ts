/**
 * POST /api/worker/chat/handoff  (Widget: POST /.finestsites/chat/handoff)
 *
 * Übergabe eines Gesprächs in einen anderen Browser (Instagram-/Facebook-In-App-Browser → Safari/Chrome,
 * Desktop → Handy). Nur mit bestehendem Gespräch (Besucher-Token). docs/chat/konzept.md.
 *
 *   { via: 'link',  pageUrl? } → 200 { url: 'https://<host><pfad>?fs_chat=<token>', expiresAt }
 *   { via: 'email' }           → 200 { ok: true }   (Link an die hinterlegte Besucher-E-Mail)
 *
 * Fehler: 400 TOKEN_REQUIRED | VALIDATION_FAILED | NO_EMAIL, 403 BLOCKED, 404 NO_CONVERSATION,
 *         429 RATE_LIMITED (Links: 20/h je IP-Hash; Mails: HANDOFF_MAILS_PER_DAY je Gespräch), 502 MAIL_FAILED.
 * Der Token ist 7 Tage gültig und einmal einlösbar (session mit resumeToken); der einlösende Browser wird
 * als weiterer Zugang angehängt, der bisherige behält seinen.
 */
import type { NextRequest } from 'next/server'
import { resolveVisitor, visitorError, visitorJson } from '@/lib/chat/visitor'
import {
  countHandoffMails, createResumeToken, findConversationByToken, HANDOFF_MAILS_PER_DAY, HANDOFF_TOKEN_DAYS, handoffUrl,
  ownerNameOf, pathOf, siteHostOf,
} from '@/lib/chat/service'
import { sendHandoffMail } from '@/lib/chat/notify'
import { rateLimit } from '@/lib/security/request'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const r = await resolveVisitor(req)
  if (!r.ok) return r.response
  const { h, site } = r.ctx
  if (!h.tokenHash) return visitorError('TOKEN_REQUIRED', 400)

  let body: { via?: unknown; pageUrl?: unknown } = {}
  try { body = await req.json() } catch { body = {} }
  const via = body.via === 'email' ? 'email' : body.via === 'link' ? 'link' : null
  if (!via) return visitorError('VALIDATION_FAILED', 400)

  const conv = await findConversationByToken(site.siteId, h.tokenHash)
  if (!conv) return visitorError('NO_CONVERSATION', 404)
  if (conv.status === 'blocked') return visitorError('BLOCKED', 403)

  // Der Link zeigt auf die Seite, auf der der Besucher gerade ist (Host vom Worker geprüft), sonst Standard-Host
  const host = h.host || siteHostOf(site)

  if (via === 'link') {
    if (!rateLimit('chat-handoff', h.ipHash, 20, 3_600_000)) return visitorError('RATE_LIMITED', 429)
    const token = await createResumeToken(conv.id, 'handoff')
    return visitorJson({
      url: handoffUrl(host, pathOf(body.pageUrl), token),
      expiresAt: new Date(Date.now() + HANDOFF_TOKEN_DAYS * 86_400_000).toISOString(),
    })
  }

  const email = conv.visitorEmail?.trim()
  if (!email) return visitorError('NO_EMAIL', 400)
  if ((await countHandoffMails(conv.id)) >= HANDOFF_MAILS_PER_DAY) return visitorError('RATE_LIMITED', 429)
  const token = await createResumeToken(conv.id, 'handoff_mail')
  const result = await sendHandoffMail({
    conversationId: conv.id,
    to: email,
    ownerName: ownerNameOf(site),
    siteHost: host,
    openUrl: handoffUrl(host, pathOf(body.pageUrl) ?? '/', token),
  })
  if (result !== 'sent') return visitorError('MAIL_FAILED', 502)
  return visitorJson({ ok: true })
}
