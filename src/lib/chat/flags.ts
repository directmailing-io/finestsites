/**
 * Schalter des Besucher-Chats (Notaus), siehe docs/chat/konzept.md.
 *
 *   app_settings.visitor_chat_enabled  'true' = an, fehlt/anders = AUS (Hauptschalter)
 *   app_settings.visitor_chat_users    Kommaliste von Benutzernamen, nur diese Konten
 *
 * Ergebnis 30 s zwischengespeichert (wie readAppSettings/isPushEnabled). Fehler beim Lesen = AUS.
 */
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { readAppSettings } from '@/lib/push/config'

export const VISITOR_CHAT_ENABLED_KEY = 'visitor_chat_enabled'
export const VISITOR_CHAT_USERS_KEY = 'visitor_chat_users'

export type VisitorChatSettings = { enabled: boolean; usernames: string[] }

const CACHE_MS = 30_000
let cache: { at: number; value: VisitorChatSettings } | null = null

export function parseUsernameList(raw: string | undefined | null): string[] {
  return Array.from(new Set((raw ?? '')
    .split(/[\s,;]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)))
}

/** Aktuelle Schalterstellung (30 s Cache). */
export async function readVisitorChatSettings(): Promise<VisitorChatSettings> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_MS) return cache.value
  let value: VisitorChatSettings = { enabled: false, usernames: [] }
  try {
    const s = await readAppSettings([VISITOR_CHAT_ENABLED_KEY, VISITOR_CHAT_USERS_KEY])
    value = {
      enabled: (s[VISITOR_CHAT_ENABLED_KEY] ?? '').trim().toLowerCase() === 'true',
      usernames: parseUsernameList(s[VISITOR_CHAT_USERS_KEY]),
    }
  } catch {
    value = { enabled: false, usernames: [] }
  }
  cache = { at: now, value }
  return value
}

/** Nur für Tests/Admin-Speichern: Zwischenspeicher leeren. */
export function resetVisitorChatCache(): void {
  cache = null
}

export async function isVisitorChatEnabledForUsername(username: string | null | undefined): Promise<boolean> {
  if (!username) return false
  const s = await readVisitorChatSettings()
  return s.enabled && s.usernames.includes(username.trim().toLowerCase())
}

export async function isVisitorChatEnabledForUser(userId: string): Promise<boolean> {
  const s = await readVisitorChatSettings()
  if (!s.enabled || s.usernames.length === 0) return false
  try {
    const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { username: true } })
    return !!row?.username && s.usernames.includes(row.username.toLowerCase())
  } catch {
    return false
  }
}
