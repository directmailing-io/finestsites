import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/sites → list current user's sites with template info
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_sites')
    .select('*, templates(id, title, domain, placeholder_schema, r2_bundle_path, preview_images)')
    .eq('user_id', user.id)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
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

  const { count } = await admin.from('user_sites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['draft', 'published'])

  const limits: Record<string, number> = { starter: 1, pro: 3, unlimited: Infinity }
  if ((count ?? 0) >= limits[plan]) {
    return NextResponse.json({ error: 'Plan-Limit erreicht. Bitte upgraden.' }, { status: 403 })
  }

  // Prevent duplicate site for same template
  const { data: existing } = await admin.from('user_sites')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('template_id', template_id)
    .neq('status', 'deleted')
    .single()

  if (existing) {
    return NextResponse.json({ id: existing.id, existing: true })
  }

  const { data, error } = await admin.from('user_sites').insert({
    user_id: user.id,
    template_id,
    status: 'draft',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
