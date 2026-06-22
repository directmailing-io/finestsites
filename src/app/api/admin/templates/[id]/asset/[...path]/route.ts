import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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

async function checkAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return null
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  })
  return userRow?.isAdmin ? user : null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const user = await checkAdmin(req)
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id, path: pathSegments } = await params

  const template = await db.query.templates.findFirst({
    where: eq(templates.id, id),
  })

  if (!template?.r2BundlePath) {
    return new NextResponse('Template not found', { status: 404 })
  }

  // Derive the base directory from r2BundlePath (strip filename)
  const baseDir = template.r2BundlePath.replace(/\/[^/]+$/, '')

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
