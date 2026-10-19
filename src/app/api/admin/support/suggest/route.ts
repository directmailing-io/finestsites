import { NextRequest, NextResponse } from 'next/server'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, supportConversations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateSuggestion, SuggestError } from '@/lib/support/ai-suggest'

export const maxDuration = 90

async function checkAdmin(req: Request) {
  const user = await getRealUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  return profile?.isAdmin ? user : null
}

/** POST { conversationId, hint? } → { id, text, usage } – KI-Antwortvorschlag, wird nie automatisch gesendet. */
export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { conversationId?: string; hint?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId : ''
  if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 })

  const conv = await db.query.supportConversations.findFirst({
    where: eq(supportConversations.id, conversationId),
    columns: { id: true, userId: true },
  })
  if (!conv) return NextResponse.json({ error: 'Gespräch nicht gefunden' }, { status: 404 })

  try {
    const result = await generateSuggestion({
      conversationId,
      userId: conv.userId,
      adminId: admin.id,
      hint: typeof body.hint === 'string' ? body.hint : '',
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof SuggestError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[support-ai] suggest failed', err)
    return NextResponse.json({ error: 'Vorschlag konnte nicht erstellt werden' }, { status: 500 })
  }
}
