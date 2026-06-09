import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ? user : null
}

// GET /api/admin/templates/[id]/access → list whitelisted users
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await checkAdmin()
  if (!admin_user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('template_access')
    .select('id, user_id, granted_at, users!template_access_user_id_fkey(email, username)')
    .eq('template_id', id)
    .order('granted_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/admin/templates/[id]/access → grant access to a user
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await checkAdmin()
  if (!admin_user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('template_access')
    .upsert({ template_id: id, user_id, granted_by: admin_user.id }, { onConflict: 'template_id,user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/admin/templates/[id]/access → revoke access
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await checkAdmin()
  if (!admin_user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('template_access')
    .delete()
    .eq('template_id', id)
    .eq('user_id', user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
