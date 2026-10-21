/**
 * GET /api/app/v1/affiliate/credit-notes/[id] — Gutschrift-PDF für die App (Bearer).
 * Gleiche Regeln wie /api/affiliate/credit-notes/[id] (nur der Partner selbst, privat aus R2,
 * ggf. einmal nacherzeugt); diese Route ruft sie unverändert auf und ergänzt nur den App-Notschalter.
 */
import { GET as webCreditNote } from '@/app/api/affiliate/credit-notes/[id]/route'
import { appError, requireAppUser } from '@/lib/app-api/http'
import { getAppRuntimeSettings } from '@/lib/app-api/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAppUser(req, 'affiliate-credit-note', 60)
  if (auth.response) return auth.response
  if (!(await getAppRuntimeSettings()).features.partnerProgram) return appError('FEATURE_DISABLED')
  return webCreditNote(req, ctx)
}
