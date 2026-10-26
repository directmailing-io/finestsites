/**
 * GET /api/news/[id] — eine Neuigkeit (NewsDetailResponse); 404 auch bei falscher Audience oder nicht veröffentlicht.
 */
import { NewsDetailResponse } from '@/lib/contracts/app-v1/news'
import { isUuid, jsonError, jsonOk, newsErrorResponse, requireWebUser } from '@/lib/news/http'
import { getForUser } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWebUser(req)
  if (auth.response) return auth.response
  const { id } = await params
  if (!isUuid(id)) return jsonError('Neuigkeit nicht gefunden.', 404)
  try {
    const item = await getForUser(auth.user.id, id, { plan: auth.user.plan })
    if (!item) return jsonError('Neuigkeit nicht gefunden.', 404)
    return jsonOk(NewsDetailResponse.parse(item))
  } catch (err) {
    return newsErrorResponse(err, 'GET /api/news/[id]')
  }
}
