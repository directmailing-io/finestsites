/**
 * GET/PUT /api/affiliate/payout-mode
 * Wie der Partner seine Provision bekommt: 'credit' (mit dem eigenen Abo verrechnen, Standard)
 * oder 'payout' (Überweisung aufs Bankkonto über Stripe Connect, ab 10 €).
 *
 * GET liefert zusätzlich das EIGENE Kundenguthaben des Partners bei Stripe (customer.balance,
 * negativ = Guthaben) – nie das Plattform-Guthaben. Fehler bei Stripe → customer_credit_cents: null.
 */

import { NextResponse } from 'next/server'
import { getUserFromRequest, getRealUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { rateLimit } from '@/lib/security/request'
import { getStripe } from '@/lib/stripe/client'
import { getCustomerCreditCents } from '@/lib/affiliate/customer-balance'
import { isCreditEligible, isPayoutMode, type PayoutMode } from '@/lib/affiliate/payout-mode'

async function loadState(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      affiliatePayoutMode: true, stripeConnectId: true, affiliateOnboarded: true,
      stripeCustomerId: true, subscriptionStatus: true, cancelAtPeriodEnd: true, deactivatedAt: true,
    },
  })
}

type State = NonNullable<Awaited<ReturnType<typeof loadState>>>

function toJson(s: State, creditCents: number | null, canChange: boolean) {
  const mode: PayoutMode = s.affiliatePayoutMode === 'payout' ? 'payout' : 'credit'
  return {
    mode,
    can_change: canChange,
    has_connect: !!s.stripeConnectId,
    connect_ready: !!s.stripeConnectId && !!s.affiliateOnboarded,
    subscription_active: isCreditEligible(s),
    customer_credit_cents: creditCents,
  }
}

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit('payout-mode-get', user.id, 60, 60_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte kurz.' }, { status: 429 })
  }
  const state = await loadState(user.id)
  if (!state) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const credit = state.stripeCustomerId
    ? await getCustomerCreditCents(getStripe(), state.stripeCustomerId).catch(() => null)
    : 0

  const real = await getRealUserFromRequest(req)
  const res = NextResponse.json(toJson(state, credit, !!real && real.id === user.id))
  // Stripe-Abfrage wird serverseitig 5 Min. gecacht; die Antwort selbst nicht (sonst zeigt die Seite nach dem Umstellen kurz die alte Wahl)
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}

export async function PUT(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Nur der Partner selbst – nicht ein Admin im „Anmelden als“-Modus.
  const real = await getRealUserFromRequest(req)
  if (!real || real.id !== user.id) {
    return NextResponse.json({ error: 'Das kann nur der Partner selbst umstellen.' }, { status: 403 })
  }
  if (!rateLimit('payout-mode-put', user.id, 10, 10 * 60_000)) {
    return NextResponse.json({ error: 'Zu viele Versuche. Bitte warte ein paar Minuten.' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }
  if (!isPayoutMode(body.mode)) {
    return NextResponse.json({ error: 'Bitte wähle eine der beiden Möglichkeiten.' }, { status: 400 })
  }

  await db.update(users).set({ affiliatePayoutMode: body.mode, updatedAt: new Date() }).where(eq(users.id, user.id))
  const state = await loadState(user.id)
  if (!state) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const credit = state.stripeCustomerId
    ? await getCustomerCreditCents(getStripe(), state.stripeCustomerId).catch(() => null)
    : 0
  const res = NextResponse.json(toJson(state, credit, true))
  res.headers.set('Cache-Control', 'no-store')
  return res
}
