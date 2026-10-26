/**
 * GET /api/app/v1/news/[id] — eine Neuigkeit (404 NOT_FOUND auch bei falscher Audience oder nicht veröffentlicht).
 */
import { appError, appJson, requireAppUser } from '@/lib/app-api/http'
import { NewsDetailResponse } from '@/lib/contracts/app-v1/news'
import { Uuid } from '@/lib/contracts/app-v1/common'
import { getForUser, userPlan } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAppUser(req, 'news')
  if (auth.response) return auth.response
  const { id } = await params
  if (!Uuid.safeParse(id).success) return appError('NOT_FOUND')
  const item = await getForUser(auth.user.id, id, { plan: await userPlan(auth.user.id) })
  if (!item) return appError('NOT_FOUND')
  return appJson(NewsDetailResponse, item)
}
