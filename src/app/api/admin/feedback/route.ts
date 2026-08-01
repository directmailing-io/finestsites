import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { getRealUserFromRequest } from '@/lib/auth/server'

// Temporäre Feedback-Kampagne (anonym). Zum vollständigen Entfernen:
// siehe docs/feedback-aktion-entfernen.md

async function assertAdmin(req: NextRequest) {
  const user = await getRealUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  if (!profile?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function DELETE(req: NextRequest) {
  const err = await assertAdmin(req)
  if (err) return err

  await db.execute(sql`DELETE FROM feedback_responses`)
  return NextResponse.json({ ok: true })
}
