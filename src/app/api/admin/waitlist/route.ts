import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { waitlist, users } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'

async function assertAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  if (!profile?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const err = await assertAdmin(req)
  if (err) return err

  const entries = await db.select().from(waitlist).orderBy(desc(waitlist.createdAt))
  const total = entries.length
  const confirmed = entries.filter(e => e.confirmed && !e.unsubscribedAt).length
  const unsubscribed = entries.filter(e => !!e.unsubscribedAt).length

  return NextResponse.json({ entries, stats: { total, confirmed, unsubscribed } })
}
