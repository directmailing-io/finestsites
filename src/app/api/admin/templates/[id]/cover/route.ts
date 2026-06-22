import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { uploadToR2 } from '@/lib/r2/client'
import crypto from 'crypto'

async function checkAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return null
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  })
  return userRow?.isAdmin ? user : null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Keine Datei angegeben.' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext ?? '')) {
    return NextResponse.json({ error: 'Nur JPG, PNG oder WebP erlaubt.' }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Datei darf max. 10 MB groß sein.' }, { status: 400 })
  }

  const uuid = crypto.randomUUID()
  const key = `template-images/${id}/${uuid}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadToR2(key, buffer, file.type || `image/${ext}`)

  const url = `/api/media/${key}`

  // Save as first preview_image on the template
  const template = await db.query.templates.findFirst({
    where: eq(templates.id, id),
  })
  const existing = (template?.previewImages as string[]) ?? []
  const updated = [url, ...existing.filter((u: string) => !u.includes('/template-images/'))]

  await db.update(templates)
    .set({ previewImages: updated })
    .where(eq(templates.id, id))

  return NextResponse.json({ url })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await db.update(templates)
    .set({ previewImages: [] })
    .where(eq(templates.id, id))

  return NextResponse.json({ success: true })
}
