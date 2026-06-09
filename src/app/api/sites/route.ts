import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/sites → list current user's sites with template info + username
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch username
  const { data: profile } = await admin.from('users').select('username').eq('id', user.id).single()

  const { data, error } = await supabase
    .from('user_sites')
    .select('*, templates(id, title, domain, placeholder_schema, r2_bundle_path, preview_images)')
    .eq('user_id', user.id)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const siteIds = (data ?? []).map(s => s.id)

  // Fetch unread submission counts per site
  const unreadMap: Record<string, number> = {}
  if (siteIds.length > 0) {
    const { data: unreadRows } = await admin
      .from('form_submissions')
      .select('user_site_id')
      .in('user_site_id', siteIds)
      .is('read_at', null)
      .is('archived_at', null)
      .eq('is_spam', false)

    for (const row of (unreadRows ?? [])) {
      unreadMap[row.user_site_id] = (unreadMap[row.user_site_id] ?? 0) + 1
    }
  }

  // Attach username + unread_submissions to each site
  const result = (data ?? []).map(s => ({
    ...s,
    username: profile?.username ?? null,
    unread_submissions: unreadMap[s.id] ?? 0,
  }))
  return NextResponse.json(result)
}

// POST /api/sites → create a new draft site for a template
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { template_id } = await req.json()
  if (!template_id) return NextResponse.json({ error: 'template_id required' }, { status: 400 })

  // Check plan limits
  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('plan').eq('id', user.id).single()
  const plan = profile?.plan ?? 'starter'

  // Check if the template being activated is a test template the user has no access to
  const { data: tpl } = await admin.from('templates').select('is_test, is_free').eq('id', template_id).single()
  if (tpl?.is_test) {
    const { data: access } = await admin.from('template_access')
      .select('id').eq('template_id', template_id).eq('user_id', user.id).single()
    if (!access) return NextResponse.json({ error: 'Kein Zugriff auf dieses Template.' }, { status: 403 })
  }

  // Drafts do NOT count toward the plan limit — users can freely experiment.
  // The limit is enforced at PUBLISH time (see api/sites/[id]/publish).
  // We still keep the `plan` variable readable for downstream features.
  void plan

  // Check for any existing row (including soft-deleted)
  const { data: anyExisting } = await admin.from('user_sites')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('template_id', template_id)
    .single()

  if (anyExisting && anyExisting.status !== 'deleted') {
    return NextResponse.json({ id: anyExisting.id, existing: true })
  }

  // Reactivate soft-deleted row (legacy support for pre-hard-delete data).
  // Clear any old field values and submissions first so the user starts blank.
  if (anyExisting && anyExisting.status === 'deleted') {
    await admin.from('site_data').delete().eq('user_site_id', anyExisting.id)
    await admin.from('form_submissions').delete().eq('user_site_id', anyExisting.id)
    const { data, error } = await admin.from('user_sites')
      .update({
        status: 'draft',
        deactivated_at: null,
        published_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', anyExisting.id)
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  const { data, error } = await admin.from('user_sites').insert({
    user_id: user.id,
    template_id,
    status: 'draft',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
