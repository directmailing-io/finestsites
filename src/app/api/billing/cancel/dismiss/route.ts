import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { dismissCancellation } from '@/lib/billing/cancellation'

/** Fenster geschlossen, ohne etwas zu entscheiden. { feedback_id } */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  const body = await req.json().catch(() => null) as { feedback_id?: unknown } | null
  await dismissCancellation(user.id, typeof body?.feedback_id === 'string' ? body.feedback_id : null).catch(() => {})
  return NextResponse.json({ success: true })
}
