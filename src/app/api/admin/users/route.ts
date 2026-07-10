import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getRealUserFromRequest } from '@/lib/auth/server'

export async function GET(req: NextRequest) {
  const user = await getRealUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isAdmin: true },
  })
  if (!profile?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const data = await db.query.users.findMany({
      orderBy: desc(users.createdAt),
      columns: {
        id: true,
        email: true,
        username: true,
        plan: true,
        billingInterval: true,
        subscriptionStatus: true,
        createdAt: true,
      },
    })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 })
  }
}
