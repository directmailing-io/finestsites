import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, supportConversations } from '@/lib/db/schema'
import { eq, gt, sum } from 'drizzle-orm'

async function checkAdmin(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  return profile?.isAdmin ? user : null
}

export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await db
      .select({ total: sum(supportConversations.unreadByAdmin) })
      .from(supportConversations)
      .where(gt(supportConversations.unreadByAdmin, 0))

    return NextResponse.json({ total: Number(rows[0]?.total ?? 0) })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
