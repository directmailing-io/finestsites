/**
 * „Verbindung prüfen“: schickt ein Test-Ereignis über die Server-Schnittstelle der Plattform.
 * Der Test-Code wird nur hier benutzt und nicht gespeichert — er darf nie live mitlaufen.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { trackingConfigs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { decryptSecret } from '@/lib/tracking/crypto'
import { sendMetaEvent, sendTikTokEvent, normalizeEmail, type ServerEvent } from '@/lib/tracking/platforms'
import { publishedSitesWithUrls } from '@/lib/tracking/config'
import * as v from '@/lib/tracking/validate'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { platform?: string; testCode?: string }
  const cfg = await db.query.trackingConfigs.findFirst({ where: eq(trackingConfigs.userId, user.id) })
  if (!cfg) return NextResponse.json({ error: 'Bitte zuerst speichern.' }, { status: 400 })

  const sites = await publishedSitesWithUrls(user.id)
  const sourceUrl = sites.find(s => s.status === 'published')?.url ?? 'https://finestsites.io'
  const sha = (s: string) => createHash('sha256').update(s).digest('hex')
  const ev: ServerEvent = {
    name: 'Lead', eventId: `test-${Date.now()}`, time: Math.floor(Date.now() / 1000), sourceUrl,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    userAgent: req.headers.get('user-agent'),
    emailHash: sha(normalizeEmail('test@finestsites.io')),
  }

  try {
    if (body.platform === 'meta') {
      if (!cfg.metaPixelId || !cfg.metaTokenEnc) return NextResponse.json({ error: 'Bitte zuerst Pixel-ID und Zugriffsschlüssel speichern.' }, { status: 400 })
      ev.testCode = v.metaTestCode(body.testCode) || null
      const r = await sendMetaEvent(cfg.metaPixelId, decryptSecret(cfg.metaTokenEnc), ev)
      await db.update(trackingConfigs).set({ lastSendAt: new Date(), lastSendPlatform: 'meta', lastSendStatus: r.ok ? 'ok' : 'error', lastSendError: r.ok ? null : r.error ?? null }).where(eq(trackingConfigs.userId, user.id))
      return NextResponse.json(r.ok
        ? { ok: true, message: ev.testCode ? 'Meta hat das Test-Ereignis angenommen. Es erscheint jetzt im Events Manager unter „Ereignisse testen“ als Lead.' : 'Meta hat das Ereignis angenommen. Tipp: Mit Test-Code siehst du es sofort unter „Ereignisse testen“.' }
        : { ok: false, error: r.error })
    }
    if (body.platform === 'tiktok') {
      if (!cfg.tiktokPixelId || !cfg.tiktokTokenEnc) return NextResponse.json({ error: 'Bitte zuerst Pixel-ID und Zugriffstoken speichern.' }, { status: 400 })
      ev.testCode = String(body.testCode ?? '').trim().slice(0, 40) || null
      const r = await sendTikTokEvent(cfg.tiktokPixelId, decryptSecret(cfg.tiktokTokenEnc), ev)
      await db.update(trackingConfigs).set({ lastSendAt: new Date(), lastSendPlatform: 'tiktok', lastSendStatus: r.ok ? 'ok' : 'error', lastSendError: r.ok ? null : r.error ?? null }).where(eq(trackingConfigs.userId, user.id))
      return NextResponse.json(r.ok ? { ok: true, message: 'TikTok hat das Test-Ereignis angenommen.' } : { ok: false, error: r.error })
    }
    return NextResponse.json({ error: 'Unbekannte Plattform.' }, { status: 400 })
  } catch (err) {
    if (err instanceof v.TrackingInputError) return NextResponse.json({ ok: false, error: err.message }, { status: 400 })
    console.error('[tracking/test]', err)
    return NextResponse.json({ ok: false, error: 'Prüfung fehlgeschlagen. Bitte versuche es noch einmal.' }, { status: 500 })
  }
}
