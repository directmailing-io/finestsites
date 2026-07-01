import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, supportConversations, supportMessages } from '@/lib/db/schema'
import { eq, desc, inArray, and } from 'drizzle-orm'

async function checkAdmin(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isAdmin: true },
  })
  return profile?.isAdmin ? user : null
}

export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get('status')
  const q = searchParams.get('q')
  const userIdParam = searchParams.get('userId')

  try {
    // Get conversations with user info
    const convRows = await db
      .select({
        id: supportConversations.id,
        userId: supportConversations.userId,
        status: supportConversations.status,
        subject: supportConversations.subject,
        lastMessageAt: supportConversations.lastMessageAt,
        unreadByAdmin: supportConversations.unreadByAdmin,
        unreadByUser: supportConversations.unreadByUser,
        createdAt: supportConversations.createdAt,
        updatedAt: supportConversations.updatedAt,
        userEmail: users.email,
        userUsername: users.username,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userPlan: users.plan,
      })
      .from(supportConversations)
      .leftJoin(users, eq(supportConversations.userId, users.id))
      .where(
        (() => {
          const conditions = []
          if (statusParam && statusParam !== 'all') {
            conditions.push(inArray(supportConversations.status, statusParam.split(',') as string[]))
          }
          if (userIdParam) {
            conditions.push(eq(supportConversations.userId, userIdParam))
          }
          return conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions)
        })()
      )
      .orderBy(desc(supportConversations.lastMessageAt))
      .limit(100)

    // Filter by search if provided
    const filtered = q
      ? convRows.filter(c =>
          c.userEmail?.toLowerCase().includes(q.toLowerCase()) ||
          c.userUsername?.toLowerCase().includes(q.toLowerCase()) ||
          c.userFirstName?.toLowerCase().includes(q.toLowerCase()) ||
          c.userLastName?.toLowerCase().includes(q.toLowerCase())
        )
      : convRows

    // Get last message for each conversation
    const convIds = filtered.map(c => c.id)
    const lastMessages: Array<{ conversationId: string; content: string; senderType: string; createdAt: Date }> = []
    if (convIds.length > 0) {
      // Fetch last message per conversation
      const msgs = await db
        .select({ conversationId: supportMessages.conversationId, content: supportMessages.content, senderType: supportMessages.senderType, createdAt: supportMessages.createdAt })
        .from(supportMessages)
        .where(inArray(supportMessages.conversationId, convIds))
        .orderBy(desc(supportMessages.createdAt))
      // Keep only last message per conversation
      const seen = new Set<string>()
      for (const m of msgs) {
        if (!seen.has(m.conversationId)) {
          seen.add(m.conversationId)
          lastMessages.push(m)
        }
      }
    }
    const lastMsgMap = Object.fromEntries(lastMessages.map(m => [m.conversationId, m]))

    const result = filtered.map(c => ({
      id: c.id,
      userId: c.userId,
      status: c.status,
      subject: c.subject,
      lastMessageAt: c.lastMessageAt,
      unreadByAdmin: c.unreadByAdmin,
      createdAt: c.createdAt,
      user: {
        email: c.userEmail ?? '',
        username: c.userUsername ?? null,
        firstName: c.userFirstName ?? null,
        lastName: c.userLastName ?? null,
        plan: c.userPlan ?? 'starter',
      },
      lastMessage: lastMsgMap[c.id] ?? null,
    }))

    return NextResponse.json({ conversations: result })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
