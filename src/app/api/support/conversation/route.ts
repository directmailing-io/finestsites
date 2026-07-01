import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { supportConversations, supportMessages } from '@/lib/db/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conv = await db.query.supportConversations.findFirst({
      where: and(
        eq(supportConversations.userId, user.id),
        inArray(supportConversations.status, ['open', 'waiting'])
      ),
      orderBy: [desc(supportConversations.createdAt)],
    })

    if (!conv) return NextResponse.json({ conversation: null, messages: [] })

    const messages = await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.conversationId, conv.id))
      .orderBy(supportMessages.createdAt)

    return NextResponse.json({ conversation: conv, messages })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  try {
    const now = new Date()
    const [conv] = await db
      .insert(supportConversations)
      .values({ userId: user.id, status: 'open', lastMessageAt: now, unreadByAdmin: 1 })
      .returning()

    const [message] = await db
      .insert(supportMessages)
      .values({ conversationId: conv.id, senderType: 'user', senderId: user.id, content: content.trim() })
      .returning()

    return NextResponse.json({ conversation: conv, message }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
