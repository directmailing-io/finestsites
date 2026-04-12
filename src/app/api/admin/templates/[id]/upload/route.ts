import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadToR2 } from '@/lib/r2/client'
import { processZipUpload } from '@/lib/r2/zip-processor'

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

  const buffer = Buffer.from(await file.arrayBuffer())
  const isZip = file.name.endsWith('.zip') || file.type === 'application/zip'

  let bundlePath: string
  let fileCount = 1
  let files: string[] = []

  if (isZip) {
    const result = await processZipUpload(buffer, id)
    bundlePath = result.indexPath
    fileCount = result.fileCount
    files = result.files
  } else {
    bundlePath = `templates/${id}/index.html`
    await uploadToR2(bundlePath, buffer, 'text/html; charset=utf-8')
    files = ['index.html']
  }

  const admin = createAdminClient()
  const { error } = await admin.from('templates')
    .update({ r2_bundle_path: bundlePath })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, key: bundlePath, fileCount, files })
}
