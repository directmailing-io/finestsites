/**
 * GET  /api/admin/news — alle Neuigkeiten mit Statistik (pushQueued, readCount, ctaCount, dismissedCount)
 * POST /api/admin/news — Entwurf anlegen (Body = NewsAdminInput, deutsche Feldfehler in `fields`)
 */
import { NewsAdminInput, newsInputErrors } from '@/lib/news/admin-schema'
import { jsonError, jsonOk, newsErrorResponse, requireNewsAdmin } from '@/lib/news/http'
import { createDraft, listAdmin } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireNewsAdmin(req)
  if (auth.response) return auth.response
  try {
    return jsonOk({ items: await listAdmin() })
  } catch (err) {
    return newsErrorResponse(err, 'GET /api/admin/news')
  }
}

export async function POST(req: Request) {
  const auth = await requireNewsAdmin(req)
  if (auth.response) return auth.response
  const raw = await req.json().catch(() => null)
  const parsed = NewsAdminInput.safeParse(raw)
  if (!parsed.success) { const e = newsInputErrors(parsed.error); return jsonError(e.error, 400, { fields: e.fields }) }
  try {
    return jsonOk(await createDraft(parsed.data, auth.user.id), 201)
  } catch (err) {
    return newsErrorResponse(err, 'POST /api/admin/news')
  }
}
