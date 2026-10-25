/**
 * Gemeinsame Handler für GET/POST/DELETE der Lösch-Schnittstellen:
 *   /api/account/deletion          (Web, Sitzungs-Cookie)
 *   /api/app/v1/account/deletion   (App, Bearer)
 * Beide liefern die Formen aus src/lib/contracts/app-v1/account-deletion.ts und die festen Fehlercodes.
 *
 * Löschen und Abbrechen nur mit der ECHTEN Sitzung: Ein Admin, der ein Konto per Impersonation
 * ansieht, kann es weder löschen noch eine Löschung abbrechen.
 */
import { getRealUserFromRequest, getUserFromRequest } from '@/lib/auth/server'
import { appError, appJson, readJson } from '@/lib/app-api/http'
import { getClientIp, rateLimit } from '@/lib/security/request'
import {
  DeletionStatusResponse, DeletionRequestBody, DeletionRequestResponse, DeletionCancelResponse,
} from '@/lib/contracts/app-v1/account-deletion'
import { DeletionError, cancelDeletion, getDeletionStatus, requestDeletion } from './service'

type Source = 'web' | 'app'

function hasImpersonationCookie(req: Request): boolean {
  return /(?:^|;\s*)fs-impersonation=/.test(req.headers.get('cookie') ?? '')
}

function mapError(err: unknown): Response {
  if (err instanceof DeletionError) {
    if (err.code === 'NOT_FOUND') return appError('UNAUTHORIZED')
    return appError(err.code)
  }
  console.error('[account-deletion] Fehler:', err)
  return appError('INTERNAL')
}

async function realUser(req: Request, bucket: string, limit: number): Promise<{ id: string } | Response> {
  if (!rateLimit(`deletion-ip:${bucket}`, getClientIp(req), limit * 5, 60_000)) return appError('RATE_LIMITED')
  if (hasImpersonationCookie(req)) return appError('FORBIDDEN')
  const user = await getRealUserFromRequest(req).catch(() => null)
  if (!user) return appError('UNAUTHORIZED')
  if (!rateLimit(`deletion:${bucket}`, user.id, limit, 60_000)) return appError('RATE_LIMITED')
  return { id: user.id }
}

export async function handleDeletionGet(req: Request): Promise<Response> {
  if (!rateLimit('deletion-ip:get', getClientIp(req), 300, 60_000)) return appError('RATE_LIMITED')
  const user = await getUserFromRequest(req).catch(() => null)
  if (!user) return appError('UNAUTHORIZED')
  try {
    return appJson(DeletionStatusResponse, await getDeletionStatus(user.id))
  } catch (err) {
    return mapError(err)
  }
}

export async function handleDeletionPost(req: Request, source: Source): Promise<Response> {
  const auth = await realUser(req, 'request', 10)
  if (auth instanceof Response) return auth
  const body = await readJson(req, DeletionRequestBody)
  if (body.response) return body.response
  try {
    const { scheduledFor, mode, signedOut } = await requestDeletion({
      userId: auth.id,
      password: body.data.password,
      timing: body.data.timing ?? 'now',
      balanceChoice: body.data.balanceChoice ?? null,
      waiverConfirmed: body.data.waiverConfirmed,
      source,
    })
    return appJson(DeletionRequestResponse, { status: 'scheduled', mode, scheduledFor: scheduledFor.toISOString(), signedOut })
  } catch (err) {
    return mapError(err)
  }
}

export async function handleDeletionDelete(req: Request): Promise<Response> {
  const auth = await realUser(req, 'cancel', 10)
  if (auth instanceof Response) return auth
  try {
    const { sitesOffline, subscriptionContinues } = await cancelDeletion(auth.id)
    return appJson(DeletionCancelResponse, { status: 'none', sitesOffline, subscriptionContinues })
  } catch (err) {
    return mapError(err)
  }
}
