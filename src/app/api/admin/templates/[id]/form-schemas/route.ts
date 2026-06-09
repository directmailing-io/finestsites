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

type Params = { params: Promise<{ id: string }> }

// GET /api/admin/templates/[id]/form-schemas
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('form_schemas')
    .select('*')
    .eq('template_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/admin/templates/[id]/form-schemas
export async function POST(req: NextRequest, { params }: Params) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const formName = (body.form_name ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const title = (body.title ?? '').trim()

  if (!formName || !title) {
    return NextResponse.json({ error: 'form_name und title sind erforderlich.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('form_schemas')
    .insert({
      template_id: id,
      form_name: formName,
      title,
      fields: Array.isArray(body.fields) ? body.fields : [],
      email_notification_enabled: body.email_notification_enabled ?? true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `Formular-Name "${formName}" ist bereits vergeben.` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
