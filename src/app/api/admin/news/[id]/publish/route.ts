/**
 * POST /api/admin/news/[id]/publish — Body { push: boolean }.
 * Mit Push: 409 NEWS_PUSH_LIMIT, wenn heute (Europe/Berlin) schon eine Neuigkeit mit Push veröffentlicht wurde.
 */
import { z } from 'zod'
import { isUuid, jsonError, jsonOk, newsErrorResponse, requireNewsAdmin } from '@/lib/news/http'
import { publish } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

const Body = z.object({ push: z.boolean() }).strict()

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNewsAdmin(req)
  if (auth.response) return auth.response
  const { id } = await params
  if (!isUuid(id)) return jsonError('Neuigkeit nicht gefunden.', 404)
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return jsonError('Bitte angeben, ob mit oder ohne Push-Mitteilung veröffentlicht wird.', 400)
  try {
    return jsonOk(await publish(id, { push: parsed.data.push }, auth.user.id))
  } catch (err) {
    return newsErrorResponse(err, 'POST /api/admin/news/[id]/publish')
  }
}
