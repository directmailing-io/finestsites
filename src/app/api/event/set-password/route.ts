import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { getClientIp, rateLimit } from '@/lib/security/request'
import { ensureEventSignupUser, isEventSignupSession, setEventPassword } from '@/lib/event/signup'
import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { RESERVED_USERNAMES, sanitizeUsername, isValidUsername, USERNAME_RULE_TEXT } from '@/lib/username'

/**
 * Danke-Seite nach dem Event-Kauf: Zugangsdaten festlegen (Vorname, Nachname, Benutzername, Passwort).
 * Schlüssel ist die Stripe-Session-ID (nur die Person, die von Stripe zurückkam, kennt sie), 7 Tage
 * gültig, einmal einlösbar. Danach meldet sich der Browser mit E-Mail + Passwort an
 * (/api/auth/sign-in/email). Der Benutzername wird hier gesetzt wie im Onboarding (gleiche Regeln,
 * src/lib/username.ts), aber ohne Willkommensmail.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit('event-set-password', getClientIp(req), 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Versuche. Bitte warte ein paar Minuten.' }, { status: 429 })
  }
  let body: { session_id?: string; password?: string; username?: string; first_name?: string; last_name?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 }) }
  const sessionId = String(body.session_id ?? '')
  const password = String(body.password ?? '')
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) return NextResponse.json({ error: 'Ungültiger Link.' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Das Passwort braucht mindestens 8 Zeichen.' }, { status: 400 })
  if (password.length > 128) return NextResponse.json({ error: 'Das Passwort ist zu lang.' }, { status: 400 })

  const firstName = String(body.first_name ?? '').trim().slice(0, 60)
  const lastName = String(body.last_name ?? '').trim().slice(0, 60)
  const username = sanitizeUsername(String(body.username ?? ''))
  if (!firstName) return NextResponse.json({ error: 'Bitte gib deinen Vornamen ein.' }, { status: 400 })
  if (!isValidUsername(username)) return NextResponse.json({ error: `Bitte prüfe den Benutzernamen. ${USERNAME_RULE_TEXT}` }, { status: 400 })
  if (RESERVED_USERNAMES.has(username)) return NextResponse.json({ error: 'Dieser Benutzername ist reserviert. Bitte wähle einen anderen.' }, { status: 409 })

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

  // Vorab prüfen, damit ein vergebener Name den einmaligen Schlüssel nicht verbraucht
  const taken = await db.query.users.findFirst({ where: eq(users.username, username), columns: { id: true } })
  if (taken && taken.id !== result.userId) {
    return NextResponse.json({ error: 'Dieser Benutzername ist schon vergeben. Bitte wähle einen anderen, zum Beispiel mit Nachnamen.' }, { status: 409 })
  }

  const outcome = await setEventPassword(result.userId, sessionId, password, { username, firstName, lastName })
  if (outcome === 'username_taken') {
    return NextResponse.json({ error: 'Dieser Benutzername ist schon vergeben. Bitte wähle einen anderen, zum Beispiel mit Nachnamen.' }, { status: 409 })
  }
  if (outcome === 'invalid') {
    return NextResponse.json({ error: 'Die Zugangsdaten wurden für dieses Konto schon festgelegt. Bitte melde dich an oder nutze „Passwort vergessen“.', already: true }, { status: 409 })
  }
  const email = session.customer_details?.email ?? session.customer_email ?? session.metadata?.email ?? ''
  return NextResponse.json({ ok: true, email: email.toLowerCase().trim() })
}
