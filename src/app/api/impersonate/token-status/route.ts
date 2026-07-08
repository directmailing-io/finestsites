import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { impersonationRequests } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * GET /api/impersonate/token-status?token=X
 * Returns the current status of a specific impersonation token for the current user.
 * Used by ImpersonationCard to get accurate initial state + live polling.
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ status: 'expired' })

  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ status: 'expired' })

  const record = await db.query.impersonationRequests.findFirst({
    where: and(
      eq(impersonationRequests.token, token),
      eq(impersonationRequests.userId, user.id),
    ),
  })

  if (!record) return NextResponse.json({ status: 'expired' })

  if (record.expiresAt < new Date()) {
    return NextResponse.json({ status: 'expired' })
  }

  return NextResponse.json({ status: record.status })
}
