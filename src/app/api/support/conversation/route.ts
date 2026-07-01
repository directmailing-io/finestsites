import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { supportConversations, supportMessages } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const convRows = await db
      .select()
      .from(supportConversations)
      .where(eq(supportConversations.userId, user.id))
      .orderBy(desc(supportConversations.lastMessageAt))

    // Fetch last message for each conversation
    const result = await Promise.all(
      convRows.map(async (conv) => {
        const [lastMsg] = await db
          .select({
            content: supportMessages.content,
            contentType: supportMessages.contentType,
            senderType: supportMessages.senderType,
            createdAt: supportMessages.createdAt,
          })
          .from(supportMessages)
          .where(eq(supportMessages.conversationId, conv.id))
          .orderBy(desc(supportMessages.createdAt))
          .limit(1)

        return { ...conv, lastMessage: lastMsg ?? null }
      })
    )

    return NextResponse.json({ conversations: result })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { content, contentType = 'text', mediaUrl } = body

  // For image/gif messages, mediaUrl is required; for text, content is required
  if (contentType === 'text' && !content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }
  if ((contentType === 'image' || contentType === 'gif') && !mediaUrl) {
    return NextResponse.json({ error: 'mediaUrl required for image/gif' }, { status: 400 })
  }

  try {
    const now = new Date()
    const [conv] = await db
      .insert(supportConversations)
      .values({ userId: user.id, status: 'open', lastMessageAt: now, unreadByAdmin: 1 })
      .returning()

    const messageContent = contentType === 'text' ? content.trim() : (content?.trim() ?? '')
    const [message] = await db
      .insert(supportMessages)
      .values({
        conversationId: conv.id,
        senderType: 'user',
        senderId: user.id,
        content: messageContent,
        contentType,
        ...(mediaUrl ? { mediaUrl } : {}),
      })
      .returning()

    return NextResponse.json({ conversation: conv, message }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
