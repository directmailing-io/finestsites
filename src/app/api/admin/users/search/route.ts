import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, or, ilike, and } from 'drizzle-orm'

async function checkAdmin() {
  const user = await getServerUser()
  if (!user) return null
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isAdmin: true },
  })
  return profile?.isAdmin ? user : null
}

// GET /api/admin/users/search?q=... → search users by email or username
export async function GET(req: NextRequest) {
  const adminUser = await checkAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  const affiliateOnly = req.nextUrl.searchParams.get('affiliate') === 'true'
  if (q.length < 2) return NextResponse.json([])

  try {
    const textFilter = or(
      ilike(users.email, `%${q}%`),
      ilike(users.username, `%${q}%`)
    )
    // affiliateOnly is no longer used — admin can assign any user as a partner
    void affiliateOnly
    const whereClause = textFilter

    const results = await db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(whereClause)
      .orderBy(users.email)
      .limit(20)

    return NextResponse.json(results)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
