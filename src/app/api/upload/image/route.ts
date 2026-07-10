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

  const buffer = Buffer.from(await file.arrayBuffer())

  // Validate magic bytes — extension/content-type spoofing can't bypass this
  const sig = buffer.subarray(0, 12)
  const isJpeg = sig[0] === 0xFF && sig[1] === 0xD8 && sig[2] === 0xFF
  const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4E && sig[3] === 0x47
  const isGif = sig[0] === 0x47 && sig[1] === 0x49 && sig[2] === 0x46
  const isWebp = sig[8] === 0x57 && sig[9] === 0x45 && sig[10] === 0x42 && sig[11] === 0x50
  if (!isJpeg && !isPng && !isGif && !isWebp) {
    return NextResponse.json({ error: 'Ungültiges Bildformat' }, { status: 400 })
  }

  // Use the detected type instead of trusting the browser-reported content-type
  const detectedType = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : isGif ? 'image/gif' : 'image/webp'
  const safeExt = isJpeg ? 'jpg' : isPng ? 'png' : isGif ? 'gif' : 'webp'

  const key = `user-images/${user.id}/${crypto.randomUUID()}.${safeExt}`
  await uploadToR2(key, buffer, detectedType)

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')
  return NextResponse.json({ url: `${appUrl}/api/media/${key}` })
}
