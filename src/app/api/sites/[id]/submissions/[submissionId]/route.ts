import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getOwnedSite(siteId: string, userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('user_sites')
    .select('id')
    .eq('id', siteId)
    .eq('user_id', userId)
    .single()
  return data
}

type Params = { params: Promise<{ id: string; submissionId: string }> }

// PATCH /api/sites/[id]/submissions/[submissionId]
// Body: { read?: boolean, archived?: boolean }
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, submissionId } = await params
  const site = await getOwnedSite(id, user.id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as { read?: boolean; archived?: boolean }
  const update: Record<string, string | null> = {}

  if ('read' in body) {
    update.read_at = body.read ? new Date().toISOString() : null
  }
  if ('archived' in body) {
    update.archived_at = body.archived ? new Date().toISOString() : null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('form_submissions')
    .update(update)
    .eq('id', submissionId)
    .eq('user_site_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE /api/sites/[id]/submissions/[submissionId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, submissionId } = await params
  const site = await getOwnedSite(id, user.id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  await admin.from('form_submissions')
    .delete()
    .eq('id', submissionId)
    .eq('user_site_id', id)

  return NextResponse.json({ success: true })
}
