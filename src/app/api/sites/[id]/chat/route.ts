/**
 * Besucher-Chat je Webseite (Editor-Schalter „Besucher-Chat anzeigen“).
 *   GET  → { available, enabled }   available = Konto freigeschaltet (app_settings visitor_chat_*)
 *   PUT  { enabled: boolean } → { available, enabled }
 * Wirkt auf der Live-Seite binnen ≤ 60 s (SiteMeta-Cache des Workers), unabhängig vom Veröffentlichen.
 * Nur der Besitzer (oder Admin). docs/chat/konzept.md
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { userSites } from '@/lib/db/schema'
import { siteWhereForUser } from '@/lib/sites/site-access'
import { isVisitorChatEnabledForUser } from '@/lib/chat/flags'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function load(req: NextRequest, id: string) {
  const user = await getUserFromRequest(req)
  if (!user) return { error: NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }) }
  const [site] = await db.select({ id: userSites.id, userId: userSites.userId, enabled: userSites.visitorChatEnabled })
    .from(userSites).where(await siteWhereForUser(id, user.id)).limit(1)
  if (!site) return { error: NextResponse.json({ error: 'Seite nicht gefunden' }, { status: 404 }) }
  const available = await isVisitorChatEnabledForUser(site.userId)
  return { user, site, available }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await load(req, id)
  if ('error' in r) return r.error
  return NextResponse.json({ available: r.available, enabled: r.site.enabled })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await load(req, id)
  if ('error' in r) return r.error
  let body: { enabled?: unknown } = {}
  try { body = await req.json() } catch { body = {} }
  if (typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'enabled (boolean) fehlt' }, { status: 400 })
  await db.update(userSites).set({ visitorChatEnabled: body.enabled, updatedAt: new Date() }).where(await siteWhereForUser(id, r.user.id))
  return NextResponse.json({ available: r.available, enabled: body.enabled })
}
