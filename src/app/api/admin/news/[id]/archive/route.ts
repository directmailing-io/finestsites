/**
 * POST /api/admin/news/[id]/archive — veröffentlichte Neuigkeit verstecken (sofort in Web und App).
 */
import { isUuid, jsonError, jsonOk, newsErrorResponse, requireNewsAdmin } from '@/lib/news/http'
import { archive } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNewsAdmin(req)
  if (auth.response) return auth.response
  const { id } = await params
  if (!isUuid(id)) return jsonError('Neuigkeit nicht gefunden.', 404)
  try {
    return jsonOk(await archive(id))
  } catch (err) {
    return newsErrorResponse(err, 'POST /api/admin/news/[id]/archive')
  }
}
