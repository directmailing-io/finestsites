import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NM_COMPANIES } from '@/lib/constants/nm-companies'

const VALID_COMPANIES = new Set<string>(NM_COMPANIES)

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const raw = Array.isArray(body.nm_companies) ? body.nm_companies : []
  // Only accept known company names
  const nmCompanies = raw.filter((c: unknown) => typeof c === 'string' && VALID_COMPANIES.has(c))

  try {
    await db.update(users).set({ nmCompanies }).where(eq(users.id, user.id))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
