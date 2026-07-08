import { NextRequest, NextResponse } from 'next/server'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, impersonationRequests } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/** GET /api/admin/impersonate/enter?token=xxx — admin activates approved impersonation session */
export async function GET(req: NextRequest) {
  const admin = await getRealUserFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminProfile = await db.query.users.findFirst({ where: eq(users.id, admin.id), columns: { isAdmin: true } })
  if (!adminProfile?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const record = await db.query.impersonationRequests.findFirst({
    where: and(
      eq(impersonationRequests.token, token),
      eq(impersonationRequests.adminId, admin.id),
      eq(impersonationRequests.status, 'approved'),
    ),
  })
  if (!record) return NextResponse.json({ error: 'Token not found or not approved' }, { status: 404 })

  // Activate: extend expiry to 2 hours from now
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000)
  await db.update(impersonationRequests)
    .set({ status: 'active', expiresAt })
    .where(eq(impersonationRequests.id, record.id))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io'
  const response = NextResponse.redirect(`${appUrl}/dashboard`)

  response.cookies.set('fs-impersonation', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 2 * 60 * 60, // 2 hours
  })

  return response
}
