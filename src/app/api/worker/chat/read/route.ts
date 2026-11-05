/**
 * POST /api/worker/chat/read  (Widget: POST /.finestsites/chat/read)
 * Betreiber-Nachrichten als vom Besucher gelesen markieren → { ok:true }
 */
import type { NextRequest } from 'next/server'
import { resolveVisitor, visitorJson } from '@/lib/chat/visitor'
import { findConversationByToken, markReadByVisitor } from '@/lib/chat/service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const r = await resolveVisitor(req, { requireTicket: true })
  if (!r.ok) return r.response
  const { h, site } = r.ctx
  if (!h.tokenHash) return visitorJson({ ok: true })
  const conv = await findConversationByToken(site.siteId, h.tokenHash)
  if (!conv) return visitorJson({ ok: true })
  // Gesperrt: unauffällig ok, ohne Lesestatus für den Betreiber
  if (conv.status === 'blocked') return visitorJson({ ok: true })
  await markReadByVisitor(conv.id)
  return visitorJson({ ok: true })
}
