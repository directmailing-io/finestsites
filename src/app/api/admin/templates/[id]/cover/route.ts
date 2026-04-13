import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadToR2 } from '@/lib/r2/client'
import crypto from 'crypto'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ? user : null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Keine Datei angegeben.' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext ?? '')) {
    return NextResponse.json({ error: 'Nur JPG, PNG oder WebP erlaubt.' }, { status: 400 })
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Datei darf max. 10 MB groß sein.' }, { status: 400 })
  }

  const uuid = crypto.randomUUID()
  const key = `template-images/${id}/${uuid}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadToR2(key, buffer, file.type || `image/${ext}`)

  const url = `/api/media/${key}`

  // Save as first preview_image on the template
  const admin = createAdminClient()
  const { data: tpl } = await admin.from('templates').select('preview_images').eq('id', id).single()
  const existing: string[] = tpl?.preview_images ?? []
  const updated = [url, ...existing.filter(u => !u.includes('/template-images/'))]

  const { error } = await admin.from('templates')
    .update({ preview_images: updated })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('templates')
    .update({ preview_images: [] })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
