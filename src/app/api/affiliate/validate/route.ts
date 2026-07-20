import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// GET /api/affiliate/validate?code=<username>
// Only accepts exact username match (case-insensitive). Names are not accepted.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim()
  if (!code) return NextResponse.json({ error: 'Code fehlt' }, { status: 400 })

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, code.toLowerCase()),
      columns: { username: true, firstName: true },
    })

    if (!user) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    return NextResponse.json({ valid: true, username: user.username, firstName: user.firstName ?? null })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
