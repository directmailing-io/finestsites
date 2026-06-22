import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, formSchemas } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'

async function assertAdmin(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isAdmin: true },
  })
  return profile?.isAdmin ? user : null
}

type Params = { params: Promise<{ id: string }> }

// GET /api/admin/templates/[id]/form-schemas
export async function GET(req: NextRequest, { params }: Params) {
  const user = await assertAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const data = await db.query.formSchemas.findMany({
      where: eq(formSchemas.templateId, id),
      orderBy: asc(formSchemas.createdAt),
    })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 })
  }
}

// POST /api/admin/templates/[id]/form-schemas
export async function POST(req: NextRequest, { params }: Params) {
  const user = await assertAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const formName = (body.form_name ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const title = (body.title ?? '').trim()

  if (!formName || !title) {
    return NextResponse.json({ error: 'form_name und title sind erforderlich.' }, { status: 400 })
  }

  try {
    const [data] = await db
      .insert(formSchemas)
      .values({
        templateId: id,
        formName,
        title,
        fields: Array.isArray(body.fields) ? body.fields : [],
        emailNotificationEnabled: body.email_notification_enabled ?? true,
      })
      .returning()

    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    // Unique constraint violation on (template_id, form_name)
    if (err?.code === '23505') {
      return NextResponse.json({ error: `Formular-Name "${formName}" ist bereits vergeben.` }, { status: 409 })
    }
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 })
  }
}
