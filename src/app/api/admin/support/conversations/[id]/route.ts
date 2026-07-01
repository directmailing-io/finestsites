import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, supportConversations, supportMessages } from '@/lib/db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
import { deleteFromR2 } from '@/lib/r2/client'

async function checkAdmin(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  return profile?.isAdmin ? user : null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const conv = await db.query.supportConversations.findFirst({
      where: eq(supportConversations.id, id),
    })
    if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ conversation: conv })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  if (body.status !== undefined && !['open', 'closed', 'waiting'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const set: { status?: string; subject?: string | null; updatedAt: Date } = { updatedAt: new Date() }
  if (body.status !== undefined) set.status = body.status
  if ('subject' in body) set.subject = body.subject ?? null

  try {
    await db
      .update(supportConversations)
      .set(set)
      .where(eq(supportConversations.id, id))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    // Collect R2 keys from messages with uploaded images before cascade-delete
    const mediaMessages = await db
      .select({ mediaUrl: supportMessages.mediaUrl })
      .from(supportMessages)
      .where(and(
        eq(supportMessages.conversationId, id),
        eq(supportMessages.contentType, 'image'),
        isNotNull(supportMessages.mediaUrl),
      ))

    // Delete R2 objects (fire-and-forget errors — don't block conversation delete)
    const r2Deletions = mediaMessages
      .map(m => m.mediaUrl!)
      .filter(url => url.includes('key='))
      .map(url => {
        try {
          const key = decodeURIComponent(url.split('key=')[1])
          return deleteFromR2(key).catch(() => {})
        } catch { return Promise.resolve() }
      })
    await Promise.allSettled(r2Deletions)

    // Messages cascade-delete via FK constraint
    await db.delete(supportConversations).where(eq(supportConversations.id, id))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
