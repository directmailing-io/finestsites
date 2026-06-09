import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRawFromR2 } from '@/lib/r2/client'
import path from 'path'

export const runtime = 'nodejs'

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.html': 'text/html',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
}

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ? user : null
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const user = await checkAdmin()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id, path: pathSegments } = await params
  const admin = createAdminClient()

  const { data: template } = await admin
    .from('templates')
    .select('r2_bundle_path')
    .eq('id', id)
    .single()

  if (!template?.r2_bundle_path) {
    return new NextResponse('Template not found', { status: 404 })
  }

  // Derive the base directory from r2_bundle_path (strip filename)
  const baseDir = template.r2_bundle_path.replace(/\/[^/]+$/, '')

  // Construct the R2 key for the requested asset
  const assetPath = pathSegments.join('/')
  const r2Key = `${baseDir}/${assetPath}`

  try {
    const { data, contentType } = await getRawFromR2(r2Key)

    // Determine content type from extension if R2 doesn't provide one
    const ext = path.extname(assetPath).toLowerCase()
    const mime = contentType || MIME_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=3600',
        'X-Frame-Options': 'SAMEORIGIN',
      },
    })
  } catch {
    return new NextResponse('Asset not found', { status: 404 })
  }
}
