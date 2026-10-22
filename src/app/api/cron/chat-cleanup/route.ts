/**
 * Cron: Aufbewahrung des Besucher-Chats (täglich).
 *   0 4 * * * curl -s "$APP/api/cron/chat-cleanup" -H "Authorization: Bearer $CRON_SECRET"
 * Löscht Gespräche ohne Nachricht seit 180 Tagen, abgelaufene/benutzte Resume-Tokens und Sperren älter als 365 Tage.
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeEqual } from '@/lib/security/request'
import { cleanupChat } from '@/lib/chat/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || !safeEqual(authHeader ?? '', `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const stats = await cleanupChat()
    return NextResponse.json({ ok: true, ...stats })
  } catch (err) {
    console.error('[cron/chat-cleanup] failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
