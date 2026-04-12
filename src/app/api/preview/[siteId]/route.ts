import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFromR2 } from '@/lib/r2/client'
import { renderTemplate } from '@/lib/utils/template-engine'

// GET /api/preview/[siteId]?data=base64json  → renders template HTML for iframe
// The ?data param overrides stored data for live-preview while user is typing
export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { siteId } = await params
  const admin = createAdminClient()

  const { data: site } = await admin.from('user_sites')
    .select('*, templates(id, title, domain, r2_bundle_path)')
    .eq('id', siteId)
    .eq('user_id', user.id)
    .single()

  if (!site) return new NextResponse('Not found', { status: 404 })
  if (!site.templates?.r2_bundle_path) {
    return new NextResponse(noFilePage(site.templates?.title ?? 'Template'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Load field data: prefer ?data query param (live preview) over stored DB values
  let dataMap: Record<string, string> = {}

  const rawData = req.nextUrl.searchParams.get('data')
  if (rawData) {
    try {
      dataMap = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'))
    } catch {
      // fall back to DB
    }
  }

  if (Object.keys(dataMap).length === 0) {
    const { data: rows } = await admin.from('site_data')
      .select('field_key, field_value')
      .eq('user_site_id', siteId)
    for (const row of rows ?? []) {
      dataMap[row.field_key] = row.field_value ?? ''
    }
  }

  let html: string
  try {
    html = await getFromR2(site.templates.r2_bundle_path)
  } catch {
    return new NextResponse('Template-Datei nicht gefunden.', { status: 500 })
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

function noFilePage(title: string) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;color:#6b7280;}
.box{text-align:center;padding:2rem;}h2{font-size:1rem;font-weight:600;color:#374151;margin-bottom:.5rem;}</style></head>
<body><div class="box"><h2>${title}</h2><p>Noch keine HTML-Datei hochgeladen.</p></div></body></html>`
}
