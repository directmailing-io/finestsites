/**
 * GET /api/worker/chat/config  (Widget: GET /.finestsites/chat/config)
 * → { enabled, owner:{ name, avatarUrl, brandColor }, whatsappUrl, welcome, siteHost }
 * Nicht freigeschaltet: 200 { enabled:false }. Gesperrter Besucher: 403 BLOCKED (+ whatsappUrl).
 */
import type { NextRequest } from 'next/server'
import { resolveVisitor, visitorError, visitorJson } from '@/lib/chat/visitor'
import { ownerNameOf, ownerWhatsappUrlOf, siteHostOf, WELCOME_TEXT } from '@/lib/chat/service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const r = await resolveVisitor(req, { allowDisabled: true, allowBlocked: true })
  if (!r.ok) return r.response
  const { site, enabled, blocked } = r.ctx
  if (!enabled) return visitorJson({ enabled: false })
  const whatsappUrl = ownerWhatsappUrlOf(site.publishedData)
  if (blocked) return visitorError('BLOCKED', 403, { whatsappUrl })

  return visitorJson({
    enabled: true,
    owner: {
      name: ownerNameOf(site),
      avatarUrl: site.ownerProfileImageUrl || null,
      brandColor: site.ownerBrandColor || null,
    },
    whatsappUrl,
    welcome: WELCOME_TEXT,
    siteHost: siteHostOf(site),
  })
}
