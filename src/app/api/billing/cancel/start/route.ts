import { NextRequest, NextResponse } from 'next/server'
import { blockPurchaseInApp } from '@/lib/app-mode'
import { getUserFromRequest } from '@/lib/auth/server'
import { deletionPendingResponse } from '@/lib/account-deletion/guard'
import { startCancellation } from '@/lib/billing/cancellation'
import { cancellationErrorResponse } from '../_shared'

/**
 * Kündigungsflow, Schritt 1 (docs/kuendigung/konzept.html): { reason, comment? } → Grund speichern,
 * passendes Angebot liefern. Nur im Browser (Apple 3.1.1: in der App keine Abo-Schnittstellen).
 */
export async function POST(req: NextRequest) {
  const appBlocked = blockPurchaseInApp(req)
  if (appBlocked) return appBlocked
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  const deletionBlock = await deletionPendingResponse(user.id)
  if (deletionBlock) return deletionBlock
  const body = await req.json().catch(() => null) as { reason?: unknown; comment?: unknown } | null
  try {
    const result = await startCancellation(user.id, body?.reason, body?.comment)
    return NextResponse.json({ success: true, feedback_id: result.id, offer: result.offer })
  } catch (err) {
    return cancellationErrorResponse(err)
  }
}
