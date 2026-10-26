/**
 * POST /api/news/[id]/cta — Beim Klick auf den Knopf: cta_clicked_at setzen. Antwort: NewsActionResponse { item, unreadCount }.
 */
import { NewsActionResponse } from '@/lib/contracts/app-v1/news'
import { isUuid, jsonError, jsonOk, newsErrorResponse, requireWebUser } from '@/lib/news/http'
import { markCtaClicked } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWebUser(req)
  if (auth.response) return auth.response
  const { id } = await params
  if (!isUuid(id)) return jsonError('Neuigkeit nicht gefunden.', 404)
  try {
    const result = await markCtaClicked(auth.user.id, id, { plan: auth.user.plan })
    if (!result) return jsonError('Neuigkeit nicht gefunden.', 404)
    return jsonOk(NewsActionResponse.parse(result))
  } catch (err) {
    return newsErrorResponse(err, 'POST /api/news/[id]/cta')
  }
}
