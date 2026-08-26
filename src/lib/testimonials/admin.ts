import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getRealUserFromRequest } from '@/lib/auth/server'

export async function assertAdmin(req: NextRequest): Promise<NextResponse | null> {
  const user = await getRealUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  if (!profile?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

const KIND_LABELS: Record<string, string> = {
  before_image: 'vorher',
  after_image: 'nachher',
  video: 'video',
  audio: 'audio',
}

export function nameSlug(fullName: string | null): string {
  return (fullName ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'bericht'
}

export function assetFilename(fullName: string | null, kind: string, index: number, r2Key: string): string {
  const ext = r2Key.includes('.') ? r2Key.split('.').pop() : 'bin'
  return `${nameSlug(fullName)}_${KIND_LABELS[kind] ?? kind}-${index}.${ext}`
}
