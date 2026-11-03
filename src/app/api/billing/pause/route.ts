import { NextRequest, NextResponse } from 'next/server'
import { blockPurchaseInApp } from '@/lib/app-mode'
import { getUserFromRequest } from '@/lib/auth/server'
import { deletionPendingResponse } from '@/lib/account-deletion/guard'
import { PauseError, cancelPause, schedulePause } from '@/lib/billing/pause'

/**
 * Abo pausieren (src/lib/billing/pause.ts).
 *   POST   { months: 1|2|3 } → Pause ab Laufzeitende einplanen
 *   DELETE → Pause abbrechen (vor Beginn) oder sofort beenden (während der Pause)
 * Nur im Browser (Apple 3.1.1).
 */
export async function POST(req: NextRequest) {
  const appBlocked = blockPurchaseInApp(req)
  if (appBlocked) return appBlocked
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  const deletionBlock = await deletionPendingResponse(user.id)
  if (deletionBlock) return deletionBlock
  const body = await req.json().catch(() => null) as { months?: unknown } | null
  const months = typeof body?.months === 'number' ? body.months : Number(body?.months)
  try {
    const pause = await schedulePause(user.id, months)
    return NextResponse.json({ success: true, pause })
  } catch (err) {
    return pauseErrorResponse(err)
  }
}

export async function DELETE(req: NextRequest) {
  const appBlocked = blockPurchaseInApp(req)
  if (appBlocked) return appBlocked
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  try {
    const r = await cancelPause(user.id)
    return NextResponse.json({ success: true, ...r })
  } catch (err) {
    return pauseErrorResponse(err)
  }
}

function pauseErrorResponse(err: unknown) {
  if (err instanceof PauseError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[billing/pause]', msg)
  return NextResponse.json({ error: 'Der Zahlungsdienst ist gerade nicht erreichbar. Bitte versuch es gleich noch einmal.' }, { status: 500 })
}
