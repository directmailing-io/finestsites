import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { feedbackCsv, loadFeedback } from '@/lib/admin/cancellations'

/** CSV der Kündigungs-Rückmeldungen (Admin). ?days=30|90|365 */
export async function GET(req: NextRequest) {
  const user = await getRealUserFromRequest(req)
  const profile = user ? await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } }) : null
  if (!profile?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const days = Math.min(3650, Math.max(1, Number(req.nextUrl.searchParams.get('days') ?? 90) || 90))
  const rows = await loadFeedback(days, 5000)
  return new NextResponse(feedbackCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kuendigungen-${days}-tage.csv"`,
    },
  })
}
