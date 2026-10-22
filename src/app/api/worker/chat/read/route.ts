/**
 * POST /api/worker/chat/read  (Widget: POST /.finestsites/chat/read)
 * Betreiber-Nachrichten als vom Besucher gelesen markieren → { ok:true }
 */
import type { NextRequest } from 'next/server'
import { resolveVisitor, visitorError, visitorJson } from '@/lib/chat/visitor'
import { findConversationByToken, markReadByVisitor } from '@/lib/chat/service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const r = await resolveVisitor(req)
  if (!r.ok) return r.response
  const { h, site } = r.ctx
  if (!h.tokenHash) return visitorJson({ ok: true })
  const conv = await findConversationByToken(site.siteId, h.tokenHash)
  if (!conv) return visitorJson({ ok: true })
  if (conv.status === 'blocked') return visitorError('BLOCKED', 403)
  await markReadByVisitor(conv.id)
  return visitorJson({ ok: true })
}
