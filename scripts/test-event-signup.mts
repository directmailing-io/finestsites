/**
 * Test der Event-Kontoanlage (src/lib/event/signup.ts) gegen eine WEGWERF-Datenbank – nie gegen
 * die Live-DB. Es wird nichts an Stripe geschickt und keine Mail verschickt: Checkout-Session und
 * Abo sind hier nachgebaute Objekte, wie Stripe sie liefert.
 *
 * Aufruf (Dev-Server auf $BASE mit derselben DB, damit die Anmeldung geprüft werden kann):
 *   DATABASE_URL=postgres://localhost/finestsites_cg BASE=http://localhost:3111 npx tsx scripts/test-event-signup.mts
 */
import type Stripe from 'stripe'
import { db } from '@/lib/db'
import { accounts, subscriptionEvents, users, verifications } from '@/lib/db/schema'
import { eq, like } from 'drizzle-orm'
import { ensureEventSignupUser, eventPasswordPending, setEventPassword, isEventSignupSession } from '@/lib/event/signup'

if (!/finestsites_(cg|.*test)/.test(process.env.DATABASE_URL ?? '')) {
  console.error('Abbruch: DATABASE_URL zeigt nicht auf eine Wegwerf-DB:', process.env.DATABASE_URL)
  process.exit(2)
}
const BASE = process.env.BASE ?? 'http://localhost:3111'
let fail = 0
const ok = (name: string, cond: unknown, info?: unknown) => { if (!cond) fail++; console.log(cond ? 'OK  ' : 'FAIL', name, cond ? '' : JSON.stringify(info ?? '').slice(0, 300)) }

const stamp = Date.now()
const email = `event-${stamp}@example.com`
const sessionId = `cs_test_${'a'.repeat(20)}${stamp}`
const priceId = process.env.STRIPE_PRICE_PRO_YEARLY ?? 'price_pro_yearly'
const sub = {
  id: `sub_test_${stamp}`,
  status: 'active',
  items: { data: [{ price: { id: priceId, recurring: { interval: 'year' } }, current_period_end: Math.floor(Date.now() / 1000) + 365 * 86400 }] },
} as unknown as Stripe.Subscription
const session = {
  id: sessionId,
  status: 'complete',
  mode: 'subscription',
  customer: `cus_test_${stamp}`,
  customer_details: { email: email.toUpperCase() },
  subscription: sub,
  metadata: { event_signup: '1', event_slug: 'powerday', first_name: 'Sabine', email, plan: 'pro', interval: 'yearly', promo_code: 'POWERDAY20' },
} as unknown as Stripe.Checkout.Session

ok('Session erkannt', isEventSignupSession(session))
ok('Fremde Session nicht erkannt', !isEventSignupSession({ ...session, metadata: {} } as Stripe.Checkout.Session))

// 1) Konto anlegen (Webhook-Pfad)
const first = await ensureEventSignupUser(session, sub)
ok('Konto angelegt', first?.created === true, first)
const row = await db.query.users.findFirst({ where: eq(users.email, email) })
ok('E-Mail klein geschrieben + bestätigt', row?.email === email && row?.emailVerified === true, row)
ok('Abo-Daten gesetzt', row?.plan === 'pro' && row?.billingInterval === 'yearly' && row?.subscriptionStatus === 'active' && row?.stripeSubscriptionId === sub.id && row?.stripeCustomerId === `cus_test_${stamp}` && !!row?.currentPeriodEnd, row)
ok('Vorname gesetzt', row?.firstName === 'Sabine' && row?.name === 'Sabine')
const acc = await db.query.accounts.findFirst({ where: eq(accounts.userId, row!.id) })
ok('Zugangsdaten mit Zufallspasswort', acc?.providerId === 'credential' && !!acc?.password)
const ev = await db.query.subscriptionEvents.findFirst({ where: eq(subscriptionEvents.stripeEventId, `event-signup:${sessionId}`) })
ok('event_signup geloggt', ev?.eventType === 'event_signup' && ev?.plan === 'pro')

// 2) Zweiter Aufruf (Danke-Seite) → gleiches Konto, nichts doppelt
const second = await ensureEventSignupUser(session, sub)
ok('Idempotent', second?.userId === first?.userId && second?.created === false, second)
const accCount = await db.query.accounts.findMany({ where: eq(accounts.userId, row!.id) })
ok('Nur ein Zugangsdatensatz', accCount.length === 1)

// 3) Passwort setzen
ok('Passwort offen', await eventPasswordPending(row!.id, sessionId))
ok('Falsche Session → kein Passwort', (await setEventPassword(row!.id, 'cs_test_wrong', 'Powerday-2026!')) === 'invalid')
ok('Passwort + Benutzername gesetzt', (await setEventPassword(row!.id, sessionId, 'Powerday-2026!', { username: 'sabine-test', firstName: 'Sabine', lastName: 'Test' })) === 'ok')
ok('Schlüssel verbraucht', !(await eventPasswordPending(row!.id, sessionId)))
{
  const u = await db.query.users.findFirst({ where: eq(users.id, row!.id), columns: { username: true, firstName: true, lastName: true, name: true } })
  ok('Benutzername + Name gespeichert', u?.username === 'sabine-test' && u.firstName === 'Sabine' && u.lastName === 'Test' && u.name === 'Sabine Test', JSON.stringify(u))
}
ok('Zweites Setzen abgelehnt', (await setEventPassword(row!.id, sessionId, 'Anderes-Passwort1')) === 'invalid')
const vrows = await db.query.verifications.findMany({ where: like(verifications.identifier, `event-password:${row!.id}`) })
ok('Schlüsselzeile gelöscht', vrows.length === 0)

// 4) Anmeldung über BetterAuth (Dev-Server mit derselben DB)
try {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email, password: 'Powerday-2026!', rememberMe: true }),
  })
  const setCookie = res.headers.getSetCookie?.() ?? []
  ok('Anmeldung 200 + Cookie', res.status === 200 && setCookie.some(c => /better-auth/.test(c)), { status: res.status, body: (await res.text()).slice(0, 200) })
  const wrong = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email, password: 'falsch-falsch', rememberMe: true }),
  })
  ok('Falsches Passwort 401', wrong.status === 401, wrong.status)
  // API-Routen gegen den Dev-Server: Danke-Seite mit kaputter Session, Passwort-Route mit kaputter Session
  const danke = await fetch(`${BASE}/powerday/danke?session_id=cs_test_unbekannt123`)
  ok('Danke-Seite unbekannte Session → Hinweis', danke.status === 200 && /nicht zuordnen/.test(await danke.text()))
  const sp = await fetch(`${BASE}/api/event/set-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: 'cs_test_unbekannt123', password: 'Powerday-2026!', username: 'sabine', first_name: 'Sabine' }) })
  ok('Passwort-Route unbekannte Session → 404', sp.status === 404, sp.status)
  const chk = async (u: string) => (await (await fetch(`${BASE}/api/event/username-check?u=${encodeURIComponent(u)}`)).json()) as { available?: boolean; error?: string }
  ok('Benutzername-Prüfung frei', (await chk('sabine-neu-xyz')).available === true)
  ok('Benutzername-Prüfung vergeben', (await chk('sabine-test')).available === false)
  ok('Benutzername-Prüfung reserviert', (await chk('admin')).available === false)
  ok('Benutzername-Prüfung ungültig', (await chk('ab')).available === false)
  const bad = await fetch(`${BASE}/api/event/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: 'powerday', first_name: '', email: 'x', plan: 'pro', interval: 'yearly' }) })
  ok('Checkout ohne Vorname → 400', bad.status === 400, bad.status)
  const dup = await fetch(`${BASE}/api/event/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: 'powerday', first_name: 'Sabine', email, plan: 'pro', interval: 'yearly' }) })
  const dupJ = await dup.json()
  ok('Checkout mit bekannter E-Mail → 409 existing', dup.status === 409 && dupJ.existing === true, dupJ)
  const page = await fetch(`${BASE}/powerday?vorschau=1`)
  const html = await page.text()
  ok('Event-Seite rendert (Vorschau)', page.status === 200 && /Angebot jetzt sichern/.test(html) && /216(<!-- -->)? €/.test(html) && /spart/.test(html) && /91,80/.test(html))
  const ended = await fetch(`${BASE}/powerday`)
  const endedHtml = await ended.text()
  ok('Event-Seite ohne Code → beendet-Hinweis + normaler Preis', ended.status === 200 && /beendet/.test(endedHtml) && /270(<!-- -->)? €/.test(endedHtml))
} catch (e) {
  ok('Dev-Server erreichbar', false, e instanceof Error ? e.message : e)
}

// Aufräumen
await db.delete(users).where(eq(users.email, email))
console.log(fail ? `${fail} FEHLER` : 'ALLE OK')
process.exit(fail ? 1 : 0)
