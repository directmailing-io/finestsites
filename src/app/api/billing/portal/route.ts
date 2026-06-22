import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { getStripe } from '@/lib/stripe/client'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeCustomerId: true },
  })
  if (!profile?.stripeCustomerId) {
    return NextResponse.json({ error: 'Kein aktives Abonnement gefunden.' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${appUrl}/billing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[billing/portal] error:', message)
    return NextResponse.json({ error: 'Fehler beim Öffnen des Kundenportals.' }, { status: 500 })
  }
}
