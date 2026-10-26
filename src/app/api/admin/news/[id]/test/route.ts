/**
 * POST /api/admin/news/[id]/test — Testpush nur an die Geräte des angemeldeten Admins.
 * Antwort { devices, result }; devices = 0 → „Du hast kein Gerät mit Push angemeldet“. Veröffentlicht nichts.
 */
import { isUuid, jsonError, jsonOk, newsErrorResponse, requireNewsAdmin } from '@/lib/news/http'
import { sendTest } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNewsAdmin(req)
  if (auth.response) return auth.response
  const { id } = await params
  if (!isUuid(id)) return jsonError('Neuigkeit nicht gefunden.', 404)
  try {
    return jsonOk(await sendTest(id, auth.user.id))
  } catch (err) {
    return newsErrorResponse(err, 'POST /api/admin/news/[id]/test')
  }
}
