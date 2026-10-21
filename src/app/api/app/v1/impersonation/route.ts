/**
 * Support-Zugriff in der App (das Web nutzt den Server-Stream /api/impersonate/stream).
 *
 *   GET  /api/app/v1/impersonation[?token=…]  → { request } (Abfrage alle paar Sekunden, solange offen)
 *   POST /api/app/v1/impersonation { token, action: 'approve' | 'deny' } → { status }
 *
 * Gleiche Regeln wie /api/impersonate/approve|reject (src/lib/impersonation/consent.ts).
 * Nur der Kontoinhaber selbst entscheidet: im „Anmelden als“-Modus (Support-Cookie) → NOT_SELF.
 */
import { getRealUserFromRequest } from '@/lib/auth/server'
import { appError, appJson, readJson, requireAppUser, toIso } from '@/lib/app-api/http'
import {
  ImpersonationDecisionRequest, ImpersonationDecisionResponse, ImpersonationQuery, ImpersonationResponse,
} from '@/lib/contracts/app-v1/impersonation'
import { approveImpersonationRequest, impersonationViewForUser, rejectImpersonationRequest } from '@/lib/impersonation/consent'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Die App fragt alle 4 s nach, solange eine Anfrage offen ist → großzügiges Limit
  const auth = await requireAppUser(req, 'impersonation', 60)
  if (auth.response) return auth.response
  const q = ImpersonationQuery.safeParse({ token: new URL(req.url).searchParams.get('token') ?? undefined })
  if (!q.success) return appError('VALIDATION_FAILED')

  const v = await impersonationViewForUser(auth.user.id, q.data.token)
  return appJson(ImpersonationResponse, {
    request: v ? { token: v.token, status: v.status, adminName: v.adminName, expiresAt: toIso(v.expiresAt)! } : null,
  })
}

export async function POST(req: Request) {
  const auth = await requireAppUser(req, 'impersonation-decision', 10)
  if (auth.response) return auth.response
  const real = await getRealUserFromRequest(req).catch(() => null)
  if (!real || real.id !== auth.user.id) return appError('NOT_SELF')

  const body = await readJson(req, ImpersonationDecisionRequest)
  if (body.response) return body.response
  const { token, action } = body.data

  const ok = action === 'approve'
    ? await approveImpersonationRequest(auth.user.id, token)
    : await rejectImpersonationRequest(auth.user.id, token)
  if (!ok) return appError('NOT_FOUND')
  return appJson(ImpersonationDecisionResponse, { status: action === 'approve' ? 'approved' : 'rejected' })
}
