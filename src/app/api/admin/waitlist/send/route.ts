import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { waitlist, users } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { sendEmail, FROM_EMAIL } from '@/lib/resend'
import { waitlistBroadcastEmail } from '@/lib/email/waitlist-templates'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { markupToHtml } from '@/lib/email/markup'

const MARKETING_URL = (process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://finestsites.io').replace(/\/$/, '')

async function assertAdmin(req: NextRequest) {
  const user = await getRealUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  if (!profile?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

function personalize(text: string, name: string | null): string {
  const first = name ? name.trim().split(/\s+/)[0] : null
  return text.replace(/\{\{vorname\}\}/gi, first ?? 'du')
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

  let sent = 0
  let failed = 0
  const recipientLog: { email: string; name: string | null }[] = []

  const CHUNK = 50
  for (let i = 0; i < recipients.length; i += CHUNK) {
    await Promise.allSettled(
      recipients.slice(i, i + CHUNK).map(async (r) => {
        const personalSubject = personalize(subject, r.name)
        const personalBody = personalize(body, r.name)
        const bodyHtml = markupToHtml(personalBody)
        const unsubscribeUrl = `${MARKETING_URL}/api/waitlist/unsubscribe?token=${r.confirmToken}`
        const { subject: s, html } = waitlistBroadcastEmail({
          subject: personalSubject,
          bodyHtml,
          bodyText: personalBody,
          unsubscribeUrl,
        })
        try {
          await sendEmail({
            to: r.email,
            subject: s,
            html,
            type: 'waitlist_broadcast',
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          })
          sent++
          recipientLog.push({ email: r.email, name: r.name })
        } catch {
          failed++
        }
      })
    )
  }

  // Save broadcast to history
  try {
    await db.execute(sql`
      INSERT INTO waitlist_broadcasts (subject, body, sent_count, failed_count, recipients)
      VALUES (${subject.trim()}, ${body.trim()}, ${sent}, ${failed}, ${JSON.stringify(recipientLog)}::jsonb)
    `)
  } catch (e) {
    console.error('[waitlist/send] failed to save broadcast:', e)
  }

  return NextResponse.json({ ok: true, sent, failed })
}
