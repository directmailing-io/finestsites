import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

// Serves template static assets (CSS, JS, images) for the preview iframe.
// The preview HTML has its relative CSS/JS hrefs rewritten to point here.
// GET /api/preview/[siteId]/asset/style.css  →  R2: templates/{templateId}/style.css

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

const MIME: Record<string, string> = {
  css:  'text/css; charset=utf-8',
  js:   'application/javascript; charset=utf-8',
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  gif:  'image/gif',
  webp: 'image/webp',
  svg:  'image/svg+xml',
  ico:  'image/x-icon',
  woff: 'font/woff',
  woff2:'font/woff2',
  ttf:  'font/ttf',
}

function mimeFor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return MIME[ext] ?? 'application/octet-stream'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string; path: string[] }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { siteId, path } = await params
  const assetPath = path.join('/')
  const admin = createAdminClient()

  // Verify user owns this site and get template r2_bundle_path
  const { data: site } = await admin
    .from('user_sites')
    .select('templates(r2_bundle_path)')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single()

  if (!site?.templates) return new NextResponse('Not found', { status: 404 })

  const tpl = Array.isArray(site.templates) ? site.templates[0] : site.templates
  const bundlePath: string | null = (tpl as { r2_bundle_path: string | null }).r2_bundle_path
  if (!bundlePath) return new NextResponse('Not found', { status: 404 })

  // Bundle path is e.g. "templates/abc/index.html" — base dir is "templates/abc"
  const baseDir = bundlePath.replace(/\/index\.html$/, '')
  const r2Key = `${baseDir}/${assetPath}`

  try {
    const obj = await r2.send(new GetObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: r2Key,
    }))
    const bytes = await obj.Body?.transformToByteArray()
    if (!bytes) return new NextResponse('Not found', { status: 404 })

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': mimeFor(assetPath),
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
