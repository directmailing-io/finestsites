import { NextRequest, NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { zipSync } from 'fflate'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!

async function checkAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return null
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  })
  return userRow?.isAdmin ? user : null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const prefix = `templates/${id}/`

  const listed = await r2Client.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }))
  const keys = (listed.Contents ?? []).map(o => o.Key!).filter(Boolean)

  if (keys.length === 0) {
    return NextResponse.json({ error: 'Keine Dateien gefunden.' }, { status: 404 })
  }

  const entries: Record<string, Uint8Array> = {}
  await Promise.all(keys.map(async (key) => {
    const res = await r2Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const bytes = await res.Body?.transformToByteArray()
    if (bytes) {
      entries[key.slice(prefix.length)] = bytes
    }
  }))

  const zipped = zipSync(entries)

  const template = await db.query.templates.findFirst({
    where: eq(templates.id, id),
  })
  const filename = (template?.title ?? id).replace(/[^a-z0-9._-]/gi, '_') + '.zip'

  return new NextResponse(Buffer.from(zipped), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
