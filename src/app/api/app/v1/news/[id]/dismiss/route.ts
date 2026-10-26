/**
 * POST /api/app/v1/news/[id]/dismiss — Startkarte weggewischt: dismissed_at setzen (Web und App teilen sich den Wert). Antwort: aktueller Stand + Ungelesen-Zähler.
 */
import { appError, appJson, requireAppUser } from '@/lib/app-api/http'
import { NewsActionResponse } from '@/lib/contracts/app-v1/news'
import { Uuid } from '@/lib/contracts/app-v1/common'
import { dismiss, userPlan } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAppUser(req, 'news-action', 60)
  if (auth.response) return auth.response
  const { id } = await params
  if (!Uuid.safeParse(id).success) return appError('NOT_FOUND')
  const result = await dismiss(auth.user.id, id, { plan: await userPlan(auth.user.id) })
  if (!result) return appError('NOT_FOUND')
  return appJson(NewsActionResponse, result)
}
