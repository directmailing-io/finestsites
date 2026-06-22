import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getFromR2 } from '@/lib/r2/client'
import { renderTemplate } from '@/lib/utils/template-engine'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params

  const template = await db.query.templates.findFirst({
    where: and(eq(templates.id, id), eq(templates.status, 'published')),
  })

  if (!template?.r2BundlePath) {
    return new NextResponse(
      `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb;color:#94a3b8;flex-direction:column;gap:12px}
svg{opacity:0.4}p{font-size:14px;font-weight:500}</style></head>
<body><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
<p>Noch keine Vorschau verfügbar</p></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  let html: string
  try {
    html = await getFromR2(template.r2BundlePath)
  } catch {
    return new NextResponse('Template-Datei nicht gefunden.', { status: 500 })
  }

  const schema = template.placeholderSchema as { fields?: Array<{ key: string; label?: string; default_value?: string }>; preview_values?: Record<string, string> } | null
  const fields = schema?.fields ?? []
  const previewValues: Record<string, string> = schema?.preview_values ?? {}
  const dataMap: Record<string, string> = {}
  for (const f of fields) {
    dataMap[f.key] = previewValues[f.key] ?? f.default_value ?? `[${f.label ?? f.key}]`
  }

  // Rewrite relative CSS/JS/image hrefs so the preview iframe can load them
  // via /api/templates/[id]/asset/[path] (same-origin, authenticated).
  const assetBase = `/api/templates/${id}/asset`
  html = html.replace(
    /(<link[^>]+href=")(?!https?:\/\/|\/\/|data:|#)([^"]+)(")/gi,
    (_m, pre, href, post) => `${pre}${assetBase}/${href}${post}`
  )
  html = html.replace(
    /(<script[^>]+src=")(?!https?:\/\/|\/\/|data:)([^"]+)(")/gi,
    (_m, pre, src, post) => `${pre}${assetBase}/${src}${post}`
  )

  const rendered = renderTemplate(html, dataMap)

  return new NextResponse(rendered, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'SAMEORIGIN',
      'Cache-Control': 'no-store',
    },
  })
}
