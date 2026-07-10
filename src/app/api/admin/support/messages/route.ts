import { NextRequest, NextResponse } from 'next/server'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, supportConversations, supportMessages } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

async function checkAdmin(req: Request) {
  const user = await getRealUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  return profile?.isAdmin ? user : null
}

export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conversationId = new URL(req.url).searchParams.get('conversationId')
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  try {
    const messages = await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.conversationId, conversationId))
      .orderBy(supportMessages.createdAt)

    // Also reset unreadByAdmin
    await db
      .update(supportConversations)
      .set({ unreadByAdmin: 0, updatedAt: new Date() })
      .where(eq(supportConversations.id, conversationId))

    return NextResponse.json({ messages })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { conversationId, content } = await req.json()
  if (!conversationId || !content?.trim()) return NextResponse.json({ error: 'conversationId and content required' }, { status: 400 })

  try {
    const now = new Date()
    const [message] = await db
      .insert(supportMessages)
      .values({ conversationId, senderType: 'admin', senderId: admin.id, content: content.trim() })
      .returning()

    // Update conv: lastMessageAt, increment unreadByUser, re-open if closed
    const conv = await db.query.supportConversations.findFirst({ where: eq(supportConversations.id, conversationId) })
    await db
      .update(supportConversations)
      .set({
        lastMessageAt: now,
        updatedAt: now,
        unreadByUser: (conv?.unreadByUser ?? 0) + 1,
        status: conv?.status === 'closed' ? 'open' : conv?.status ?? 'open',
      })
      .where(eq(supportConversations.id, conversationId))

    return NextResponse.json({ message })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
