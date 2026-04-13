import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFromR2 } from '@/lib/r2/client'
import { renderTemplate } from '@/lib/utils/template-engine'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: template } = await admin
    .from('templates')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .single()

  if (!template?.r2_bundle_path) {
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
    html = await getFromR2(template.r2_bundle_path)
  } catch {
    return new NextResponse('Template-Datei nicht gefunden.', { status: 500 })
  }

  const fields = template.placeholder_schema?.fields ?? []
  const previewValues: Record<string, string> = template.placeholder_schema?.preview_values ?? {}
  const dataMap: Record<string, string> = {}
  for (const f of fields) {
    dataMap[f.key] = previewValues[f.key] ?? f.default_value ?? `[${f.label ?? f.key}]`
  }

  const rendered = renderTemplate(html, dataMap)

  return new NextResponse(rendered, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'SAMEORIGIN',
      'Cache-Control': 'no-store',
    },
  })
}
