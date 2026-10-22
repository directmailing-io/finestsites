/**
 * Admin: gemeldete Besucher-Gespräche (Konto, Seite, Grund, letzte 20 Nachrichten), neueste Meldung zuerst.
 *   GET ?limit=100 → { reports: [...] }
 * Nur Admin (echte Sitzung).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { listReportedConversations, siteHostOf, toContractConversation, toContractMessage } from '@/lib/chat/service'

export const dynamic = 'force-dynamic'

async function checkAdmin(req: Request) {
  const user = await getRealUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  return profile?.isAdmin ? user : null
}

export async function GET(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? '100')
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 100
  try {
    const rows = await listReportedConversations(limit)
    return NextResponse.json({
      reports: rows.map(r => ({
        conversation: toContractConversation(r),
        reportReason: r.conv.reportReason,
        account: { userId: r.conv.userId, email: r.ownerEmail, username: r.username },
        site: { id: r.conv.siteId, title: r.siteTitle, host: siteHostOf(r) },
        messages: r.messages.map(m => toContractMessage(m, 'owner')),
      })),
    })
  } catch (err) {
    console.error('[admin/chat/reports] failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
