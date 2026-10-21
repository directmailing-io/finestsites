/**
 * Cron: Push-Warteschlange abarbeiten (Vorschlag: jede Minute).
 *   * * * * * curl -s "$APP/api/cron/push-drain" -H "Authorization: Bearer $CRON_SECRET"
 * Tut nichts, solange Push abgeschaltet ist (PUSH_ENABLED + app_settings.push_enabled).
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeEqual } from '@/lib/security/request'
import { drainPushOutbox } from '@/lib/push/drain'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || !safeEqual(authHeader ?? '', `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const stats = await drainPushOutbox()
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[cron/push-drain] failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
