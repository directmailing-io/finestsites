import { NextRequest, NextResponse } from 'next/server'
import { cancelByRenewalToken } from '@/lib/billing/cancellation'
import { cancellationErrorResponse } from '../_shared'

/**
 * Ein-Klick-Kündigung aus der bestellten Erinnerungsmail (Jahresabo). Der signierte Token bindet den Link
 * an genau ein Konto und läuft einen Tag nach der Verlängerung ab. Kein Login nötig – die Mail ging an
 * die Kontoadresse. { token }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { token?: unknown } | null
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!token) return NextResponse.json({ error: 'Der Link ist abgelaufen oder ungültig.' }, { status: 400 })
  try {
    const r = await cancelByRenewalToken(token)
    return NextResponse.json({ success: true, period_end: r.periodEnd?.toISOString() ?? null })
  } catch (err) {
    return cancellationErrorResponse(err)
  }
}
