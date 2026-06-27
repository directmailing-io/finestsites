/**
 * Public (unauthenticated) template preview.
 *
 * Serves rendered template HTML for the live preview iframe on the marketing
 * template detail page (/vorlagen/[id]).
 *
 * Preview data hierarchy (per field):
 *   1. field.preview_value  — admin-set demo value (single source of truth)
 *   2. schema.preview_values[key] — legacy fallback
 *   3. field.default_value  — fallback
 *
 * ?data=<base64url JSON> can override fields that have preview_interactive: true.
 * All other overrides are silently ignored (security: visitors can only change
 * fields the admin explicitly marked as interactive).
 *
 * Preview-mode security is injected at the bottom of <body>:
 *   - All form submissions are blocked
 *   - All link navigation is blocked (only #anchor links pass through)
 *   - A subtle visual overlay is added to forms
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getFromR2 } from '@/lib/r2/client'
import { renderTemplate } from '@/lib/utils/template-engine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlaceholderField {
  key: string
  default_value?: string
  preview_value?: string
  preview_interactive?: boolean
}

interface PlaceholderSchema {
  fields?: PlaceholderField[]
  preview_values?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Rate limiter: max 60 requests per IP per minute
// ---------------------------------------------------------------------------
const rateLimiter = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimiter.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 60) return false
  entry.count++
  return true
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// ---------------------------------------------------------------------------
// Preview-mode security injection
// ---------------------------------------------------------------------------
// Note: <base> element is injected separately into <head> (see below)
// to fix JS-initiated asset loading (GSAP frame sequences, fetch(), etc.)

const PREVIEW_GUARD = `
<style>
  .fs-preview-block { position:relative; pointer-events:none; }
</style>
<script>
(function(){
  // Block all form submissions
  document.addEventListener('submit', function(e){
    e.preventDefault(); e.stopImmediatePropagation(); return false;
  }, true);
  // Block external link navigation; handle #anchor links via scrollIntoView
  document.addEventListener('click', function(e){
    var el = e.target;
    while(el && el.tagName !== 'A') el = el.parentElement;
    if(!el) return;
    var href = el.getAttribute('href') || '';
    if(href === '' || href.startsWith('javascript')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if(href.startsWith('#')) {
      var id = href.slice(1);
      var target = document.getElementById(id) || document.querySelector('[name="'+id+'"]');
      if(target) target.scrollIntoView({behavior:'smooth'});
    }
  }, true);
})();
</script>`

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req)
  if (!checkRateLimit(ip)) {
    return new NextResponse('Too Many Requests', { status: 429 })
  }

  const { id } = await params

  const template = await db.query.templates.findFirst({
    where: and(
      eq(templates.id, id),
      eq(templates.status, 'published'),
      eq(templates.isTest, false)
    ),
  })

  if (!template?.r2BundlePath) {
    return new NextResponse(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb;color:#94a3b8;flex-direction:column;gap:12px}
svg{opacity:0.4}p{font-size:14px;font-weight:500}</style></head>
<body><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
<p>No preview available</p></body></html>`,
      {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    )
  }

  let html: string
  try {
    html = await getFromR2(template.r2BundlePath)
  } catch {
    return new NextResponse('Template file not found.', { status: 500 })
  }

  // ---------------------------------------------------------------------------
  // Inject <base> so ALL relative URLs (including JS fetch/Image/XHR) resolve
  // through the asset proxy — critical for GSAP frame sequences, video, etc.
  // ---------------------------------------------------------------------------
  const assetOrigin = `/api/templates/${id}/public-preview/asset/`
  const baseTag = `<base href="${assetOrigin}">`
  html = html.includes('<head>')
    ? html.replace('<head>', `<head>\n${baseTag}`)
    : html.replace(/<html[^>]*>/i, m => `${m}\n${baseTag}`)

  // ---------------------------------------------------------------------------
  // Build preview data map
  // Priority: field.preview_value > preview_values[key] > field.default_value
  // ---------------------------------------------------------------------------
  const schema = (template.placeholderSchema ?? {}) as PlaceholderSchema
  const fields = schema.fields ?? []
  const legacyPreviewValues: Record<string, string> = schema.preview_values ?? {}

  const dataMap: Record<string, string> = {}
  for (const f of fields) {
    dataMap[f.key] =
      f.preview_value !== undefined && f.preview_value !== ''
        ? f.preview_value
        : (legacyPreviewValues[f.key] ?? f.default_value ?? '')
  }

  // ---------------------------------------------------------------------------
  // Allow ?data=base64url overrides ONLY for preview_interactive fields
  // ---------------------------------------------------------------------------
  const interactiveKeys = new Set(
    fields.filter(f => f.preview_interactive).map(f => f.key)
  )

  const dataParam = req.nextUrl.searchParams.get('data')
  if (dataParam) {
    try {
      const overrides = JSON.parse(
        Buffer.from(dataParam, 'base64url').toString('utf8')
      ) as Record<string, string>
      for (const [key, value] of Object.entries(overrides)) {
        if (interactiveKeys.has(key) && typeof value === 'string') {
          dataMap[key] = value
        }
      }
    } catch { /* ignore malformed param */ }
  }

  // ---------------------------------------------------------------------------
  // Rewrite relative asset paths → public-preview asset proxy
  // ---------------------------------------------------------------------------
  const assetBase = `/api/templates/${id}/public-preview/asset`

  // <link href="..."> (CSS)
  html = html.replace(
    /(<link[^>]+href=")(?!https?:\/\/|\/\/|data:|#)([^"]+)(")/gi,
    (_m, pre, href, post) => `${pre}${assetBase}/${href}${post}`
  )
  // <script src="...">
  html = html.replace(
    /(<script[^>]+src=")(?!https?:\/\/|\/\/|data:)([^"]+)(")/gi,
    (_m, pre, src, post) => `${pre}${assetBase}/${src}${post}`
  )
  // <img src="...">, <source src="...">, <video src="...">, <audio src="...">
  html = html.replace(
    /(<(?:img|source|video|audio)[^>]+src=")(?!https?:\/\/|\/\/|data:|#)([^"]+)(")/gi,
    (_m, pre, src, post) => `${pre}${assetBase}/${src}${post}`
  )
  // srcset="..."
  html = html.replace(
    /( srcset=")([^"]+)(")/gi,
    (_m, pre, srcset, post) => {
      const rewritten = srcset.replace(
        /(^|,\s*)(?!https?:\/\/|\/\/|data:)(\S+)/g,
        (_s: string, sep: string, url: string) => {
          const [path, size] = url.split(/\s+/)
          return `${sep}${assetBase}/${path}${size ? ' ' + size : ''}`
        }
      )
      return `${pre}${rewritten}${post}`
    }
  )
  // CSS url() in inline styles and <style> blocks
  html = html.replace(
    /url\(['"]?(?!https?:\/\/|\/\/|data:|#)([^'")]+)['"]?\)/gi,
    (_m: string, path: string) => `url('${assetBase}/${path}')`
  )

  // ---------------------------------------------------------------------------
  // Render template + inject preview security guard
  // ---------------------------------------------------------------------------
  let rendered = renderTemplate(html, dataMap)

  // Inject security guard before </body>
  rendered = rendered.includes('</body>')
    ? rendered.replace('</body>', `${PREVIEW_GUARD}\n</body>`)
    : rendered + PREVIEW_GUARD

  return new NextResponse(rendered, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
