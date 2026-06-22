import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, templates } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'

async function checkAdmin(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isAdmin: true },
  })
  return profile?.isAdmin ? user : null
}

export async function GET(req: NextRequest) {
  const user = await checkAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await db.query.templates.findMany({
      orderBy: desc(templates.createdAt),
    })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await checkAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, domain, placeholder_schema, preview_images } = body

  if (!title || !domain) {
    return NextResponse.json({ error: 'Titel und Domain sind Pflichtfelder.' }, { status: 400 })
  }

  try {
    const [data] = await db.insert(templates).values({
      title,
      description: description ?? null,
      domain,
      placeholderSchema: placeholder_schema || { version: 1, fields: [] },
      previewImages: preview_images || [],
      status: 'draft',
    }).returning()

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 })
  }
}
