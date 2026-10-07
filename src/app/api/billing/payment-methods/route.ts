import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import { listPaymentMethods, setDefaultPaymentMethod } from '@/lib/billing/payment-recovery'

/**
 * The customer's stored payment methods and the fallback rule.
 *
 *  GET   → { methods: PaymentMethodSummary[], fallback_sepa: boolean }
 *  PATCH → { default_payment_method?: string, fallback_sepa?: boolean }
 *
 * Adding a method still happens in the Stripe portal (SetupIntent + mandate);
 * which one is charged, and what happens when it fails, is decided here.
 */
async function loadProfile(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { stripeCustomerId: true, stripeSubscriptionId: true, paymentFallbackSepa: true },
  })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await loadProfile(user.id)
  if (!profile?.stripeCustomerId) return NextResponse.json({ methods: [], fallback_sepa: false })

  try {
    const methods = await listPaymentMethods(profile.stripeCustomerId, profile.stripeSubscriptionId)
    return NextResponse.json({ methods, fallback_sepa: profile.paymentFallbackSepa })
  } catch (err) {
    console.error('[billing/payment-methods] list error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ methods: [], fallback_sepa: profile.paymentFallbackSepa, error: 'Zahlungsmethoden konnten nicht geladen werden.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await loadProfile(user.id)
  if (!profile?.stripeCustomerId) return NextResponse.json({ error: 'Kein Abonnement gefunden.' }, { status: 400 })

  let body: { default_payment_method?: unknown; fallback_sepa?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 }) }

  try {
    if (typeof body.default_payment_method === 'string' && /^pm_[A-Za-z0-9]+$/.test(body.default_payment_method)) {
      await setDefaultPaymentMethod(profile.stripeCustomerId, profile.stripeSubscriptionId, body.default_payment_method)
    }
    if (typeof body.fallback_sepa === 'boolean') {
      await db.update(users).set({ paymentFallbackSepa: body.fallback_sepa }).where(eq(users.id, user.id))
    }
    const [methods, fresh] = await Promise.all([
      listPaymentMethods(profile.stripeCustomerId, profile.stripeSubscriptionId),
      loadProfile(user.id),
    ])
    return NextResponse.json({ methods, fallback_sepa: fresh?.paymentFallbackSepa ?? false })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('[billing/payment-methods] patch error:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
