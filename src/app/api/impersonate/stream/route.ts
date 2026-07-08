import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { impersonationRequests, users } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

async function getState(userId: string) {
  const record = await db.query.impersonationRequests.findFirst({
    where: eq(impersonationRequests.userId, userId),
    orderBy: [desc(impersonationRequests.createdAt)],
  })

  if (!record) return { state: null, request: null }

  const expired = record.expiresAt < new Date()

  // Ended / rejected / expired → return null state so banner hides
  if (record.status === 'ended' || record.status === 'rejected' || expired) {
    return { state: null, request: null }
  }

  // pending or active/approved still in-flight
  if (record.status !== 'pending' && record.status !== 'active' && record.status !== 'approved') {
    return { state: null, request: null }
  }

  const admin = await db.query.users.findFirst({
    where: eq(users.id, record.adminId),
    columns: { username: true, firstName: true, lastName: true },
  })
  const adminName = admin?.username
    ? `@${admin.username}`
    : [admin?.firstName, admin?.lastName].filter(Boolean).join(' ') || 'Admin'

  return {
    state: record.status,
    request: {
      id: record.id,
      token: record.token,
      adminName,
      expiresAt: record.expiresAt.toISOString(),
    },
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let prev = '__init__'

      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* stream closed */ }
      }

      // Send initial state immediately
      try {
        const initial = await getState(user.id)
        prev = JSON.stringify(initial)
        send(initial)
      } catch { /* ignore */ }

      const interval = setInterval(async () => {
        if (req.signal.aborted) {
          clearInterval(interval)
          try { controller.close() } catch { /* already closed */ }
          return
        }
        try {
          const data = await getState(user.id)
          const key = JSON.stringify(data)
          if (key !== prev) {
            prev = key
            send(data)
          }
        } catch { /* db error — ignore */ }
      }, 2000)

      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
