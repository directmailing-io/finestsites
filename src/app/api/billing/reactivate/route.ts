import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

export const runtime = 'nodejs'

export async function POST() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { stripeSubscriptionId: true, cancelAtPeriodEnd: true },
  })

  if (!profile?.stripeSubscriptionId) {
    return NextResponse.json({ error: 'Kein Abo gefunden.' }, { status: 400 })
  }

  if (!profile.cancelAtPeriodEnd) {
    return NextResponse.json({ error: 'Kein Kündigungstermin gesetzt.' }, { status: 400 })
  }

  try {
    await getStripe().subscriptions.update(profile.stripeSubscriptionId, {
      cancel_at_period_end: false,
    })
    // Update DB immediately — Stripe webhook will confirm shortly after
    await db.update(users).set({ cancelAtPeriodEnd: false }).where(eq(users.id, user.id))
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[billing/reactivate] Stripe error:', err)
    return NextResponse.json({ error: 'Fehler beim Reaktivieren.' }, { status: 500 })
  }
}
