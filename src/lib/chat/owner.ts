/**
 * Gemeinsamer Einstieg der Betreiber-Routen /api/app/v1/chat/* (App per Bearer, Web per Cookie).
 * Reihenfolge: Anmeldung + Ratenbremse (requireAppUser) → Freischaltung (FEATURE_DISABLED) →
 * Besitzprüfung des Gesprächs (NOT_FOUND, nie FORBIDDEN – kein Hinweis auf fremde IDs).
 */
import { appError, requireAppUser, type AppUser } from '@/lib/app-api/http'
import { isVisitorChatEnabledForUser } from './flags'
import { getConversationForOwner, type ConversationWithSite } from './service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function requireChatUser(req: Request, bucket: string, limit = 120, windowMs = 60_000):
  Promise<{ user: AppUser; response?: never } | { user?: never; response: Response }> {
  const auth = await requireAppUser(req, bucket, limit, windowMs)
  if (auth.response) return auth
  if (!(await isVisitorChatEnabledForUser(auth.user.id))) return { response: appError('FEATURE_DISABLED') }
  return { user: auth.user }
}

export async function requireOwnedConversation(id: string, userId: string):
  Promise<{ row: ConversationWithSite; response?: never } | { row?: never; response: Response }> {
  if (!UUID_RE.test(id)) return { response: appError('NOT_FOUND') }
  const row = await getConversationForOwner(id, userId)
  if (!row) return { response: appError('NOT_FOUND') }
  return { row }
}

export type RouteParams = { params: Promise<{ id: string }> }
