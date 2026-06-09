import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getOwnedSite(siteId: string, userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('user_sites')
    .select('id, user_id')
    .eq('id', siteId)
    .eq('user_id', userId)
    .single()
  return data
}

// GET /api/sites/[id]/submissions?page=0&form=contact
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const site = await getOwnedSite(id, user.id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '0')
  const form = req.nextUrl.searchParams.get('form')
  const pageSize = 50

  const admin = createAdminClient()
  let query = admin.from('form_submissions')
    .select('*')
    .eq('user_site_id', id)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (form) query = query.eq('form_name', form)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// DELETE /api/sites/[id]/submissions?submissionId=xxx
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const site = await getOwnedSite(id, user.id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const submissionId = req.nextUrl.searchParams.get('submissionId')
  const admin = createAdminClient()

  if (submissionId) {
    await admin.from('form_submissions').delete()
      .eq('id', submissionId)
      .eq('user_site_id', id)
  } else {
    // Delete all
    await admin.from('form_submissions').delete().eq('user_site_id', id)
  }

  return NextResponse.json({ success: true })
}
