/**
 * GET /api/worker/tracking-secrets?siteId=… — Worker-intern (x-worker-secret).
 * Liefert entschlüsselte Zugriffstoken für die Server-Übertragung. Nur für Seiten,
 * deren Besitzer Tracking bestätigt und die Seite nicht ausgenommen hat.
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkWorkerSecret } from '@/lib/tracking/worker-auth'
import { trackingForSite, secretsFor, toPublicConfig } from '@/lib/tracking/config'

export async function GET(req: NextRequest) {
  if (!checkWorkerSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const siteId = req.nextUrl.searchParams.get('siteId') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) return NextResponse.json({ error: 'siteId' }, { status: 400 })
  try {
    const cfg = await trackingForSite(siteId)
    if (!cfg || !toPublicConfig(cfg, siteId)) return NextResponse.json({ active: false })
    return NextResponse.json({ active: true, ...secretsFor(cfg) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[worker/tracking-secrets]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
