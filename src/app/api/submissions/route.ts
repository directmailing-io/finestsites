import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/submissions
 * Global submissions view across all the user's sites.
 *
 * Query params:
 *   status  = 'unread' | 'archived' | 'all' (default: 'all')
 *   siteId  = UUID — filter by specific site
 *   search  = string — fulltext search in data JSONB values
 *   form    = string — filter by form_name
 *   page    = number (default: 0), page size: 50
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const status = sp.get('status') ?? 'all'   // 'all' | 'unread' | 'archived'
  const siteId = sp.get('siteId')
  const search = sp.get('search')?.toLowerCase().trim()
  const form = sp.get('form')
  const page = Math.max(0, parseInt(sp.get('page') ?? '0'))
  const pageSize = 50

  const admin = createAdminClient()

  // Get all site IDs owned by this user
  const { data: userSites } = await admin
    .from('user_sites')
    .select('id, templates(title, domain)')
    .eq('user_id', user.id)
    .in('status', ['draft', 'published'])

  if (!userSites || userSites.length === 0) {
    return NextResponse.json({ submissions: [], total: 0 })
  }

  const siteIds = siteId
    ? userSites.filter(s => s.id === siteId).map(s => s.id)
    : userSites.map(s => s.id)

  if (siteIds.length === 0) return NextResponse.json({ submissions: [], total: 0 })

  const siteMap = Object.fromEntries(
    userSites.map(s => [s.id, s.templates])
  )

  // Build query
  let query = admin
    .from('form_submissions')
    .select('*', { count: 'exact' })
    .in('user_site_id', siteIds)
    .eq('is_spam', false)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status === 'unread') {
    query = query.is('read_at', null).is('archived_at', null)
  } else if (status === 'archived') {
    query = query.not('archived_at', 'is', null)
  } else {
    // 'all' = not archived
    query = query.is('archived_at', null)
  }

  if (form) query = query.eq('form_name', form)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Client-side search filter (JSONB text search)
  let submissions = data ?? []
  if (search) {
    submissions = submissions.filter(s =>
      Object.values(s.data as Record<string, string>)
        .some(v => v.toLowerCase().includes(search))
    )
  }

  // Enrich with site metadata
  const enriched = submissions.map(s => ({
    ...s,
    site: siteMap[s.user_site_id] ?? null,
  }))

  return NextResponse.json({ submissions: enriched, total: count ?? 0 })
}
