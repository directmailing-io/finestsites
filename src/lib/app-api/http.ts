/**
 * Gemeinsame Bausteine der App-Schnittstellen /api/app/v1/*:
 * Anmeldung (Bearer über getUserFromRequest), Ratenbegrenzung je Nutzer, feste Fehlercodes,
 * Antwort-Prüfung gegen die zod-Verträge (außerhalb der Produktion: Abweichung = 500 + Log,
 * damit Vertragsbrüche in Tests sofort auffallen; in Produktion nur Log).
 */
import type { z } from 'zod'
import { getUserFromRequest } from '@/lib/auth/server'
import { getClientIp, rateLimit } from '@/lib/security/request'
import type { AppErrorCode } from '@/lib/contracts/app-v1/errors'
import { appMessage } from './messages'

export { appMessage }

export type AppUser = NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>

const NO_STORE = { 'Cache-Control': 'private, no-store' }

const STATUS: Partial<Record<AppErrorCode, number>> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 400,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  FEATURE_DISABLED: 403,
  UPGRADE_REQUIRED: 426,
  APP_PURCHASE_DISABLED: 403,
  AFFILIATE_NOT_AVAILABLE: 403,
  CONNECT_UNAVAILABLE: 503,
  NOT_SELF: 403,
  HANDOFF_INVALID: 400,
  INVALID_PASSWORD: 400,
  BALANCE_CHOICE_REQUIRED: 400,
  PERIOD_END_NOT_AVAILABLE: 400,
  DELETION_NOT_ALLOWED: 403,
  DELETION_ALREADY_REQUESTED: 409,
  NO_DELETION_PENDING: 409,
  ACCOUNT_DELETION_PENDING: 423,
}

export function appError(code: AppErrorCode, message?: string, status?: number, fields?: Record<string, string>): Response {
  return Response.json(
    { code, message: message ?? appMessage(code), ...(fields ? { fields } : {}) },
    { status: status ?? STATUS[code] ?? 400, headers: NO_STORE },
  )
}

/** Antwort gegen den Vertrag prüfen und senden. */
export function appJson<S extends z.ZodTypeAny>(schema: S, data: z.input<S>, init?: { status?: number; headers?: HeadersInit }): Response {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    console.error('[app-api] Antwort verletzt den Vertrag:', JSON.stringify(parsed.error.issues).slice(0, 2000))
    if (process.env.NODE_ENV !== 'production') return appError('INTERNAL', 'Antwort verletzt den Vertrag (nur Entwicklung).')
  }
  return Response.json(parsed.success ? parsed.data : data, {
    status: init?.status ?? 200,
    headers: { ...NO_STORE, ...(init?.headers ?? {}) },
  })
}

/**
 * Angemeldeten Nutzer holen + Ratenbegrenzung je Nutzer.
 * Rückgabe: { user } oder { response } (Fehler, direkt zurückgeben).
 */
export async function requireAppUser(
  req: Request,
  bucket: string,
  limit = 120,
  windowMs = 60_000,
): Promise<{ user: AppUser; response?: never } | { user?: never; response: Response }> {
  // Vorab-Bremse je IP gegen Token-Raten (großzügig, Nutzer hinter einem NAT teilen sich die IP)
  if (!rateLimit(`app-ip:${bucket}`, getClientIp(req), limit * 5, windowMs)) return { response: appError('RATE_LIMITED') }
  let user: AppUser | null = null
  try {
    user = await getUserFromRequest(req)
  } catch {
    user = null
  }
  if (!user) return { response: appError('UNAUTHORIZED') }
  if (!rateLimit(`app:${bucket}`, user.id, limit, windowMs)) return { response: appError('RATE_LIMITED') }
  return { user }
}

/** JSON-Body lesen und gegen ein Schema prüfen. */
export async function readJson<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<{ data: z.output<S>; response?: never } | { data?: never; response: Response }> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { response: appError('VALIDATION_FAILED') }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { response: appError('VALIDATION_FAILED') }
  return { data: parsed.data }
}

export const toIso = (d: Date | string | null | undefined): string | null =>
  d == null ? null : (d instanceof Date ? d : new Date(d)).toISOString()

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')
}
