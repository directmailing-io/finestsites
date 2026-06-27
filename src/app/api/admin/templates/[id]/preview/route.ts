import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getFromR2 } from '@/lib/r2/client'
import { renderTemplate } from '@/lib/utils/template-engine'

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
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params

  const template = await db.query.templates.findFirst({
    where: eq(templates.id, id),
  })

  if (!template?.r2BundlePath) {
    return new NextResponse(`<!DOCTYPE html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#94a3b8">Noch keine HTML-Datei hochgeladen</body></html>`, { headers: { 'Content-Type': 'text/html' } })
  }

  let html: string
  try {
    html = await getFromR2(template.r2BundlePath)
  } catch {
    return new NextResponse('Datei nicht gefunden', { status: 500 })
  }

  // Use preview_values first, then default_value
  const schema = template.placeholderSchema as { fields?: Array<{ key: string; label?: string; default_value?: string }>; preview_values?: Record<string, string> } | null
  const fields = schema?.fields ?? []
  const previewValues: Record<string, string> = schema?.preview_values ?? {}
  const dataMap: Record<string, string> = {}
  for (const f of fields) {
    dataMap[f.key] = previewValues[f.key] ?? f.default_value ?? `[${f.label ?? f.key}]`
  }

  let rendered = renderTemplate(html, dataMap)

  // Override viewport to force 1280px width (iOS Safari renders iframe at device-width otherwise)
  rendered = rendered.replace(
    /<meta\s+name=["']viewport["'][^>]*>/gi,
    '<meta name="viewport" content="width=1280, initial-scale=1">'
  )

  // Inject <base> tag so relative asset paths resolve to our asset-serving route
  const baseTag = `<base href="/api/admin/templates/${id}/asset/">`
  const withBase = rendered.replace(/(<head[^>]*>)/i, `$1\n  ${baseTag}`)

  return new NextResponse(withBase, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'SAMEORIGIN', 'Cache-Control': 'no-store' }
  })
}
