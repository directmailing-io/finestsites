import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('users').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ? user : null
}

type Params = { params: Promise<{ id: string; formId: string }> }

// PATCH /api/admin/templates/[id]/form-schemas/[formId]
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, formId } = await params
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.title !== undefined) update.title = body.title.trim()
  if (body.fields !== undefined) update.fields = body.fields
  if (body.email_notification_enabled !== undefined) update.email_notification_enabled = body.email_notification_enabled
  if (body.form_name !== undefined) {
    update.form_name = body.form_name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('form_schemas')
    .update(update)
    .eq('id', formId)
    .eq('template_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/admin/templates/[id]/form-schemas/[formId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, formId } = await params
  const admin = createAdminClient()
  await admin.from('form_schemas').delete().eq('id', formId).eq('template_id', id)
  return NextResponse.json({ success: true })
}
