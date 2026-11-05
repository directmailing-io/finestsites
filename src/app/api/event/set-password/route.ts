import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { getClientIp, rateLimit } from '@/lib/security/request'
import { ensureEventSignupUser, isEventSignupSession, setEventPassword } from '@/lib/event/signup'
import type Stripe from 'stripe'

/**
 * Danke-Seite nach dem Event-Kauf: Passwort festlegen. Schlüssel ist die Stripe-Session-ID
 * (nur die Person, die von Stripe zurückkam, kennt sie), 7 Tage gültig, einmal einlösbar.
 * Danach meldet sich der Browser mit E-Mail + Passwort ganz normal an (/api/auth/sign-in/email).
 */
export async function POST(req: NextRequest) {
  if (!rateLimit('event-set-password', getClientIp(req), 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Versuche. Bitte warte ein paar Minuten.' }, { status: 429 })
  }
  let body: { session_id?: string; password?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 }) }
  const sessionId = String(body.session_id ?? '')
  const password = String(body.password ?? '')
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) return NextResponse.json({ error: 'Ungültiger Link.' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Das Passwort braucht mindestens 8 Zeichen.' }, { status: 400 })
  if (password.length > 128) return NextResponse.json({ error: 'Das Passwort ist zu lang.' }, { status: 400 })

  let session: Stripe.Checkout.Session
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })
  } catch {
    return NextResponse.json({ error: 'Ungültiger Link.' }, { status: 404 })
  }
  if (!isEventSignupSession(session) || session.status !== 'complete' || !session.subscription || typeof session.subscription === 'string') {
    return NextResponse.json({ error: 'Diese Bestellung ist nicht abgeschlossen.' }, { status: 409 })
  }
  const result = await ensureEventSignupUser(session, session.subscription)
  if (!result) return NextResponse.json({ error: 'Konto nicht gefunden.' }, { status: 404 })

  const ok = await setEventPassword(result.userId, sessionId, password)
  if (!ok) {
    return NextResponse.json({ error: 'Das Passwort wurde für dieses Konto schon festgelegt. Bitte melde dich an oder nutze „Passwort vergessen“.', already: true }, { status: 409 })
  }
  const email = session.customer_details?.email ?? session.customer_email ?? session.metadata?.email ?? ''
  return NextResponse.json({ ok: true, email: email.toLowerCase().trim() })
}
