/**
 * GET /api/admin/news/[id]/recipients — Reichweite jetzt: { users, devices }
 * (aktives Gerät + Audience-Treffer + keine laufende Löschanfrage).
 */
import { isUuid, jsonError, jsonOk, newsErrorResponse, requireNewsAdmin } from '@/lib/news/http'
import { recipientPreview } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNewsAdmin(req)
  if (auth.response) return auth.response
  const { id } = await params
  if (!isUuid(id)) return jsonError('Neuigkeit nicht gefunden.', 404)
  try {
    return jsonOk(await recipientPreview(id))
  } catch (err) {
    return newsErrorResponse(err, 'GET /api/admin/news/[id]/recipients')
  }
}
