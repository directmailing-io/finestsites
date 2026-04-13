import { NextRequest, NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { zipSync } from 'fflate'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ? user : null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin()
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

  const admin = createAdminClient()
  const { data: template } = await admin.from('templates').select('title').eq('id', id).single()
  const filename = (template?.title ?? id).replace(/[^a-z0-9._-]/gi, '_') + '.zip'

  return new NextResponse(Buffer.from(zipped), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
