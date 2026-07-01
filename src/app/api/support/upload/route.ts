import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { uploadToR2 } from '@/lib/r2/client'
import { randomUUID } from 'crypto'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB before processing

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed. Use JPEG, PNG, GIF, or WebP.' }, { status: 400 })
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // No sharp available — upload original file
    const processedBuffer = buffer
    const finalContentType = file.type
    const rawExt = file.type.split('/')[1].replace('jpeg', 'jpg')
    const ext = rawExt === 'gif' ? 'gif' : rawExt === 'webp' ? 'webp' : rawExt === 'png' ? 'png' : 'jpg'

    // Upload to R2
    const key = `support-media/${user.id}/${randomUUID()}.${ext}`
    await uploadToR2(key, processedBuffer, finalContentType)

    // Return the R2 key — the client will use /api/support/media?key= to serve it
    return NextResponse.json({
      url: `/api/support/media?key=${encodeURIComponent(key)}`,
      name: file.name,
      size: processedBuffer.length,
      contentType: finalContentType,
    })
  } catch (e) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
