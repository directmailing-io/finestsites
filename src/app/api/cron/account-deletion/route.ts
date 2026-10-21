/**
 * Cron: fällige Kontolöschungen ausführen (Bedenkzeit 14 Tage abgelaufen) und die Schlussabrechnung
 * gelöschter Partner weiterführen. Täglich (z. B. 04:30 UTC); mehrfach am Tag ist unschädlich (idempotent).
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://app.finestsites.io/api/cron/account-deletion
 *
 * Ablauf und Regeln: src/lib/account-deletion/service.ts
 */
import { NextRequest, NextResponse } from 'next/server'
import { safeEqual } from '@/lib/security/request'
import { runAccountDeletionCron } from '@/lib/account-deletion/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || !safeEqual(req.headers.get('authorization') ?? '', `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runAccountDeletionCron()
    return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), ...result })
  } catch (err) {
    console.error('[cron/account-deletion] Fehler:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
