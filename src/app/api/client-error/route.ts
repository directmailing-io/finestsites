/**
 * POST /api/client-error — Browser-Fehler aus dem Dashboard (error.tsx) ins Server-Log, damit Abstürze im
 * App-WebView (Android/iOS) ohne Gerätezugriff sichtbar sind. Keine Speicherung, nur console.error → PM2-Log.
 * Bewusst ohne Auth (der Fehler kann vor dem Login passieren); gedrosselt und stark gekürzt.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getClientIp, rateLimit } from '@/lib/security/request'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!rateLimit('client-error', getClientIp(req), 20, 60_000)) return NextResponse.json({ ok: false }, { status: 429 })
  let body: { message?: unknown; stack?: unknown; url?: unknown; digest?: unknown; extra?: unknown } = {}
  try { body = await req.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }
  const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '')
  console.error('[client-error]', JSON.stringify({
    message: s(body.message, 500),
    digest: s(body.digest, 64),
    url: s(body.url, 300),
    ua: (req.headers.get('user-agent') ?? '').slice(0, 300),
    stack: s(body.stack, 2000),
    extra: s(body.extra, 500),
    at: new Date().toISOString(),
  }))
  return NextResponse.json({ ok: true })
}
