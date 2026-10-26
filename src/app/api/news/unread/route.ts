/**
 * GET /api/news/unread — nur der Ungelesen-Zähler für die Seitenleiste: { unreadCount }.
 */
import { jsonOk, newsErrorResponse, requireWebUser } from '@/lib/news/http'
import { unreadCountFor } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireWebUser(req)
  if (auth.response) return auth.response
  try {
    return jsonOk({ unreadCount: await unreadCountFor(auth.user.id, { plan: auth.user.plan }) })
  } catch (err) {
    return newsErrorResponse(err, 'GET /api/news/unread')
  }
}
