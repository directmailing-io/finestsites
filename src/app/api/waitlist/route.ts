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
      return NextResponse.json({ error: 'Ungültige E-Mail-Adresse.' }, { status: 400 })
    }

    const trimmedEmail = email.trim().toLowerCase()
    const trimmedName = name?.trim() || null

    // Check for existing entry
    const existing = await db.query.waitlist.findFirst({
      where: eq(waitlist.email, trimmedEmail),
    })

    if (existing) {
      if (existing.unsubscribedAt) {
        // Re-subscribe: reset unsubscribed, issue new token, send confirmation
        const [updated] = await db
          .update(waitlist)
          .set({ unsubscribedAt: null, confirmed: false, confirmedAt: null, name: trimmedName ?? existing.name })
          .where(eq(waitlist.email, trimmedEmail))
          .returning()
        await sendConfirmEmail(updated.confirmToken!, trimmedName, trimmedEmail)
        return NextResponse.json({ ok: true })
      }
      if (existing.confirmed) {
        // Already confirmed — silently succeed (don't leak info)
        return NextResponse.json({ ok: true })
      }
      // Pending — resend confirmation
      await sendConfirmEmail(existing.confirmToken!, trimmedName, trimmedEmail)
      return NextResponse.json({ ok: true })
    }

    // New entry
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
  const { subject, html } = waitlistConfirmEmail({ name, confirmUrl, unsubscribeUrl })
  await getResend().emails.send({ from: FROM_EMAIL, to: email, subject, html })
}
