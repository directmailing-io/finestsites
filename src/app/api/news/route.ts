/**
 * GET /api/news — Neuigkeiten für den angemeldeten Web-Nutzer (Sitzungs-Cookie), gleiche Form wie
 * /api/app/v1/news (NewsListResponse): neueste zuerst, höchstens 50, plus Ungelesen-Zähler.
 */
import { NewsListResponse } from '@/lib/contracts/app-v1/news'
import { jsonOk, newsErrorResponse, requireWebUser } from '@/lib/news/http'
import { listForUser } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireWebUser(req)
  if (auth.response) return auth.response
  try {
    return jsonOk(NewsListResponse.parse(await listForUser(auth.user.id, { plan: auth.user.plan })))
  } catch (err) {
    return newsErrorResponse(err, 'GET /api/news')
  }
}
