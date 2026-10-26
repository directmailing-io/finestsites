/**
 * GET    /api/admin/news/[id] — eine Neuigkeit mit Statistik
 * PUT    /api/admin/news/[id] — ändern (Body = NewsAdminInput; nach Push bleiben pushTitle/pushBody fest)
 * DELETE /api/admin/news/[id] — nur Entwürfe (409 sonst)
 */
import { NewsAdminInput, newsInputErrors } from '@/lib/news/admin-schema'
import { isUuid, jsonError, jsonOk, newsErrorResponse, requireNewsAdmin } from '@/lib/news/http'
import { deleteDraft, getAdmin, updateDraft } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Ctx) {
  const auth = await requireNewsAdmin(req)
  if (auth.response) return auth.response
  const { id } = await params
  if (!isUuid(id)) return jsonError('Neuigkeit nicht gefunden.', 404)
  try {
    const item = await getAdmin(id)
    if (!item) return jsonError('Neuigkeit nicht gefunden.', 404)
    return jsonOk(item)
  } catch (err) {
    return newsErrorResponse(err, 'GET /api/admin/news/[id]')
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const auth = await requireNewsAdmin(req)
  if (auth.response) return auth.response
  const { id } = await params
  if (!isUuid(id)) return jsonError('Neuigkeit nicht gefunden.', 404)
  const raw = await req.json().catch(() => null)
  const parsed = NewsAdminInput.safeParse(raw)
  if (!parsed.success) { const e = newsInputErrors(parsed.error); return jsonError(e.error, 400, { fields: e.fields }) }
  try {
    return jsonOk(await updateDraft(id, parsed.data))
  } catch (err) {
    return newsErrorResponse(err, 'PUT /api/admin/news/[id]')
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireNewsAdmin(req)
  if (auth.response) return auth.response
  const { id } = await params
  if (!isUuid(id)) return jsonError('Neuigkeit nicht gefunden.', 404)
  try {
    await deleteDraft(id)
    return jsonOk({ ok: true })
  } catch (err) {
    return newsErrorResponse(err, 'DELETE /api/admin/news/[id]')
  }
}
