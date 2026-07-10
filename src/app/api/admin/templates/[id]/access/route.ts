import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, templateAccess } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getRealUserFromRequest } from '@/lib/auth/server'

async function checkAdmin(req: Request) {
  const user = await getRealUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isAdmin: true },
  })
  return profile?.isAdmin ? user : null
}

// GET /api/admin/templates/[id]/access → list whitelisted users
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await checkAdmin(req)
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const data = await db.query.templateAccess.findMany({
      where: eq(templateAccess.templateId, id),
      orderBy: desc(templateAccess.grantedAt),
      with: {
        user: { columns: { email: true, username: true } },
      },
    })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 })
  }
}

// POST /api/admin/templates/[id]/access → grant access to a user
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await checkAdmin(req)
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  try {
    const [data] = await db
      .insert(templateAccess)
      .values({ templateId: id, userId: user_id, grantedBy: adminUser.id })
      .onConflictDoUpdate({
        target: [templateAccess.templateId, templateAccess.userId],
        set: { grantedBy: adminUser.id, grantedAt: new Date() },
      })
      .returning()

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 })
  }
}

// DELETE /api/admin/templates/[id]/access → revoke access
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await checkAdmin(req)
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  try {
    await db.delete(templateAccess).where(
      and(eq(templateAccess.templateId, id), eq(templateAccess.userId, user_id))
    )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 })
  }
}
