import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, formSchemas } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

async function assertAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return null
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  })
  return userRow?.isAdmin ? user : null
}

type Params = { params: Promise<{ id: string; formId: string }> }

// PATCH /api/admin/templates/[id]/form-schemas/[formId]
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await assertAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, formId } = await params
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.title !== undefined) update.title = body.title.trim()
  if (body.fields !== undefined) update.fields = body.fields
  if (body.email_notification_enabled !== undefined) update.emailNotificationEnabled = body.email_notification_enabled
  if (body.form_name !== undefined) {
    update.formName = body.form_name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const [updated] = await db.update(formSchemas)
    .set(update)
    .where(and(eq(formSchemas.id, formId), eq(formSchemas.templateId, id)))
    .returning()

  return NextResponse.json(updated)
}

// DELETE /api/admin/templates/[id]/form-schemas/[formId]
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await assertAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, formId } = await params

  await db.delete(formSchemas)
    .where(and(eq(formSchemas.id, formId), eq(formSchemas.templateId, id)))

  return NextResponse.json({ success: true })
}
