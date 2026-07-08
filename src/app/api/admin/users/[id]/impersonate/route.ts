import { NextRequest, NextResponse } from 'next/server'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, supportConversations, supportMessages, impersonationRequests } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

async function checkAdmin(req: Request) {
  const user = await getRealUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  return profile?.isAdmin ? user : null
}

/** POST /api/admin/users/[id]/impersonate — create an impersonation request and notify user in support chat */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: userId } = await params

  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, username: true },
  })
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Find the most recent open support conversation, or create one
  let [conv] = await db
    .select()
    .from(supportConversations)
    .where(and(eq(supportConversations.userId, userId), eq(supportConversations.deletedByUser, false)))
    .orderBy(desc(supportConversations.lastMessageAt))
    .limit(1)

  const now = new Date()
  if (!conv) {
    const [newConv] = await db
      .insert(supportConversations)
      .values({ userId, status: 'open', lastMessageAt: now, unreadByAdmin: 0 })
      .returning()
    conv = newConv
  }

  // Generate a secure token
  const token = crypto.randomUUID()

  // Expiry: 30 minutes to approve; extended to 2h when admin enters
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  const [request] = await db
    .insert(impersonationRequests)
    .values({
      adminId: admin.id,
      userId,
      token,
      conversationId: conv.id,
      expiresAt,
    })
    .returning()

  // Send system message in the user's support chat
  const systemContent = JSON.stringify({
    type: 'impersonation_request',
    requestId: request.id,
    token,
  })

  await db.insert(supportMessages).values({
    conversationId: conv.id,
    senderType: 'admin',
    senderId: admin.id,
    content: systemContent,
    contentType: 'system',
  })

  await db.update(supportConversations)
    .set({ lastMessageAt: now, unreadByUser: 1, updatedAt: now })
    .where(eq(supportConversations.id, conv.id))

  return NextResponse.json({ requestId: request.id, token, conversationId: conv.id })
}

/** GET /api/admin/users/[id]/impersonate?requestId=xxx — poll for approval status */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: userId } = await params
  const requestId = new URL(req.url).searchParams.get('requestId')
  if (!requestId) return NextResponse.json({ error: 'requestId required' }, { status: 400 })

  const record = await db.query.impersonationRequests.findFirst({
    where: and(
      eq(impersonationRequests.id, requestId),
      eq(impersonationRequests.adminId, admin.id),
      eq(impersonationRequests.userId, userId),
    ),
  })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ status: record.status, token: record.token, expiresAt: record.expiresAt })
}
