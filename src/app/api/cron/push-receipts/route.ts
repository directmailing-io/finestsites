// Cron: Expo-Empfangsbestätigungen prüfen, abgemeldete Geräte abschalten (Vorschlag: alle 15 Minuten).
//   0,15,30,45 * * * * curl -s "$APP/api/cron/push-receipts" -H "Authorization: Bearer $CRON_SECRET"
import { NextRequest, NextResponse } from 'next/server'
import { safeEqual } from '@/lib/security/request'
import { checkPushReceipts } from '@/lib/push/drain'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || !safeEqual(authHeader ?? '', `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await checkPushReceipts())
  } catch (err) {
    console.error('[cron/push-receipts] failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
