import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/templates → published templates visible to the current user
// - is_test=false templates: always visible
// - is_test=true templates: only visible if user is in template_access
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch all published templates
  const { data, error } = await admin
    .from('templates')
    .select('id, title, description, domain, preview_images, placeholder_schema, tags, is_test, is_free')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch this user's template access grants
  const { data: accessRows } = await admin
    .from('template_access')
    .select('template_id')
    .eq('user_id', user.id)

  const whitelisted = new Set((accessRows ?? []).map((r: { template_id: string }) => r.template_id))

  // Filter: show non-test templates + whitelisted test templates
  const visible = (data ?? []).filter((t: { is_test: boolean; id: string }) =>
    !t.is_test || whitelisted.has(t.id)
  )

  return NextResponse.json(visible)
}
