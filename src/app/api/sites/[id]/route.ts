import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { markSiteOffline } from '@/lib/cloudflare/kv'

async function getSiteForUser(siteId: string, userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('user_sites')
    .select('*, templates(id, title, domain, placeholder_schema, r2_bundle_path)')
    .eq('id', siteId)
    .eq('user_id', userId)
    .single()
  return data
}

// GET /api/sites/[id] → get site with its data
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const site = await getSiteForUser(id, user.id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Load site_data as a flat object { key: value }
  const admin = createAdminClient()
  const { data: siteData } = await admin.from('site_data')
    .select('field_key, field_value')
    .eq('user_site_id', id)

  const dataMap: Record<string, string> = {}
  for (const row of siteData ?? []) {
    dataMap[row.field_key] = row.field_value ?? ''
  }

  // Include username for URL construction
  const { data: profile } = await admin.from('users').select('username').eq('id', user.id).single()

  return NextResponse.json({ ...site, data: dataMap, username: profile?.username ?? null })
}

// PATCH /api/sites/[id] → save field values (upsert site_data rows)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const site = await getSiteForUser(id, user.id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const admin = createAdminClient()

  // Upsert each field value
  const upserts = Object.entries(body as Record<string, string>).map(([field_key, field_value]) => ({
    user_site_id: id,
    field_key,
    field_value: field_value ?? '',
    updated_at: new Date().toISOString(),
  }))

  if (upserts.length > 0) {
    const { error } = await admin.from('site_data')
      .upsert(upserts, { onConflict: 'user_site_id,field_key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/sites/[id] → HARD DELETE
//
// Permanently removes the user_site row. The ON DELETE CASCADE foreign keys
// on `site_data` and `form_submissions` automatically remove all related rows,
// so the user truly starts from scratch the next time they activate this
// template (no field values, no submissions, no leftover state).
//
// Also: if the site was published we proactively purge the Cloudflare KV cache
// so the public worker stops serving it immediately.
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Fetch info before deletion so we can purge KV
  const { data: site } = await admin.from('user_sites')
    .select('status, templates(domain), users!user_id(username)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Purge Worker cache if it was live
  if (site.status === 'published') {
    const username = (site.users as unknown as { username: string })?.username
    const domain = (site.templates as unknown as { domain: string })?.domain
    if (username && domain) {
      try { await markSiteOffline(username, domain) } catch { /* non-fatal */ }
    }
  }

  // Hard delete — site_data + form_submissions cascade away
  const { error } = await admin.from('user_sites')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
