import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { supportConversations, supportMessages } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get('conversationId')
  const since = searchParams.get('since')

  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  try {
    // Verify ownership
    const conv = await db.query.supportConversations.findFirst({
      where: and(eq(supportConversations.id, conversationId), eq(supportConversations.userId, user.id)),
    })
    if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const conditions = [eq(supportMessages.conversationId, conversationId)]
    if (since) conditions.push(gt(supportMessages.createdAt, new Date(since)))

    const messages = await db
      .select()
      .from(supportMessages)
      .where(and(...conditions))
      .orderBy(supportMessages.createdAt)

    return NextResponse.json({ messages, conversationStatus: conv.status, unreadByUser: conv.unreadByUser })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversationId, content } = await req.json()
  if (!conversationId || !content?.trim()) return NextResponse.json({ error: 'conversationId and content required' }, { status: 400 })

  try {
    const conv = await db.query.supportConversations.findFirst({
      where: and(eq(supportConversations.id, conversationId), eq(supportConversations.userId, user.id)),
    })
    if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const now = new Date()
    const [message] = await db
      .insert(supportMessages)
      .values({ conversationId, senderType: 'user', senderId: user.id, content: content.trim() })
      .returning()

    await db
      .update(supportConversations)
      .set({ lastMessageAt: now, unreadByAdmin: conv.unreadByAdmin + 1, updatedAt: now })
      .where(eq(supportConversations.id, conversationId))

    return NextResponse.json({ message })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
