/**
 * GET /api/app/v1/news — Neuigkeiten für den angemeldeten Nutzer (veröffentlicht + Audience-Treffer),
 * neueste zuerst, höchstens 50, plus Ungelesen-Zähler.
 */
import { appJson, requireAppUser } from '@/lib/app-api/http'
import { NewsListResponse } from '@/lib/contracts/app-v1/news'
import { listForUser, userPlan } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireAppUser(req, 'news')
  if (auth.response) return auth.response
  const plan = await userPlan(auth.user.id)
  return appJson(NewsListResponse, await listForUser(auth.user.id, { plan }))
}
