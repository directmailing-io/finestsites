import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { impersonationRequests, users } from '@/lib/db/schema'
import { eq, and, gt, desc } from 'drizzle-orm'

/**
 * GET /api/impersonate/pending
 * Returns the current impersonation state for the logged-in user:
 *   state: 'pending'  — admin requested access, waiting for approval
 *   state: 'active'   — admin is currently in the account
 *   state: null       — nothing going on
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ state: null, request: null })

  // Look for the most recent non-expired, non-rejected/ended record
  const record = await db.query.impersonationRequests.findFirst({
    where: and(
      eq(impersonationRequests.userId, user.id),
      gt(impersonationRequests.expiresAt, new Date()),
    ),
    orderBy: [desc(impersonationRequests.createdAt)],
  })

  if (!record || (record.status !== 'pending' && record.status !== 'active')) {
    return NextResponse.json({ state: null, request: null })
  }

  const admin = await db.query.users.findFirst({
    where: eq(users.id, record.adminId),
    columns: { username: true, firstName: true, lastName: true },
  })
  const adminName = admin?.username
    ? `@${admin.username}`
    : [admin?.firstName, admin?.lastName].filter(Boolean).join(' ') || 'Admin'

  return NextResponse.json({
    state: record.status, // 'pending' | 'active'
    request: {
      id: record.id,
      token: record.token,
      adminName,
      expiresAt: record.expiresAt,
    },
  })
}
