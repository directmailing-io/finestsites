import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { getRawFromR2 } from '@/lib/r2/client'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = new URL(req.url).searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  // Reject path traversal attempts early
  if (key.includes('..') || !key.startsWith('support-media/')) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }

  // Security: verify the key belongs to this user OR the user is admin
  // Key format: support-media/{userId}/{filename}
  const keyUserId = key.split('/')[1]

  if (keyUserId !== user.id) {
    // Check if admin
    const profile = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { isAdmin: true },
    })
    if (!profile?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const { data, contentType } = await getRawFromR2(key)

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
