import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { impersonationRequests } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'

/** POST /api/impersonate/approve — user grants impersonation access */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const record = await db.query.impersonationRequests.findFirst({
    where: and(
      eq(impersonationRequests.token, token),
      eq(impersonationRequests.userId, user.id),
      eq(impersonationRequests.status, 'pending'),
      gt(impersonationRequests.expiresAt, new Date()),
    ),
  })
  if (!record) return NextResponse.json({ error: 'Request not found or expired' }, { status: 404 })

  await db.update(impersonationRequests)
    .set({ status: 'approved', approvedAt: new Date() })
    .where(eq(impersonationRequests.id, record.id))

  return NextResponse.json({ ok: true })
}
