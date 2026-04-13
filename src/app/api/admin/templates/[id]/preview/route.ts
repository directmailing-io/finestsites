import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFromR2 } from '@/lib/r2/client'
import { renderTemplate } from '@/lib/utils/template-engine'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ? user : null
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: template } = await admin.from('templates').select('*').eq('id', id).single()
  if (!template?.r2_bundle_path) {
    return new NextResponse(`<!DOCTYPE html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#94a3b8">Noch keine HTML-Datei hochgeladen</body></html>`, { headers: { 'Content-Type': 'text/html' } })
  }

  let html: string
  try {
    html = await getFromR2(template.r2_bundle_path)
  } catch {
    return new NextResponse('Datei nicht gefunden', { status: 500 })
  }

  // Use preview_values first, then default_value
  const fields = template.placeholder_schema?.fields ?? []
  const previewValues: Record<string, string> = template.placeholder_schema?.preview_values ?? {}
  const dataMap: Record<string, string> = {}
  for (const f of fields) {
    dataMap[f.key] = previewValues[f.key] ?? f.default_value ?? `[${f.label ?? f.key}]`
  }

  const rendered = renderTemplate(html, dataMap)
  return new NextResponse(rendered, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'SAMEORIGIN', 'Cache-Control': 'no-store' }
  })
}
