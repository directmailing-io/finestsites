import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { impersonationRequests } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/** POST /api/impersonate/exit — admin ends impersonation, clears cookie */
export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(/(?:^|;\s*)fs-impersonation=([^;]+)/)
  const token = match ? decodeURIComponent(match[1]) : null

  let userId: string | null = null
  if (token) {
    const record = await db.query.impersonationRequests.findFirst({
      where: eq(impersonationRequests.token, token),
    })
    if (record) {
      userId = record.userId
      await db.update(impersonationRequests)
        .set({ status: 'ended' })
        .where(eq(impersonationRequests.id, record.id))
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io'
  const redirectTo = userId ? `${appUrl}/admin/users/${userId}` : `${appUrl}/admin/users`
  const response = NextResponse.redirect(redirectTo)

  response.cookies.set('fs-impersonation', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })

  return response
}
