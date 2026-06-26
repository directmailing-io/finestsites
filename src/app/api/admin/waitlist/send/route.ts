import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { waitlist, users } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { waitlistBroadcastEmail } from '@/lib/email/waitlist-templates'
import { getUserFromRequest } from '@/lib/auth/server'

const MARKETING_URL = (process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://finestsites.io').replace(/\/$/, '')

async function assertAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  if (!profile?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function POST(req: NextRequest) {
  const err = await assertAdmin(req)
  if (err) return err

  const { subject, body } = await req.json() as { subject?: string; body?: string }
  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'Betreff und Inhalt sind erforderlich.' }, { status: 400 })
  }

  const recipients = await db
    .select()
    .from(waitlist)
    .where(and(eq(waitlist.confirmed, true), isNull(waitlist.unsubscribedAt)))

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Keine bestätigten Empfänger vorhanden.' }, { status: 400 })
  }

  // Convert plain-text body → simple HTML paragraphs
  const bodyHtml = body
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 16px;">${p.replace(/\n/g, '<br />')}</p>`)
    .join('')

  const resend = getResend()
  let sent = 0
  let failed = 0

  // Resend limit: 50 requests/s — chunk to stay within rate limits
  const CHUNK = 50
  for (let i = 0; i < recipients.length; i += CHUNK) {
    await Promise.allSettled(
      recipients.slice(i, i + CHUNK).map(async (r) => {
        const unsubscribeUrl = `${MARKETING_URL}/api/waitlist/unsubscribe?token=${r.confirmToken}`
        const { subject: s, html } = waitlistBroadcastEmail({ subject, bodyHtml, unsubscribeUrl })
        try {
          await resend.emails.send({ from: FROM_EMAIL, to: r.email, subject: s, html })
          sent++
        } catch {
          failed++
        }
      })
    )
  }

  return NextResponse.json({ ok: true, sent, failed })
}
