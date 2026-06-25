import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const data = await db.query.templates.findFirst({ where: eq(templates.id, id) })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  // Map snake_case body fields to camelCase Drizzle column names
  const updateValues: Record<string, unknown> = {}
  const fieldMap: Record<string, string> = {
    title: 'title',
    description: 'description',
    domain: 'domain',
    status: 'status',
    placeholder_schema: 'placeholderSchema',
    preview_images: 'previewImages',
    r2_bundle_path: 'r2BundlePath',
    schema_version: 'schemaVersion',
    is_test: 'isTest',
    is_free: 'isFree',
    tags: 'tags',
    badge: 'badge',
    slug: 'slug',
    detail_color: 'detailColor',
  }
  for (const [snake, camel] of Object.entries(fieldMap)) {
    if (snake in body) updateValues[camel] = body[snake]
    else if (camel in body) updateValues[camel] = body[camel]
  }

  try {
    const [data] = await db.update(templates).set(updateValues as any).where(eq(templates.id, id)).returning()
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    await db.delete(templates).where(eq(templates.id, id))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500 })
  }
}
