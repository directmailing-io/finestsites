import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, or, ilike, and, isNotNull } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

// GET /api/affiliate/validate?code=<username or name>
// Searches by exact username match first, then falls back to case-insensitive
// partial match on the full name (firstName + lastName).
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim()
  if (!code) return NextResponse.json({ error: 'Code fehlt' }, { status: 400 })

  const codeLower = code.toLowerCase()

  try {
    // 1. Try exact username match (case-insensitive)
    let user = await db.query.users.findFirst({
      where: eq(users.username, codeLower),
      columns: { username: true, firstName: true },
    })

    // 2. If no username match, try partial display name search
    if (!user) {
      user = await db
        .select({ username: users.username, firstName: users.firstName })
        .from(users)
        .where(
          and(
            isNotNull(users.username),
            or(
              ilike(users.firstName, `%${code}%`),
              ilike(users.lastName, `%${code}%`),
              ilike(
                sql`COALESCE(${users.firstName}, '') || ' ' || COALESCE(${users.lastName}, '')`,
                `%${code}%`
              )
            )
          )
        )
        .limit(1)
        .then(rows => rows[0] ?? null)
    }

    if (!user) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    return NextResponse.json({ valid: true, username: user.username, firstName: user.firstName ?? null })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
