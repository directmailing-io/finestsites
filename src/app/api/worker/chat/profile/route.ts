/**
 * POST /api/worker/chat/profile  (Widget: POST /.finestsites/chat/profile)
 * Body { name?, email?, phone?, notifyByEmail? } (alle freiwillig; leerer String = löschen)
 * → { visitor:{ name, email, phone, notifyByEmail } }; 422 VALIDATION_FAILED bei ungültiger E-Mail/Telefon.
 * notifyByEmail ist nur mit hinterlegter E-Mail möglich.
 */
import type { NextRequest } from 'next/server'
import { resolveVisitor, visitorError, visitorJson } from '@/lib/chat/visitor'
import { findConversationByToken, updateVisitorProfile } from '@/lib/chat/service'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^[+0-9 \-]{3,30}$/

export async function POST(req: NextRequest) {
  const r = await resolveVisitor(req)
  if (!r.ok) return r.response
  const { h, site } = r.ctx
  if (!h.tokenHash) return visitorError('TOKEN_REQUIRED', 400)
  const conv = await findConversationByToken(site.siteId, h.tokenHash)
  if (!conv) return visitorError('not_found', 404)
  if (conv.status === 'blocked') return visitorError('BLOCKED', 403)

  let body: { name?: unknown; email?: unknown; phone?: unknown; notifyByEmail?: unknown } = {}
  try { body = await req.json() } catch { body = {} }

  const patch: { name?: string | null; email?: string | null; phone?: string | null; notifyByEmail?: boolean } = {}
  const fields: Record<string, string> = {}

  if (body.name !== undefined) {
    if (body.name !== null && typeof body.name !== 'string') fields.name = 'ungültig'
    else {
      const v = (body.name ?? '').toString().replace(/\s+/g, ' ').trim()
      if (v.length > 80) fields.name = 'zu lang'
      else patch.name = v || null
    }
  }
  if (body.email !== undefined) {
    if (body.email !== null && typeof body.email !== 'string') fields.email = 'ungültig'
    else {
      const v = (body.email ?? '').toString().trim().toLowerCase()
      if (v && (v.length > 200 || !EMAIL_RE.test(v))) fields.email = 'ungültig'
      else patch.email = v || null
    }
  }
  if (body.phone !== undefined) {
    if (body.phone !== null && typeof body.phone !== 'string') fields.phone = 'ungültig'
    else {
      const v = (body.phone ?? '').toString().trim()
      if (v && !PHONE_RE.test(v)) fields.phone = 'ungültig'
      else patch.phone = v || null
    }
  }
  if (body.notifyByEmail !== undefined) {
    if (typeof body.notifyByEmail !== 'boolean') fields.notifyByEmail = 'ungültig'
    else patch.notifyByEmail = body.notifyByEmail
  }
  if (Object.keys(fields).length > 0) return visitorError('VALIDATION_FAILED', 422, { fields })

  // Benachrichtigung nur mit E-Mail; neue E-Mail ohne ausdrückliche Angabe → an (Konzept: Standard an)
  const email = patch.email !== undefined ? patch.email : conv.visitorEmail
  if (!email) patch.notifyByEmail = false
  else if (patch.email && patch.email !== conv.visitorEmail && patch.notifyByEmail === undefined) patch.notifyByEmail = true

  const updated = await updateVisitorProfile(conv.id, patch)
  if (!updated) return visitorError('not_found', 404)
  return visitorJson({
    visitor: { name: updated.visitorName, email: updated.visitorEmail, phone: updated.visitorPhone, notifyByEmail: updated.notifyByEmail },
  })
}
