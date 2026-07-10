import { NextRequest, NextResponse } from 'next/server'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { uploadToR2 } from '@/lib/r2/client'
import { processZipUpload } from '@/lib/r2/zip-processor'

async function checkAdmin(req: NextRequest) {
  const user = await getRealUserFromRequest(req)
  if (!user) return null
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  })
  return userRow?.isAdmin ? user : null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin(req)
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

  await db.update(templates)
    .set({ r2BundlePath: bundlePath })
    .where(eq(templates.id, id))

  return NextResponse.json({ success: true, key: bundlePath, fileCount, files })
}
