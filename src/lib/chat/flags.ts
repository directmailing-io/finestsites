/**
 * Schalter des Besucher-Chats (Notaus), siehe docs/chat/konzept.md.
 *
 *   app_settings.visitor_chat_enabled  'true' = an, fehlt/anders = AUS (Hauptschalter)
 *   app_settings.visitor_chat_users    Kommaliste von Benutzernamen, immer freigeschaltet (z. B. demo)
 *   app_settings.visitor_chat_app_users 'true' = zusätzlich alle Konten, die die App benutzt haben
 *                                      (push_devices oder App-Sitzung) oder schon der Chat-AVV zugestimmt
 *                                      haben (bleibt nach Abmelden aus der App freigeschaltet). Seit 29.10.2026.
 *
 * Freigeschaltet heißt nur: Editor-Karte + „Chats“ sichtbar. Auf der Webseite erscheint der Chat erst,
 * wenn der Nutzer ihn je Seite einschaltet (user_sites.visitor_chat_enabled, Standard aus, mit Zustimmung
 * zur Ergänzung der Auftragsverarbeitung – src/lib/chat/avv.ts).
 *
 * Ergebnis 30 s zwischengespeichert (wie readAppSettings/isPushEnabled). Fehler beim Lesen = AUS.
 */
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { readAppSettings } from '@/lib/push/config'

export const VISITOR_CHAT_ENABLED_KEY = 'visitor_chat_enabled'
export const VISITOR_CHAT_USERS_KEY = 'visitor_chat_users'
export const VISITOR_CHAT_APP_USERS_KEY = 'visitor_chat_app_users'

export type VisitorChatSettings = { enabled: boolean; usernames: string[]; appUsers: boolean }

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
  let value: VisitorChatSettings = { enabled: false, usernames: [], appUsers: false }
  try {
    const s = await readAppSettings([VISITOR_CHAT_ENABLED_KEY, VISITOR_CHAT_USERS_KEY, VISITOR_CHAT_APP_USERS_KEY])
    value = {
      enabled: (s[VISITOR_CHAT_ENABLED_KEY] ?? '').trim().toLowerCase() === 'true',
      usernames: parseUsernameList(s[VISITOR_CHAT_USERS_KEY]),
      appUsers: (s[VISITOR_CHAT_APP_USERS_KEY] ?? '').trim().toLowerCase() === 'true',
    }
  } catch {
    value = { enabled: false, usernames: [], appUsers: false }
  }
  cache = { at: now, value }
  return value
}

/** Nur für Tests/Admin-Speichern: Zwischenspeicher leeren. */
export function resetVisitorChatCache(): void {
  cache = null
  appUserCache.clear()
}

/** Konto hat die App benutzt (Gerät registriert oder App-Sitzung) oder der Chat-AVV schon zugestimmt. 30 s Cache. */
const appUserCache = new Map<string, { at: number; value: boolean }>()
async function isAppUser(userId: string): Promise<boolean> {
  const now = Date.now()
  const hit = appUserCache.get(userId)
  if (hit && now - hit.at < CACHE_MS) return hit.value
  let value = false
  try {
    const rows = await db.execute(sql`select (
      exists (select 1 from push_devices where user_id = ${userId})
      or exists (select 1 from sessions where user_id = ${userId}
                 and (user_agent like 'FinestSites/%' or user_agent like '%FinestSitesApp/%'))
      or exists (select 1 from chat_avv_consents where user_id = ${userId})
    ) as ok`)
    const row = (rows as unknown as Array<{ ok: boolean }>)[0]
    value = row?.ok === true
  } catch {
    value = false
  }
  if (appUserCache.size > 5000) appUserCache.clear()
  appUserCache.set(userId, { at: now, value })
  return value
}

export async function isVisitorChatEnabledForUsername(username: string | null | undefined): Promise<boolean> {
  if (!username) return false
  const s = await readVisitorChatSettings()
  if (!s.enabled) return false
  const name = username.trim().toLowerCase()
  if (s.usernames.includes(name)) return true
  if (!s.appUsers) return false
  try {
    const row = await db.query.users.findFirst({ where: eq(users.username, username.trim()), columns: { id: true } })
    return !!row && await isAppUser(row.id)
  } catch {
    return false
  }
}

export async function isVisitorChatEnabledForUser(userId: string): Promise<boolean> {
  const s = await readVisitorChatSettings()
  if (!s.enabled) return false
  if (s.usernames.length > 0) {
    try {
      const row = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { username: true } })
      if (row?.username && s.usernames.includes(row.username.toLowerCase())) return true
    } catch {
      return false
    }
  }
  return s.appUsers ? isAppUser(userId) : false
}
