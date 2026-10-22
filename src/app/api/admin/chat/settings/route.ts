/**
 * Admin: Schalter des Besucher-Chats (app_settings visitor_chat_enabled / visitor_chat_users).
 *   GET → { enabled, usernames, updatedAt }
 *   PUT { enabled?: boolean, usernames?: string[] | string } → { ok, enabled, usernames }
 * Nur Admin (echte Sitzung, kein „Anmelden als“).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { appSettings, users } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import {
  parseUsernameList, readVisitorChatSettings, resetVisitorChatCache, VISITOR_CHAT_ENABLED_KEY, VISITOR_CHAT_USERS_KEY,
} from '@/lib/chat/flags'

export const dynamic = 'force-dynamic'

async function checkAdmin(req: Request) {
  const user = await getRealUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  return profile?.isAdmin ? user : null
}

async function current() {
  resetVisitorChatCache()
  const s = await readVisitorChatSettings()
  const rows = await db.select({ key: appSettings.key, updatedAt: appSettings.updatedAt }).from(appSettings)
    .where(inArray(appSettings.key, [VISITOR_CHAT_ENABLED_KEY, VISITOR_CHAT_USERS_KEY]))
  const updatedAt = rows.map(r => r.updatedAt.getTime()).sort((a, b) => b - a)[0]
  return { enabled: s.enabled, usernames: s.usernames, updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null }
}

export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await current())
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { enabled?: unknown; usernames?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled muss true/false sein' }, { status: 400 })
  }
  let usernames: string[] | undefined
  if (body.usernames !== undefined) {
    if (Array.isArray(body.usernames)) usernames = parseUsernameList(body.usernames.filter((u): u is string => typeof u === 'string').join(','))
    else if (typeof body.usernames === 'string') usernames = parseUsernameList(body.usernames)
    else return NextResponse.json({ error: 'usernames muss eine Liste oder Kommaliste sein' }, { status: 400 })
    if (usernames.length > 500) return NextResponse.json({ error: 'Zu viele Benutzernamen' }, { status: 400 })
  }

  try {
    const now = new Date()
    const upsert = (key: string, value: string) => db.insert(appSettings)
      .values({ key, value, updatedBy: admin.id, updatedAt: now })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: admin.id, updatedAt: now } })
    if (body.enabled !== undefined) await upsert(VISITOR_CHAT_ENABLED_KEY, body.enabled ? 'true' : 'false')
    if (usernames !== undefined) await upsert(VISITOR_CHAT_USERS_KEY, usernames.join(','))

    // Unbekannte Benutzernamen nur melden, nicht ablehnen (Konto kann noch angelegt werden)
    let unknown: string[] = []
    if (usernames && usernames.length > 0) {
      const found = await db.select({ username: users.username }).from(users).where(inArray(users.username, usernames))
      const known = new Set(found.map(f => f.username?.toLowerCase()))
      unknown = usernames.filter(u => !known.has(u))
    }
    return NextResponse.json({ ok: true, ...(await current()), unknownUsernames: unknown })
  } catch (err) {
    console.error('[admin/chat/settings] failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
