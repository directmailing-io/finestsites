import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { uploadToR2 } from '@/lib/r2/client'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp']
  if (!allowedExts.includes(ext)) return NextResponse.json({ error: 'Ungültiges Format' }, { status: 400 })

  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) return NextResponse.json({ error: 'Datei zu groß (max. 5 MB)' }, { status: 400 })

  const key = `user-images/${user.id}/${crypto.randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadToR2(key, buffer, file.type)

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')
  return NextResponse.json({ url: `${appUrl}/api/media/${key}` })
}
