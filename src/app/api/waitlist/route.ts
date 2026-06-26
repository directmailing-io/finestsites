import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { waitlist } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { waitlistConfirmEmail } from '@/lib/email/waitlist-templates'

const MARKETING_URL = (process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://finestsites.io').replace(/\/$/, '')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': MARKETING_URL,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    const { email, name, source } = await req.json() as {
      email?: string; name?: string; source?: string
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Ungueltige E-Mail-Adresse.' }, { status: 400, headers: CORS_HEADERS })
    }

    const trimmedEmail = email.trim().toLowerCase()
    const trimmedName = name?.trim() || null

    const existing = await db.query.waitlist.findFirst({
      where: eq(waitlist.email, trimmedEmail),
    })

    if (existing) {
      if (existing.unsubscribedAt) {
        const [updated] = await db
          .update(waitlist)
          .set({ unsubscribedAt: null, confirmed: false, confirmedAt: null, name: trimmedName ?? existing.name })
          .where(eq(waitlist.email, trimmedEmail))
          .returning()
        await sendConfirmEmail(updated.confirmToken!, trimmedName ?? updated.name, trimmedEmail)
        return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
      }
      if (existing.confirmed) {
        return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
      }
      // Ausstehend — erneut senden
      await sendConfirmEmail(existing.confirmToken!, trimmedName ?? existing.name, trimmedEmail)
      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
    }

    const [entry] = await db
      .insert(waitlist)
      .values({ email: trimmedEmail, name: trimmedName, source: source ?? 'homepage' })
      .returning()

    await sendConfirmEmail(entry.confirmToken!, trimmedName, trimmedEmail)

    return NextResponse.json({ ok: true }, { status: 201, headers: CORS_HEADERS })
  } catch (err) {
    console.error('[waitlist POST]', err)
    return NextResponse.json({ error: 'Interner Fehler.' }, { status: 500, headers: CORS_HEADERS })
  }
}

async function sendConfirmEmail(token: string, name: string | null, email: string) {
  const confirmUrl = `${MARKETING_URL}/api/waitlist/confirm?token=${token}`
  const unsubscribeUrl = `${MARKETING_URL}/api/waitlist/unsubscribe?token=${token}`
  const { subject, html, text } = waitlistConfirmEmail({ name, confirmUrl, unsubscribeUrl })
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
}
