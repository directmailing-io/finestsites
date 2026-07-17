import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { waitlist } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { sendEmail } from '@/lib/resend'
import { waitlistWelcomeEmail } from '@/lib/email/waitlist-templates'

const MARKETING_URL = (process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://finestsites.io').replace(/\/$/, '')

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) return redirect('error')

  const entry = await db.query.waitlist.findFirst({
    where: and(eq(waitlist.confirmToken, token), isNull(waitlist.unsubscribedAt)),
  })

  if (!entry) return redirect('error')

  if (!entry.confirmed) {
    await db
      .update(waitlist)
      .set({ confirmed: true, confirmedAt: new Date() })
      .where(eq(waitlist.id, entry.id))

    const unsubscribeUrl = `${MARKETING_URL}/api/waitlist/unsubscribe?token=${token}`
    const { subject, html, text } = waitlistWelcomeEmail({ name: entry.name, unsubscribeUrl })
    await sendEmail({ to: entry.email, subject, html, type: 'waitlist_welcome' }).catch(console.error)
  }

  return redirect('confirmed')
}

function redirect(status: 'confirmed' | 'error') {
  return NextResponse.redirect(`${MARKETING_URL}/?waitlist=${status}`, { status: 302 })
}
