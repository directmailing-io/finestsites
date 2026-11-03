import { NextRequest, NextResponse } from 'next/server'
import { blockPurchaseInApp } from '@/lib/app-mode'
import { getUserFromRequest } from '@/lib/auth/server'
import { deletionPendingResponse } from '@/lib/account-deletion/guard'
import { acceptOffer, isOfferAction } from '@/lib/billing/cancellation'
import { cancellationErrorResponse } from '../_shared'

/**
 * Kündigungsflow, Schritt 2: Angebot annehmen.
 * { feedback_id?, action: discount|pause|downgrade|yearly_to_monthly|reminder|talk|keep, months?, plan?, message?, also_cancel? }
 */
export async function POST(req: NextRequest) {
  const appBlocked = blockPurchaseInApp(req)
  if (appBlocked) return appBlocked
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  const deletionBlock = await deletionPendingResponse(user.id)
  if (deletionBlock) return deletionBlock
  const body = await req.json().catch(() => null) as { feedback_id?: unknown; action?: unknown; months?: unknown; plan?: unknown; message?: unknown; also_cancel?: unknown } | null
  if (!isOfferAction(body?.action)) return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
  const feedbackId = typeof body?.feedback_id === 'string' ? body.feedback_id : null
  try {
    const r = await acceptOffer(user.id, feedbackId, body!.action, { months: body?.months, plan: body?.plan, message: body?.message, alsoCancel: body?.also_cancel })
    return NextResponse.json({ success: true, ...r })
  } catch (err) {
    return cancellationErrorResponse(err)
  }
}
