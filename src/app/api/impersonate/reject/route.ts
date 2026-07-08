import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { impersonationRequests } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/** POST /api/impersonate/reject — user denies impersonation access */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const record = await db.query.impersonationRequests.findFirst({
    where: and(
      eq(impersonationRequests.token, token),
      eq(impersonationRequests.userId, user.id),
    ),
  })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.update(impersonationRequests)
    .set({ status: 'rejected' })
    .where(eq(impersonationRequests.id, record.id))

  return NextResponse.json({ ok: true })
}
