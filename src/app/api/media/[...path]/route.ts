import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

export async function GET(_: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const key = path.join('/')

  // Only allow specific prefixes
  if (!key.startsWith('user-images/') && !key.startsWith('template-images/') && !key.startsWith('profile-images/')) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: key,
    })
    const response = await r2Client.send(command)
    const bytes = await response.Body?.transformToByteArray()
    if (!bytes) return new NextResponse('Not found', { status: 404 })

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': response.ContentType ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
