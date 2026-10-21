import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { approveImpersonationRequest } from '@/lib/impersonation/consent'

/** POST /api/impersonate/approve — user grants impersonation access */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const ok = await approveImpersonationRequest(user.id, token)
  if (!ok) return NextResponse.json({ error: 'Request not found or expired' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
