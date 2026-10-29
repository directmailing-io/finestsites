/**
 * Besucher-Chat je Webseite (Editor-Schalter „Besucher-Chat anzeigen“).
 *   GET  → { available, enabled, avvAccepted, consentLine, avvUrl }
 *          available = Konto freigeschaltet (app_settings visitor_chat_*, src/lib/chat/flags.ts)
 *   PUT  { enabled: boolean, acceptAvv?: true } → { available, enabled, avvAccepted }
 *        Einschalten nur mit Zustimmung zur Ergänzung der Auftragsverarbeitung (aktuelle Version):
 *        fehlt sie und acceptAvv ist nicht true → 409 { error: 'AVV_REQUIRED' }. Zustimmung wird mit
 *        Zeitpunkt, Version, Text-Hash, IP und User-Agent in chat_avv_consents gespeichert.
 * Wirkt auf der Live-Seite binnen ≤ 60 s (SiteMeta-Cache des Workers), unabhängig vom Veröffentlichen.
 * Nur der Besitzer (oder Admin). docs/chat/konzept.md
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { chatAvvConsents, userSites } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getClientIp } from '@/lib/security/request'
import { CHAT_AVV_CONSENT_LINE, CHAT_AVV_CURRENT_VERSION, chatAvvTextHash } from '@/lib/chat/avv'
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

const AVV_URL = 'https://finestsites.io/agb/avv-besucher-chat'

async function hasAcceptedAvv(userId: string): Promise<boolean> {
  const [row] = await db.select({ id: chatAvvConsents.id }).from(chatAvvConsents)
    .where(and(eq(chatAvvConsents.userId, userId), eq(chatAvvConsents.version, CHAT_AVV_CURRENT_VERSION))).limit(1)
  return !!row
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await load(req, id)
  if ('error' in r) return r.error
  return NextResponse.json({
    available: r.available,
    enabled: r.site.enabled,
    avvAccepted: await hasAcceptedAvv(r.site.userId),
    consentLine: CHAT_AVV_CONSENT_LINE[CHAT_AVV_CURRENT_VERSION],
    avvUrl: AVV_URL,
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await load(req, id)
  if ('error' in r) return r.error
  let body: { enabled?: unknown; acceptAvv?: unknown } = {}
  try { body = await req.json() } catch { body = {} }
  if (typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'enabled (boolean) fehlt' }, { status: 400 })
  if (body.enabled && !r.available) return NextResponse.json({ error: 'FEATURE_DISABLED' }, { status: 403 })
  let avvAccepted = await hasAcceptedAvv(r.site.userId)
  if (body.enabled && !avvAccepted) {
    // Zustimmung zählt nur vom Kontoinhaber selbst, nicht von einem Admin für ihn
    if (body.acceptAvv !== true || r.user.id !== r.site.userId) {
      return NextResponse.json({ error: 'AVV_REQUIRED', avvAccepted: false }, { status: 409 })
    }
    const ip = (req.headers.get('cf-connecting-ip') ?? getClientIp(req) ?? req.headers.get('x-real-ip') ?? 'unknown').slice(0, 64)
    await db.insert(chatAvvConsents).values({
      userId: r.site.userId,
      siteId: r.site.id,
      version: CHAT_AVV_CURRENT_VERSION,
      textHash: chatAvvTextHash(),
      ip,
      userAgent: (req.headers.get('user-agent') ?? '').slice(0, 512),
    })
    avvAccepted = true
  }
  await db.update(userSites).set({ visitorChatEnabled: body.enabled, updatedAt: new Date() }).where(await siteWhereForUser(id, r.user.id))
  return NextResponse.json({ available: r.available, enabled: body.enabled, avvAccepted })
}
