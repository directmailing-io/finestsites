import { NextRequest, NextResponse } from 'next/server'
import { blockPurchaseInApp } from '@/lib/app-mode'
import { getUserFromRequest } from '@/lib/auth/server'
import { confirmCancellation } from '@/lib/billing/cancellation'
import { cancellationErrorResponse } from '../_shared'

/** Kündigen (zum Laufzeitende; während einer Pause sofort). { feedback_id? } */
export async function POST(req: NextRequest) {
  const appBlocked = blockPurchaseInApp(req)
  if (appBlocked) return appBlocked
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  const body = await req.json().catch(() => null) as { feedback_id?: unknown } | null
  const feedbackId = typeof body?.feedback_id === 'string' ? body.feedback_id : null
  try {
    const r = await confirmCancellation(user.id, feedbackId)
    return NextResponse.json({ success: true, ...r })
  } catch (err) {
    return cancellationErrorResponse(err)
  }
}
