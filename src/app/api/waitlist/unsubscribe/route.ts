import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { waitlist } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const MARKETING_URL = (process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://finestsites.io').replace(/\/$/, '')

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) return redirect('error')

  const entry = await db.query.waitlist.findFirst({
    where: eq(waitlist.confirmToken, token),
  })

  if (!entry) return redirect('error')

  if (!entry.unsubscribedAt) {
    await db
      .update(waitlist)
      .set({ unsubscribedAt: new Date() })
      .where(eq(waitlist.id, entry.id))
  }

  return redirect('unsubscribed')
}

function redirect(status: 'unsubscribed' | 'error') {
  return NextResponse.redirect(`${MARKETING_URL}/?waitlist=${status}`, { status: 302 })
}
