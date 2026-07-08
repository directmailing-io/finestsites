import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { impersonationRequests, users } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'

/** GET /api/impersonate/pending — returns any pending impersonation request for the logged-in user */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ request: null })

  const record = await db.query.impersonationRequests.findFirst({
    where: and(
      eq(impersonationRequests.userId, user.id),
      eq(impersonationRequests.status, 'pending'),
      gt(impersonationRequests.expiresAt, new Date()),
    ),
  })

  if (!record) return NextResponse.json({ request: null })

  // Also fetch admin's display name
  const admin = await db.query.users.findFirst({
    where: eq(users.id, record.adminId),
    columns: { username: true, firstName: true, lastName: true },
  })
  const adminName = admin?.username
    ? `@${admin.username}`
    : [admin?.firstName, admin?.lastName].filter(Boolean).join(' ') || 'Admin'

  return NextResponse.json({
    request: {
      id: record.id,
      token: record.token,
      adminName,
      expiresAt: record.expiresAt,
    },
  })
}
