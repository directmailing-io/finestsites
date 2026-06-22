import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { uploadToR2 } from '@/lib/r2/client'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp']
  if (!allowedExts.includes(ext)) return NextResponse.json({ error: 'Ungültiges Format (jpg, png, webp)' }, { status: 400 })

  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Datei zu groß (max. 5 MB)' }, { status: 400 })

  // Always overwrite the same key so old avatars are replaced
  const key = `profile-images/${user.id}/avatar.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadToR2(key, buffer, file.type)

  const origin = new URL(req.url).origin
  const url = `${origin}/api/media/${key}`

  // Save to user profile
  await db.update(users)
    .set({ profileImageUrl: url })
    .where(eq(users.id, user.id))

  return NextResponse.json({ url })
}
