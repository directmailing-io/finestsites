import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { getStripe } from '@/lib/stripe/client'

async function createPortalSession(userId: string): Promise<string | null> {
  const profile = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { stripeCustomerId: true },
  })
  if (!profile?.stripeCustomerId) return null

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')
  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: `${appUrl}/settings`,
  })
  return session.url
}

// POST — used by the settings page button (returns JSON { url })
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = await createPortalSession(user.id)
    if (!url) return NextResponse.json({ error: 'Kein aktives Abonnement gefunden.' }, { status: 400 })
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[billing/portal] error:', message)
    return NextResponse.json({ error: 'Fehler beim Öffnen des Kundenportals.' }, { status: 500 })
  }
}

// GET — used by email links. Redirects directly to Stripe portal (302).
// If not logged in, redirects to /login with a returnUrl so the user lands
// in the portal after signing in.
export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')
  const user = await getUserFromRequest(req)

  if (!user) {
    const returnUrl = encodeURIComponent(`${appUrl}/api/billing/portal`)
    return NextResponse.redirect(`${appUrl}/login?callbackUrl=${returnUrl}`)
  }

  try {
    const url = await createPortalSession(user.id)
    if (!url) return NextResponse.redirect(`${appUrl}/settings`)
    return NextResponse.redirect(url)
  } catch (err) {
    console.error('[billing/portal GET] error:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(`${appUrl}/settings`)
  }
}
