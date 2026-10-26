/**
 * HTTP-Bausteine der Neuigkeiten-Routen (Web mit Sitzungs-Cookie, Admin):
 * Nutzer + Tarif laden, Admin-Prüfung, NewsError → JSON-Antwort.
 * Die App-Routen (/api/app/v1/news…) nutzen stattdessen requireAppUser/appError aus @/lib/app-api/http.
 */
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getRealUserFromRequest, getUserFromRequest } from '@/lib/auth/server'
import { Uuid } from '@/lib/contracts/app-v1/common'
import { NewsError } from './service'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export function jsonError(error: string, status: number, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error, ...(extra ?? {}) }, { status, headers: NO_STORE })
}

export function jsonOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE })
}

/** Fachlicher Fehler → Antwort; alles andere wird als 500 geloggt. */
export function newsErrorResponse(err: unknown, where: string): NextResponse {
  if (err instanceof NewsError) return jsonError(err.message, err.status, { code: err.code })
  console.error(`[news] ${where} fehlgeschlagen:`, err instanceof Error ? err.message : err)
  return jsonError('Interner Fehler.', 500)
}

/** Angemeldeter Web-Nutzer (Sitzungs-Cookie, auch im „Anmelden als“-Modus) samt Tarif. */
export async function requireWebUser(req: Request): Promise<{ user: { id: string; plan: string | null }; response?: never } | { user?: never; response: NextResponse }> {
  const user = await getUserFromRequest(req).catch(() => null)
  if (!user) return { response: jsonError('Unauthorized', 401) }
  const [row] = await db.select({ plan: users.plan }).from(users).where(eq(users.id, user.id)).limit(1)
  return { user: { id: user.id, plan: row?.plan ?? null } }
}

/** Echter Admin (nie der imitierte Nutzer), Muster src/app/api/admin/users/route.ts. */
export async function requireNewsAdmin(req: Request): Promise<{ user: { id: string }; response?: never } | { user?: never; response: NextResponse }> {
  const user = await getRealUserFromRequest(req).catch(() => null)
  if (!user) return { response: jsonError('Unauthorized', 401) }
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  if (!profile?.isAdmin) return { response: jsonError('Forbidden', 403) }
  return { user: { id: user.id } }
}

export function isUuid(id: string): boolean {
  return Uuid.safeParse(id).success
}
