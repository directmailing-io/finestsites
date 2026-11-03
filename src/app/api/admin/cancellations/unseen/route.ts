import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { unseenCount } from '@/lib/admin/cancellations'

/** Zähler für die Admin-Navigation: neue Kündigungs-Rückmeldungen seit dem letzten Besuch der Seite. */
export async function GET(req: NextRequest) {
  const user = await getRealUserFromRequest(req)
  const profile = user ? await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } }) : null
  if (!profile?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ count: await unseenCount() })
}
