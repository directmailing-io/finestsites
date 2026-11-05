/**
 * Admin: gemeldetes Besucher-Gespräch bearbeiten.
 *   POST { action: 'unblock' | 'block' | 'dismiss' } → { ok: true, status }
 *   unblock – Sperre des Besuchers (Konto-weit, wie „Entsperren“ beim Betreiber) aufheben, Gespräch wieder offen
 *   block   – Besucher sperren wie „Besucher sperren“ beim Betreiber
 *   dismiss – Meldung erledigt: Meldung entfernen (Gespräch selbst bleibt beim Betreiber unverändert)
 * Nur Admin (echte Sitzung).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { chatConversations, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { blockConversation, unblockConversation } from '@/lib/chat/service'

export const dynamic = 'force-dynamic'

async function checkAdmin(req: Request) {
  const user = await getRealUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  return profile?.isAdmin ? user : null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => null) as { action?: unknown } | null
  const action = body?.action
  if (action !== 'unblock' && action !== 'block' && action !== 'dismiss') {
    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
  }
  try {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const conv = await db.query.chatConversations.findFirst({ where: eq(chatConversations.id, id) })
    if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (action === 'unblock' && conv.status === 'blocked') await unblockConversation(conv)
    if (action === 'block' && conv.status !== 'blocked') await blockConversation(conv, 'Admin nach Meldung')
    if (action === 'dismiss') {
      await db.update(chatConversations).set({ reportedAt: null, reportReason: null, updatedAt: new Date() })
        .where(eq(chatConversations.id, id))
    }
    const fresh = await db.query.chatConversations.findFirst({ where: eq(chatConversations.id, id), columns: { status: true } })
    console.log(`[admin/chat/reports] ${admin.id} ${action} ${id}`)
    return NextResponse.json({ ok: true, status: fresh?.status ?? conv.status })
  } catch (err) {
    console.error('[admin/chat/reports/action] failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
