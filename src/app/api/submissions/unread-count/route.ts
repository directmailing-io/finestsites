import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/submissions/unread-count
 * Returns the total unread submission count across all the user's sites.
 * Used by the sidebar badge.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ count: 0 })

  const admin = createAdminClient()

  // Get all user site IDs
  const { data: userSites } = await admin
    .from('user_sites')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['draft', 'published'])

  if (!userSites || userSites.length === 0) return NextResponse.json({ count: 0 })

  const siteIds = userSites.map(s => s.id)

  const { count } = await admin
    .from('form_submissions')
    .select('*', { count: 'exact', head: true })
    .in('user_site_id', siteIds)
    .is('read_at', null)
    .is('archived_at', null)
    .eq('is_spam', false)

  return NextResponse.json({ count: count ?? 0 })
}
