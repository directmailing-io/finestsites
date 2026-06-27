/**
 * Asset proxy for the public template preview.
 * Serves CSS, JS, images, and fonts from R2 for the public-preview iframe.
 * The preview HTML rewrites relative asset paths to point here.
 * Only assets belonging to published, non-test templates are served.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getRawFromR2 } from '@/lib/r2/client'

// ---------------------------------------------------------------------------
// Rate limiter: max 600 requests per IP per minute
// Templates like fitline have 149 assets — browsers load them in parallel,
// so the limit must be high enough to not block a single page load.
// Cache headers (max-age=86400) ensure subsequent visits don't hit this.
// ---------------------------------------------------------------------------
const rateLimiter = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimiter.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 600) return false
  entry.count++
  return true
}

// ---------------------------------------------------------------------------
// Template validity cache: avoid a DB lookup on every asset request.
// Maps templateId → { valid: boolean, expiresAt: number } with 5-min TTL.
// This reduces 149 DB queries per page load to at most 1 per 5 minutes.
// ---------------------------------------------------------------------------
const templateCache = new Map<string, { valid: boolean; expiresAt: number }>()

async function isTemplatePublic(id: string): Promise<boolean> {
  const now = Date.now()
  const cached = templateCache.get(id)
  if (cached && now < cached.expiresAt) return cached.valid

  const tpl = await db.query.templates.findFirst({
    where: and(eq(templates.id, id), eq(templates.status, 'published'), eq(templates.isTest, false)),
    columns: { id: true },
  })
  const valid = !!tpl
  templateCache.set(id, { valid, expiresAt: now + 5 * 60_000 })
  return valid
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// ---------------------------------------------------------------------------
// MIME type map
// ---------------------------------------------------------------------------
const MIME: Record<string, string> = {
  css:   'text/css; charset=utf-8',
  js:    'application/javascript; charset=utf-8',
  mjs:   'application/javascript; charset=utf-8',
  png:   'image/png',
  jpg:   'image/jpeg',
  jpeg:  'image/jpeg',
  gif:   'image/gif',
  webp:  'image/webp',
  svg:   'image/svg+xml; charset=utf-8',
  ico:   'image/x-icon',
  woff:  'font/woff',
  woff2: 'font/woff2',
  ttf:   'font/ttf',
  otf:   'font/otf',
  json:  'application/json',
  mp4:   'video/mp4',
  webm:  'video/webm',
  ogg:   'video/ogg',
  ogv:   'video/ogg',
  mov:   'video/quicktime',
  avi:   'video/x-msvideo',
  mp3:   'audio/mpeg',
  wav:   'audio/wav',
}

function mimeFor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return MIME[ext] ?? 'application/octet-stream'
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const ip = getClientIp(req)
  if (!checkRateLimit(ip)) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }

  const { id, path } = await params
  const assetPath = path.join('/')

  // Security: validate no path traversal
  const r2Key = `templates/${id}/${assetPath}`
  if (!r2Key.startsWith(`templates/${id}/`)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Only serve published, non-test templates (cached for 5 min)
  const isPublic = await isTemplatePublic(id)
  if (!isPublic) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const { data, contentType } = await getRawFromR2(r2Key)

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': contentType ?? mimeFor(assetPath),
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
