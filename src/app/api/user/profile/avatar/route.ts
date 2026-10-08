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

  const buffer = Buffer.from(await file.arrayBuffer())
  // Magic Bytes prüfen und den erkannten Typ speichern – der vom Browser gemeldete
  // Content-Type ist frei wählbar (sonst ließe sich HTML als "avatar.png" ausliefern).
  const sig = buffer.subarray(0, 12)
  const isJpeg = sig[0] === 0xFF && sig[1] === 0xD8 && sig[2] === 0xFF
  const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4E && sig[3] === 0x47
  const isWebp = sig[8] === 0x57 && sig[9] === 0x45 && sig[10] === 0x42 && sig[11] === 0x50
  if (!isJpeg && !isPng && !isWebp) return NextResponse.json({ error: 'Ungültiges Bildformat (jpg, png, webp)' }, { status: 400 })
  const detectedType = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : 'image/webp'
  const safeExt = isJpeg ? 'jpg' : isPng ? 'png' : 'webp'

  // Always overwrite the same key so old avatars are replaced
  const key = `profile-images/${user.id}/avatar.${safeExt}`
  await uploadToR2(key, buffer, detectedType)

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')
  const url = `${appUrl}/api/media/${key}`

  // Save to user profile
  await db.update(users)
    .set({ profileImageUrl: url })
    .where(eq(users.id, user.id))

  return NextResponse.json({ url })
}
