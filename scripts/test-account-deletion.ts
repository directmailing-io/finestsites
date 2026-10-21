/**
 * Ende-zu-Ende-Test „Konto löschen“ gegen einen LOKALEN Dev-Server und eine LOKALE Test-Datenbank.
 *
 *   createdb -T finestsites_dev finestsites_deletion_test   (frische Kopie, Migrationen einspielen)
 *   # Dev-Server wie scripts/local-testenv/start.sh, aber Port 3111 + DB finestsites_deletion_test
 *   TEST_DATABASE_URL=postgresql://finestsites_dev:finestsites_dev_local@localhost:5432/finestsites_deletion_test \
 *   TEST_BASE_URL=http://localhost:3111 \
 *   node --import tsx scripts/test-account-deletion.ts
 *
 * Sicherheit: bricht ab, wenn DB oder Server nicht lokal sind, die DB `finestsites`/`finestsites_dev`
 * heißt oder der Stripe-Schlüssel kein sk_test_ ist. Es werden keine Mails verschickt (Server läuft mit
 * RESEND_API_KEY=re_invalid_local_only); geprüft wird nur, dass der Versand ausgelöst wurde (email_logs).
 * Cloudflare/R2 sind lokal abgeschaltet (FS_ENV=local → src/lib/account-deletion/effects.ts).
 * Stripe: nur Testmodus – legt ein Test-Abo an und prüft, dass es beendet wird.
 */
import postgres from 'postgres'
import Stripe from 'stripe'
import { readFileSync } from 'node:fs'
import http from 'node:http'

// ─── Sicherheitsnetz ─────────────────────────────────────────────────────────
const DB_URL = process.env.TEST_DATABASE_URL ?? ''
const BASE = (process.env.TEST_BASE_URL ?? 'http://localhost:3111').replace(/\/$/, '')
const CRON_SECRET = process.env.TEST_CRON_SECRET ?? 'local-cron-secret-dummy'
const dbName = DB_URL.split('/').pop() ?? ''
if (!/@localhost:\d+\//.test(DB_URL) || ['finestsites', 'finestsites_dev', ''].includes(dbName)) {
  console.error('Abbruch: TEST_DATABASE_URL muss auf eine lokale Wegwerf-DB zeigen (nicht finestsites/finestsites_dev).')
  process.exit(1)
}
if (!/^http:\/\/localhost:\d+$/.test(BASE)) {
  console.error('Abbruch: TEST_BASE_URL muss http://localhost:<port> sein.')
  process.exit(1)
}
function readTestStripeKey(): string | null {
  try {
    const line = readFileSync('/Users/kurzeja/new-finestsites/.env.local', 'utf8').split('\n').filter(l => l.startsWith('STRIPE_TEST_SECRET_KEY=')).pop()
    const v = line?.split('=').slice(1).join('=').replace(/^["']|["']$/g, '').trim() ?? ''
    return v || null
  } catch { return null }
}
const STRIPE_KEY = process.env.STRIPE_TEST_SECRET_KEY ?? readTestStripeKey()
if (STRIPE_KEY && !STRIPE_KEY.startsWith('sk_test_')) {
  console.error('Abbruch: Stripe-Schlüssel ist kein Test-Schlüssel.')
  process.exit(1)
}
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null

const sql = postgres(DB_URL, { max: 2, onnotice: () => {} })

// ─── Mini-Testrahmen ─────────────────────────────────────────────────────────
let passed = 0, failed = 0
const failures: string[] = []
function check(name: string, cond: unknown, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✔ ${name}`) }
  else { failed++; failures.push(name); console.log(`  ✘ ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`) }
}
function section(t: string) { console.log(`\n▶ ${t}`) }

// ─── Feste Testdaten ─────────────────────────────────────────────────────────
const PW_HASH = 'e65962ae22133751da2c79d146d66a14:a854f01ecd4f4c7af7c00fb5eead230a202162b90d5c47dcbbf6bf361e5c88943a71afea196d811a99cf38e4e935f180700065498b6292504ed1c9a0e091cbc4' // Test1234!
const PW = 'Test1234!'
const id = (n: number) => `00000000-0000-4000-d000-${String(n).padStart(12, '0')}`
const U = {
  A: { id: id(1), email: 'deltest-a@example.invalid', username: 'deltest-a' },        // Partner, Verzicht, Seiten, Abo
  B: { id: id(2), email: 'deltest-b@example.invalid', username: 'deltest-b' },        // von A geworben
  C: { id: id(3), email: 'deltest-c@example.invalid', username: 'deltest-c' },        // Partner, Auszahlung, Gutschrift (App)
  E: { id: id(5), email: 'deltest-admin@example.invalid', username: 'deltest-admin' }, // Admin
  F: { id: id(6), email: 'deltest-f@example.invalid', username: null as string | null }, // Neuer Nutzer ohne Namen
}
const SITE_A1 = id(101), SITE_A2 = id(102), SITE_B1 = id(103)
const PAYOUT_C = id(201)
const CN_NUMBER = 'GS-2026-99901'
const ALL_IDS = Object.values(U).map(u => u.id)

async function cleanup() {
  const ids = ALL_IDS
  const emails = Object.values(U).map(u => u.email)
  await sql`ALTER TABLE affiliate_payouts DISABLE TRIGGER trg_affiliate_payouts_protect_credit_note`
  await sql`DELETE FROM affiliate_payouts WHERE referrer_id = ANY(${ids}::uuid[]) OR id = ${PAYOUT_C}::uuid`
  await sql`ALTER TABLE affiliate_payouts ENABLE TRIGGER trg_affiliate_payouts_protect_credit_note`
  await sql`DELETE FROM affiliate_commissions WHERE referrer_id = ANY(${ids}::uuid[]) OR referee_id = ANY(${ids}::uuid[]) OR stripe_invoice_id LIKE 'in_deltest_%'`
  await sql`DELETE FROM account_deletion_requests WHERE user_id = ANY(${ids}::uuid[])`
  await sql`DELETE FROM affiliate_clicks WHERE referrer_username LIKE 'deltest-%' OR converted_user_id = ANY(${ids}::uuid[])`
  await sql`DELETE FROM site_events WHERE site_id = ANY(${[SITE_A1, SITE_A2, SITE_B1]}::uuid[])`
  await sql`DELETE FROM email_logs WHERE "to" = ANY(${emails}) OR "to" LIKE 'deleted-00000000-0000-4000-d000-%'`
  await sql`DELETE FROM verifications WHERE identifier = ANY(${emails})`
  await sql`DELETE FROM users WHERE id = ANY(${ids}::uuid[]) OR email = ANY(${emails}) OR username LIKE 'deltest-%'`
}

async function seed(templates: { a1: string; a2: string }) {
  const now = new Date()
  for (const [key, u] of Object.entries(U)) {
    if (key === 'F') continue // F legt der Test später selbst an
    await sql`
      INSERT INTO users (id, email, username, username_set_at, name, first_name, last_name, email_verified, plan, billing_interval,
                         team_partner_number, phone, company_name, content_consent_at, content_consent_ip, content_consent_ua, content_consent_version,
                         is_admin, referred_by_username, created_at, updated_at)
      VALUES (${u.id}::uuid, ${u.email}, ${u.username}, ${u.username ? now : null}, ${'Test ' + key}, ${'Vor' + key}, ${'Nach' + key}, true, 'pro', 'monthly',
              ${'9' + key.charCodeAt(0)}, '+49 170 0000000', ${'Firma ' + key}, ${now}, '127.0.0.1', 'test-ua', 'v1',
              ${key === 'E'}, ${key === 'B' ? U.A.username : null}, ${now}, ${now})`
    await sql`INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
              VALUES (${'deltest-acc-' + key}, ${u.id}, 'credential', ${u.id}::uuid, ${PW_HASH}, ${now}, ${now})`
  }
  // Seiten von A (eine veröffentlicht mit eigener Domain, eine Entwurf), eine von B
  await sql`INSERT INTO user_sites (id, user_id, template_id, status, published_at, custom_domain, custom_domain_status, cf_custom_hostname_id, r2_published_path)
            VALUES (${SITE_A1}::uuid, ${U.A.id}::uuid, ${templates.a1}::uuid, 'published', ${now}, 'www.deltest-a.example', 'active', 'cfh_deltest_a', 'published/deltest-a/index.html'),
                   (${SITE_A2}::uuid, ${U.A.id}::uuid, ${templates.a2}::uuid, 'draft', NULL, NULL, NULL, NULL, NULL),
                   (${SITE_B1}::uuid, ${U.B.id}::uuid, ${templates.a1}::uuid, 'published', ${now}, NULL, NULL, NULL, NULL)`
  await sql`INSERT INTO site_data (user_site_id, field_key, field_value) VALUES (${SITE_A1}::uuid, 'hero_name', 'Vor A Nach A'), (${SITE_B1}::uuid, 'hero_name', 'B')`
  await sql`INSERT INTO site_images (user_site_id, field_key, r2_path, public_url) VALUES (${SITE_A1}::uuid, 'hero_image', ${'user-images/' + U.A.id + '/x.jpg'}, 'https://example.invalid/x.jpg')`
  await sql`INSERT INTO form_submissions (user_site_id, form_name, data) VALUES (${SITE_A1}::uuid, 'kontakt', ${sql.json({ name: 'Interessent', email: 'lead@example.invalid' })})`
  await sql`INSERT INTO site_events (site_id, template_id, event_type, visitor_hash, host, path, referrer_host)
            VALUES (${SITE_A1}::uuid, ${templates.a1}::uuid, 'pageview', 'abc', 'deltest-a.dailyoptimal.de', '/', 'instagram.com')`
  // Support, Mitteilungen, Push, Tracking
  const [conv] = await sql`INSERT INTO support_conversations (user_id, subject) VALUES (${U.A.id}::uuid, 'Hilfe') RETURNING id`
  await sql`INSERT INTO support_messages (conversation_id, sender_type, sender_id, content) VALUES (${conv.id}, 'user', ${U.A.id}::uuid, 'Meine Telefonnummer ist 0170…')`
  await sql`INSERT INTO user_notifications (user_id, type, title, message) VALUES (${U.A.id}::uuid, 'info', 'Hallo', 'Test')`
  await sql`INSERT INTO push_devices (user_id, expo_token, platform) VALUES (${U.A.id}::uuid, 'ExponentPushToken[deltest-a]', 'ios')`
  await sql`INSERT INTO notification_preferences (user_id) VALUES (${U.A.id}::uuid)`
  await sql`INSERT INTO tracking_configs (user_id, meta_pixel_id) VALUES (${U.A.id}::uuid, '123456')`
  await sql`INSERT INTO email_logs (type, category, "to", subject, status) VALUES ('welcome', 'system', ${U.A.email}, 'Willkommen', 'sent')`
  await sql`INSERT INTO verifications (id, identifier, value, expires_at) VALUES ('deltest-ver-a', ${U.A.email}, 'tok', ${new Date(Date.now() + 864e5)})`
  // Empfehlungen: Klick auf A's Link, B ist darüber gekommen
  await sql`INSERT INTO affiliate_clicks (referrer_username, ip_hash, converted, converted_user_id) VALUES (${U.A.username}, 'iphash', true, ${U.B.id}::uuid)`
  await sql`INSERT INTO affiliate_clicks (referrer_username, ip_hash, converted, converted_user_id) VALUES (${U.B.username}, 'iphash2', true, ${U.A.id}::uuid)`
  // Provisionen: A ist Partner von B (5 € verfügbar, 3 € in der Haltefrist)
  const past = new Date(Date.now() - 20 * 864e5), future = new Date(Date.now() + 10 * 864e5)
  await sql`INSERT INTO affiliate_commissions (referrer_id, referee_id, stripe_invoice_id, gross_amount, net_amount, commission_amount, status, available_at, created_at)
            VALUES (${U.A.id}::uuid, ${U.B.id}::uuid, 'in_deltest_a1', 5000, 5000, 500, 'available', ${past}, ${past}),
                   (${U.A.id}::uuid, ${U.B.id}::uuid, 'in_deltest_a2', 3000, 3000, 300, 'pending', ${future}, ${now})`
  // C: Partner mit Steuerprofil, einer bezahlten Gutschrift und offenen Provisionen (ohne Auszahlungskonto)
  await sql`INSERT INTO affiliate_tax_profiles (user_id, tax_status, full_name, street, zip, city, tax_number, entrepreneur_confirmed, consent_at, consent_version, consent_text)
            VALUES (${U.C.id}::uuid, 'kleinunternehmer', 'Vor C Nach C', 'Weg 1', '12345', 'Stadt', '12/345/67890', true, ${past}, '2026-10-16', 'Zustimmung')`
  await sql`INSERT INTO affiliate_commissions (referrer_id, referee_id, stripe_invoice_id, gross_amount, net_amount, commission_amount, status, available_at, paid_at, payout_id, created_at)
            VALUES (${U.C.id}::uuid, ${U.A.id}::uuid, 'in_deltest_c0', 10000, 10000, 1000, 'paid', ${past}, ${past}, ${PAYOUT_C}::uuid, ${past})`
  await sql`INSERT INTO affiliate_commissions (referrer_id, referee_id, stripe_invoice_id, gross_amount, net_amount, commission_amount, status, available_at, created_at)
            VALUES (${U.C.id}::uuid, ${U.A.id}::uuid, 'in_deltest_c1', 4000, 4000, 400, 'available', ${past}, ${past}),
                   (${U.C.id}::uuid, ${U.A.id}::uuid, 'in_deltest_c2', 2000, 2000, 200, 'pending', ${future}, ${now})`
  await sql`INSERT INTO affiliate_payouts (id, referrer_id, commission_ids, total_amount, commission_count, period_start, period_end, status, payout_method,
                                           net_amount, vat_amount, gross_amount, vat_rate, tax_status, tax_profile_snapshot, line_items,
                                           credit_note_number, credit_note_date, credit_note_status, paid_at, created_at)
            VALUES (${PAYOUT_C}::uuid, ${U.C.id}::uuid, ARRAY[]::uuid[], 1000, 1, '2026-09-01', '2026-09-30', 'paid', 'stripe_connect',
                    1000, 0, 1000, 0, 'kleinunternehmer', ${sql.json({ fullName: 'Vor C Nach C', street: 'Weg 1', zip: '12345', city: 'Stadt' })},
                    ${sql.json([{ label: 'Kunde #0001', amount: 1000 }])}, ${CN_NUMBER}, '2026-10-01', 'created', ${past}, ${past})`
}

// ─── HTTP-Helfer ─────────────────────────────────────────────────────────────
type Session = { cookie?: string; bearer?: string }

/** App-Anmeldung wie die native App: node:http ohne Browser-Header (fetch/undici sendet sec-fetch-mode). */
function appSignIn(email: string): Promise<string | null> {
  const body = JSON.stringify({ email, password: PW, rememberMe: true })
  const url = new URL(`${BASE}/api/auth/sign-in/email`)
  return new Promise(resolve => {
    const r = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-FS-Client': 'ios', 'X-App-Version': '1.0.0 (1)', 'User-Agent': 'FinestSitesApp/1.0.0' },
    }, res => {
      res.resume()
      const t = res.headers['set-auth-token']
      resolve(res.statusCode === 200 && typeof t === 'string' ? t : null)
    })
    r.on('error', () => resolve(null))
    r.end(body)
  })
}

/** Mail-Logs werden nach dem Versand ohne await geschrieben → kurz nachfragen. */
async function eventually(fn: () => Promise<boolean>, ms = 3000): Promise<boolean> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await fn()) return true
    await new Promise(r => setTimeout(r, 150))
  }
  return fn()
}

async function login(email: string, opts: { app?: boolean } = {}): Promise<Session | null> {
  if (opts.app) {
    const token = await appSignIn(email)
    return token ? { bearer: token } : null
  }
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: opts.app
      ? { 'Content-Type': 'application/json', 'X-FS-Client': 'ios', 'X-App-Version': '1.0.0 (1)' }
      : { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email, password: PW, rememberMe: true }),
  })
  if (!res.ok) return null
  if (opts.app) {
    const token = res.headers.get('set-auth-token') ?? (await res.json().catch(() => ({})))?.token
    return token ? { bearer: token } : null
  }
  const cookies = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  return cookies ? { cookie: cookies } : null
}
async function call(s: Session | null, method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (s?.cookie) { headers.Cookie = s.cookie; headers.Origin = BASE }
  if (s?.bearer) { headers.Authorization = `Bearer ${s.bearer}`; headers['X-FS-Client'] = 'ios'; headers['X-App-Version'] = '1.0.0 (1)' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { json = text }
  return { status: res.status, json }
}
const cron = () => fetch(`${BASE}/api/cron/account-deletion`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } }).then(async r => ({ status: r.status, json: await r.json().catch(() => null) }))
const one = async <T = any>(q: Promise<T[]>) => (await q)[0]
const count = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0)

// ─── Ablauf ──────────────────────────────────────────────────────────────────
async function main() {
  const health = await fetch(`${BASE}/api/health`).catch(() => null)
  if (!health) { console.error(`Server ${BASE} nicht erreichbar.`); process.exit(1) }

  const tpls = await sql`SELECT id FROM templates WHERE r2_bundle_path IS NOT NULL ORDER BY created_at LIMIT 2`
  if (tpls.length < 2) throw new Error('Zu wenige Vorlagen in der Test-DB')
  await cleanup()
  // Selbst-Löschung ist standardmäßig aus; in dieser Wegwerf-DB einschalten
  await sql`INSERT INTO app_settings (key, value) VALUES ('account_deletion_enabled', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'`
  await seed({ a1: tpls[0].id, a2: tpls[1].id })

  // Stripe-Testabo für A
  let subId: string | null = null
  if (stripe) {
    const product = await stripe.products.create({ name: 'deltest product' })
    const price = await stripe.prices.create({ product: product.id, currency: 'eur', unit_amount: 1700, recurring: { interval: 'month' } })
    const customer = await stripe.customers.create({ email: U.A.email, name: 'deltest A', payment_method: 'pm_card_visa', invoice_settings: { default_payment_method: 'pm_card_visa' } })
    const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: price.id }] })
    // schon gutgeschriebenes, noch nicht verrechnetes Guthaben (Verrechnungsmodus) 2,50 €
    await stripe.customers.createBalanceTransaction(customer.id, { amount: -250, currency: 'eur', description: 'deltest Gutschrift' })
    subId = sub.id
    await sql`UPDATE users SET stripe_customer_id = ${customer.id}, stripe_subscription_id = ${sub.id}, subscription_status = ${sub.status} WHERE id = ${U.A.id}::uuid`
    console.log(`  (Stripe-Testabo ${sub.id}: ${sub.status})`)
  } else {
    console.log('  (kein Stripe-Testschlüssel – Abo-Teil wird übersprungen)')
  }

  section('Status und Pflichtangaben')
  const sA1 = await login(U.A.email)
  const sA2 = await login(U.A.email)
  check('A kann sich anmelden (2 Sitzungen)', sA1 && sA2)
  const st = await call(sA1, 'GET', '/api/account/deletion')
  check('GET Status 200', st.status === 200, st)
  const credit = stripe ? 250 : 0
  check('Guthaben A = 5 € verfügbar + 3 € Haltefrist + Kundenguthaben', st.json?.partnerBalance?.availableCents === 500 && st.json?.partnerBalance?.pendingCents === 300 && st.json?.partnerBalance?.customerCreditCents === credit && st.json?.partnerBalance?.totalCents === 800 + credit, st.json?.partnerBalance)
  check('Verzichtstext nennt den Betrag', String(st.json?.partnerBalance?.waiverText ?? '').includes(stripe ? '10,50' : '8,00'), st.json?.partnerBalance?.waiverText)

  const wrong = await call(sA1, 'POST', '/api/account/deletion', { password: 'falsch', balanceChoice: 'waive', waiverConfirmed: true })
  check('Falsches Passwort → 400 INVALID_PASSWORD', wrong.status === 400 && wrong.json?.code === 'INVALID_PASSWORD', wrong)
  check('… nichts vorgemerkt', (await one(sql`SELECT deletion_requested_at FROM users WHERE id = ${U.A.id}::uuid`))?.deletion_requested_at === null)
  const noChoice = await call(sA1, 'POST', '/api/account/deletion', { password: PW })
  check('Guthaben ohne Wahl → 400 BALANCE_CHOICE_REQUIRED', noChoice.status === 400 && noChoice.json?.code === 'BALANCE_CHOICE_REQUIRED', noChoice)
  const noWaiver = await call(sA1, 'POST', '/api/account/deletion', { password: PW, balanceChoice: 'waive' })
  check('Verzicht ohne Bestätigung → 400', noWaiver.status === 400 && noWaiver.json?.code === 'BALANCE_CHOICE_REQUIRED', noWaiver)

  section('Admin-Konto kann nicht gelöscht werden')
  const sE = await login(U.E.email)
  const stE = await call(sE, 'GET', '/api/account/deletion')
  check('Admin: canDelete=false', stE.json?.canDelete === false && stE.json?.blockedReason === 'admin', stE.json)
  const delE = await call(sE, 'POST', '/api/account/deletion', { password: PW })
  check('Admin: POST → 403 DELETION_NOT_ALLOWED', delE.status === 403 && delE.json?.code === 'DELETION_NOT_ALLOWED', delE)

  section('Anfrage: Seiten offline, Sitzungen weg, Abo beendet')
  const req1 = await call(sA1, 'POST', '/api/account/deletion', { password: PW, balanceChoice: 'waive', waiverConfirmed: true })
  check('POST → 200 scheduled', req1.status === 200 && req1.json?.status === 'scheduled' && req1.json?.signedOut === true, req1)
  const ua = await one(sql`SELECT * FROM users WHERE id = ${U.A.id}::uuid`)
  const days = (new Date(ua.deletion_scheduled_for).getTime() - new Date(ua.deletion_requested_at).getTime()) / 864e5
  check('deletion_scheduled_for = +14 Tage', Math.abs(days - 14) < 0.01, days)
  check('Veröffentlichte Seite → deactivated', (await one(sql`SELECT status FROM user_sites WHERE id = ${SITE_A1}::uuid`))?.status === 'deactivated')
  check('Entwurf bleibt Entwurf', (await one(sql`SELECT status FROM user_sites WHERE id = ${SITE_A2}::uuid`))?.status === 'draft')
  check('Seite von B unberührt (published)', (await one(sql`SELECT status FROM user_sites WHERE id = ${SITE_B1}::uuid`))?.status === 'published')
  check('Alle Sitzungen von A beendet', await count(sql`SELECT count(*)::int n FROM sessions WHERE user_id = ${U.A.id}::uuid`) === 0)
  check('Push-Geräte entfernt', await count(sql`SELECT count(*)::int n FROM push_devices WHERE user_id = ${U.A.id}::uuid`) === 0)
  const rq = await one(sql`SELECT * FROM account_deletion_requests WHERE user_id = ${U.A.id}::uuid AND status = 'scheduled'`)
  check('Protokoll: Wahl waive + Wortlaut gespeichert', rq?.balance_choice === 'waive' && String(rq?.waiver_text).includes('verzichte') && rq?.waiver_accepted_at, rq)
  check('Bestätigungsmail ausgelöst (email_logs, Kategorie system)', await eventually(async () => await count(sql`SELECT count(*)::int n FROM email_logs WHERE "to" = ${U.A.email} AND type = 'account_deletion_requested' AND category = 'system'`) === 1))
  const oldGet = await call(sA2, 'GET', '/api/account/deletion')
  check('Alte Sitzung gilt nicht mehr (401)', oldGet.status === 401, oldGet.status)
  if (stripe && subId) {
    const sub = await stripe.subscriptions.retrieve(subId)
    check('Stripe-Testabo sofort beendet', sub.status === 'canceled', sub.status)
    check('DB: Abo-Status canceled, keine Abo-ID', ua.subscription_status === 'canceled' && ua.stripe_subscription_id === null, { s: ua.subscription_status, id: ua.stripe_subscription_id })
  }
  const again = await call(await login(U.A.email), 'POST', '/api/account/deletion', { password: PW, balanceChoice: 'waive', waiverConfirmed: true })
  check('Zweite Anfrage → 409 DELETION_ALREADY_REQUESTED', again.status === 409 && again.json?.code === 'DELETION_ALREADY_REQUESTED', again)

  section('Bedenkzeit: gesperrte Aktionen, keine Rundmails')
  const sA3 = await login(U.A.email)
  check('Anmelden während der Bedenkzeit möglich', !!sA3)
  const st3 = await call(sA3, 'GET', '/api/account/deletion')
  check('Status scheduled mit Datum', st3.json?.status === 'scheduled' && !!st3.json?.scheduledFor, st3.json)
  const pub = await call(sA3, 'POST', `/api/sites/${SITE_A1}/publish`)
  check('Veröffentlichen gesperrt (423 ACCOUNT_DELETION_PENDING)', pub.status === 423 && pub.json?.code === 'ACCOUNT_DELETION_PENDING', pub)
  const newSite = await call(sA3, 'POST', '/api/sites', { template_id: tpls[0].id })
  check('Neue Seite gesperrt (423)', newSite.status === 423, newSite.status)
  const dash = await fetch(`${BASE}/sites`, { headers: { Cookie: sA3!.cookie! }, redirect: 'manual' })
  const dashHtml = await dash.text()
  check('Dashboard zeigt „Konto wird gelöscht am …“ + „Löschung abbrechen“', dashHtml.includes('Konto wird gelöscht am') && dashHtml.includes('Löschung abbrechen'), dash.status)
  {
    process.env.DATABASE_URL = DB_URL
    const bulk = await import('../src/lib/email/bulk')
    const all = await bulk.loadAllRecipients()
    check('Rundmail-Empfänger ohne A (Löschung angefragt)', !all.some(r => r.id === U.A.id) && all.some(r => r.id === U.B.id))
    const split = await bulk.splitByOptOut([{ id: U.A.id, email: U.A.email }, { id: U.B.id, email: U.B.email }], 'system')
    check('Auch Kategorie system: A übersprungen, B erlaubt', split.skipped.some(r => r.id === U.A.id) && split.allowed.some(r => r.id === U.B.id))
  }

  section('Löschung abbrechen')
  const cancel = await call(sA3, 'DELETE', '/api/account/deletion')
  check('DELETE → 200 status none, Seiten offline', cancel.status === 200 && cancel.json?.status === 'none' && cancel.json?.sitesOffline === true, cancel)
  const uc = await one(sql`SELECT deletion_requested_at, deletion_scheduled_for, deleted_at FROM users WHERE id = ${U.A.id}::uuid`)
  check('Vormerkung entfernt', uc.deletion_requested_at === null && uc.deletion_scheduled_for === null && uc.deleted_at === null)
  check('Seite bleibt offline (Entwurf zum Neu-Veröffentlichen)', (await one(sql`SELECT status FROM user_sites WHERE id = ${SITE_A1}::uuid`))?.status === 'draft')
  check('Protokoll: cancelled', (await one(sql`SELECT status FROM account_deletion_requests WHERE user_id = ${U.A.id}::uuid ORDER BY requested_at DESC LIMIT 1`))?.status === 'cancelled')
  check('Abbruch-Mail ausgelöst', await eventually(async () => await count(sql`SELECT count(*)::int n FROM email_logs WHERE "to" = ${U.A.email} AND type = 'account_deletion_cancelled'`) === 1))
  const cancel2 = await call(sA3, 'DELETE', '/api/account/deletion')
  check('Erneut abbrechen → 409 NO_DELETION_PENDING', cancel2.status === 409 && cancel2.json?.code === 'NO_DELETION_PENDING', cancel2)

  section('Cron vor Ablauf der 14 Tage tut nichts')
  await sql`UPDATE user_sites SET status = 'published' WHERE id = ${SITE_A1}::uuid`
  const req2 = await call(sA3, 'POST', '/api/account/deletion', { password: PW, balanceChoice: 'waive', waiverConfirmed: true })
  check('Neue Anfrage → 200', req2.status === 200, req2)
  const c1 = await cron()
  check('Cron 200', c1.status === 200, c1)
  check('A nicht gelöscht', !c1.json?.deleted?.includes(U.A.id) && (await one(sql`SELECT deleted_at FROM users WHERE id = ${U.A.id}::uuid`))?.deleted_at === null)
  const cronNoAuth = await fetch(`${BASE}/api/cron/account-deletion`)
  check('Cron ohne Secret → 401', cronNoAuth.status === 401)

  section('Stripe-Webhook „Abo beendet“ während der Bedenkzeit: keine Kündigungsmail, kein 90-Tage-Timer')
  {
    const cust = (await one(sql`SELECT stripe_customer_id FROM users WHERE id = ${U.A.id}::uuid`))?.stripe_customer_id ?? 'cus_deltest_a'
    await sql`UPDATE users SET stripe_customer_id = ${cust} WHERE id = ${U.A.id}::uuid`
    const payload = JSON.stringify({
      id: `evt_deltest_${Date.now()}`, object: 'event', type: 'customer.subscription.deleted', api_version: '2025-01-27.acacia',
      created: Math.floor(Date.now() / 1000), livemode: false, pending_webhooks: 0, request: { id: null, idempotency_key: null },
      data: { object: { id: subId ?? 'sub_deltest_a', object: 'subscription', customer: cust, status: 'canceled', cancel_at_period_end: false, items: { object: 'list', data: [] } } },
    })
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.TEST_STRIPE_WEBHOOK_SECRET ?? 'whsec_local_dummy' } as Parameters<typeof Stripe.webhooks.generateTestHeaderString>[0])
    const wh = await fetch(`${BASE}/api/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': header }, body: payload })
    check('Webhook angenommen (200)', wh.status === 200, wh.status)
    const uw = await one(sql`SELECT deactivated_at, subscription_status FROM users WHERE id = ${U.A.id}::uuid`)
    check('Kein deactivated_at (kein 90-Tage-Ablauf)', uw.deactivated_at === null, uw)
    check('Keine Seite mit Lösch-Timer', await count(sql`SELECT count(*)::int n FROM user_sites WHERE user_id = ${U.A.id}::uuid AND scheduled_deletion_at IS NOT NULL`) === 0)
    await new Promise(r => setTimeout(r, 500))
    check('Keine „Abo ausgelaufen/pausiert“-Mail', await count(sql`SELECT count(*)::int n FROM email_logs WHERE "to" = ${U.A.email} AND type IN ('account_expired','account_deactivated','account_canceled')`) === 0)
  }

  section('C fragt über die App an (Bearer), Wahl Auszahlung')
  const sC = await login(U.C.email, { app: true })
  check('C App-Anmeldung (Bearer)', !!sC?.bearer)
  const stC = await call(sC, 'GET', '/api/app/v1/account/deletion')
  check('App GET: Guthaben C = 6 €, kein Auszahlungskonto', stC.json?.partnerBalance?.totalCents === 600 && stC.json?.partnerBalance?.hasPayoutAccount === false, stC.json)
  const reqC = await call(sC, 'POST', '/api/app/v1/account/deletion', { password: PW, balanceChoice: 'payout' })
  check('App POST → 200 scheduled', reqC.status === 200 && reqC.json?.status === 'scheduled', reqC)
  const afterC = await call(sC, 'GET', '/api/app/v1/account/deletion')
  check('App-Token danach ungültig (401)', afterC.status === 401, afterC.status)

  section('Cron nach Ablauf: Löschung ausführen')
  await sql`UPDATE users SET deletion_scheduled_for = now() - interval '1 minute' WHERE id = ANY(${[U.A.id, U.C.id]}::uuid[])`
  const c2 = await cron()
  check('Cron löscht A und C', c2.json?.deleted?.includes(U.A.id) && c2.json?.deleted?.includes(U.C.id), c2.json)
  const ta = await one(sql`SELECT * FROM users WHERE id = ${U.A.id}::uuid`)
  check('Grabstein: E-Mail ersetzt', ta.email === `deleted-${U.A.id}@deleted.invalid`, ta.email)
  check('Grabstein: Benutzername bleibt reserviert', ta.username === U.A.username)
  check('Grabstein: persönliche Felder leer', ta.first_name === null && ta.last_name === null && ta.name === '' && ta.phone === null && ta.company_name === null && ta.team_partner_number === null && ta.content_consent_ip === null, ta)
  check('Grabstein: deleted_at gesetzt, kein Admin', !!ta.deleted_at && ta.is_admin === false)
  const tables: [string, number][] = [
    ['user_sites', await count(sql`SELECT count(*)::int n FROM user_sites WHERE user_id = ${U.A.id}::uuid`)],
    ['site_data', await count(sql`SELECT count(*)::int n FROM site_data WHERE user_site_id = ANY(${[SITE_A1, SITE_A2]}::uuid[])`)],
    ['site_images', await count(sql`SELECT count(*)::int n FROM site_images WHERE user_site_id = ANY(${[SITE_A1, SITE_A2]}::uuid[])`)],
    ['form_submissions', await count(sql`SELECT count(*)::int n FROM form_submissions WHERE user_site_id = ANY(${[SITE_A1, SITE_A2]}::uuid[])`)],
    ['support_conversations', await count(sql`SELECT count(*)::int n FROM support_conversations WHERE user_id = ${U.A.id}::uuid`)],
    ['support_messages', await count(sql`SELECT count(*)::int n FROM support_messages WHERE sender_id = ${U.A.id}::uuid`)],
    ['user_notifications', await count(sql`SELECT count(*)::int n FROM user_notifications WHERE user_id = ${U.A.id}::uuid`)],
    ['push_devices', await count(sql`SELECT count(*)::int n FROM push_devices WHERE user_id = ${U.A.id}::uuid`)],
    ['notification_preferences', await count(sql`SELECT count(*)::int n FROM notification_preferences WHERE user_id = ${U.A.id}::uuid`)],
    ['tracking_configs', await count(sql`SELECT count(*)::int n FROM tracking_configs WHERE user_id = ${U.A.id}::uuid`)],
    ['sessions', await count(sql`SELECT count(*)::int n FROM sessions WHERE user_id = ${U.A.id}::uuid`)],
    ['accounts', await count(sql`SELECT count(*)::int n FROM accounts WHERE user_id = ${U.A.id}::uuid`)],
    ['verifications', await count(sql`SELECT count(*)::int n FROM verifications WHERE identifier = ${U.A.email}`)],
    ['email_logs (alte Adresse)', await count(sql`SELECT count(*)::int n FROM email_logs WHERE "to" = ${U.A.email}`)],
    ['affiliate_clicks (A als Partner)', await count(sql`SELECT count(*)::int n FROM affiliate_clicks WHERE referrer_username = ${U.A.username}`)],
    ['affiliate_tax_profiles A', await count(sql`SELECT count(*)::int n FROM affiliate_tax_profiles WHERE user_id = ${U.A.id}::uuid`)],
  ]
  for (const [t, n] of tables) check(`gelöscht: ${t}`, n === 0, n)
  const ev = await one(sql`SELECT host, visitor_hash, referrer_host FROM site_events WHERE site_id = ${SITE_A1}::uuid`)
  check('site_events anonymisiert (Statistik bleibt)', ev && ev.host === 'deleted.invalid' && ev.visitor_hash === null && ev.referrer_host === null, ev)
  const clickB = await one(sql`SELECT converted, converted_user_id FROM affiliate_clicks WHERE referrer_username = ${U.B.username}`)
  check('Klick bei B: Zählung bleibt, Verweis auf A entfernt', clickB?.converted === true && clickB?.converted_user_id === null, clickB)
  check('Abschlussmail ausgelöst (Log nur mit Grabstein-Adresse)', await eventually(async () => await count(sql`SELECT count(*)::int n FROM email_logs WHERE "to" = ${ta.email} AND type = 'account_deletion_completed'`) === 1))
  check('… und kein Log mit der alten Adresse', await count(sql`SELECT count(*)::int n FROM email_logs WHERE "to" = ${U.A.email}`) === 0)
  const comA = await sql`SELECT status, retention_until FROM affiliate_commissions WHERE referrer_id = ${U.A.id}::uuid ORDER BY stripe_invoice_id`
  check('A: Provisionen bleiben, Verzicht wirksam (waived)', comA.length === 2 && comA.every(c => c.status === 'waived'), comA)
  check('A: retention_until = 31.12.2036 (10 J. ab Jahresende)', comA.every(c => String(c.retention_until?.toISOString?.() ?? c.retention_until).startsWith('2036-12-31')), comA.map(c => c.retention_until))
  const rqA = await one(sql`SELECT status, settlement_status FROM account_deletion_requests WHERE user_id = ${U.A.id}::uuid ORDER BY requested_at DESC LIMIT 1`)
  check('A: Protokoll completed / waived', rqA?.status === 'completed' && rqA?.settlement_status === 'waived', rqA)
  check('Anmelden mit alter Adresse unmöglich', (await login(U.A.email)) === null)

  section('Gutschriften und Auszahlungen bleiben (C)')
  const pc = await one(sql`SELECT * FROM affiliate_payouts WHERE id = ${PAYOUT_C}::uuid`)
  check('Gutschrift-Zeile unverändert vorhanden', pc && pc.credit_note_number === CN_NUMBER && pc.referrer_id === U.C.id && pc.gross_amount === 1000 && pc.tax_profile_snapshot?.fullName === 'Vor C Nach C', pc)
  check('Gutschrift: retention_until 31.12.2036', String(pc.retention_until?.toISOString?.() ?? pc.retention_until).startsWith('2036-12-31'), pc.retention_until)
  check('Bezahlte Provision von C bleibt', (await one(sql`SELECT status FROM affiliate_commissions WHERE stripe_invoice_id = 'in_deltest_c0'`))?.status === 'paid')
  const rqC = await one(sql`SELECT * FROM account_deletion_requests WHERE user_id = ${U.C.id}::uuid AND status = 'completed'`)
  check('C: Schlussabrechnung läuft (Haltefrist offen)', rqC?.settlement_status === 'pending' && rqC?.contact_email === U.C.email, rqC)
  check('C: Steuerprofil bleibt bis zur Abrechnung', await count(sql`SELECT count(*)::int n FROM affiliate_tax_profiles WHERE user_id = ${U.C.id}::uuid`) === 1)
  // Haltefrist vorbei → kein Auszahlungskonto → auf Anfrage auszahlbar bis Verjährung
  await sql`UPDATE affiliate_commissions SET available_at = now() - interval '1 minute' WHERE stripe_invoice_id = 'in_deltest_c2'`
  const c3 = await cron()
  const rqC2 = await one(sql`SELECT * FROM account_deletion_requests WHERE user_id = ${U.C.id}::uuid AND status = 'completed'`)
  const limitYear = new Date().getFullYear() + 3
  check('C: Guthaben auf Anfrage auszahlbar, Verjährung 31.12.+3 J.', rqC2?.settlement_status === 'payable_on_request' && String(rqC2?.limitation_until?.toISOString?.() ?? rqC2?.limitation_until).startsWith(`${limitYear}-12-31`), { s: rqC2?.settlement_status, l: rqC2?.limitation_until, cron: c3.json?.settlements })
  check('C: Provisionen NICHT verfallen (available)', (await sql`SELECT status FROM affiliate_commissions WHERE stripe_invoice_id IN ('in_deltest_c1','in_deltest_c2')`).every(r => r.status === 'available'))
  // Verjährt → Kontaktadresse + Steuerprofil weg
  await sql`UPDATE account_deletion_requests SET limitation_until = current_date - 1 WHERE user_id = ${U.C.id}::uuid`
  await cron()
  const rqC3 = await one(sql`SELECT * FROM account_deletion_requests WHERE user_id = ${U.C.id}::uuid AND status = 'completed'`)
  check('C: nach Verjährung time_barred, Kontakt + Steuerprofil entfernt', rqC3?.settlement_status === 'time_barred' && rqC3?.contact_email === null && await count(sql`SELECT count(*)::int n FROM affiliate_tax_profiles WHERE user_id = ${U.C.id}::uuid`) === 0, rqC3)

  section('Benutzername bleibt reserviert, Empfehlungen anderer intakt')
  const now = new Date()
  await sql`INSERT INTO users (id, email, name, email_verified, created_at, updated_at) VALUES (${U.F.id}::uuid, ${U.F.email}, 'F', true, ${now}, ${now})`
  await sql`INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES ('deltest-acc-F', ${U.F.id}, 'credential', ${U.F.id}::uuid, ${PW_HASH}, ${now}, ${now})`
  const sF = await login(U.F.email)
  const taken = await call(sF, 'POST', '/api/onboarding/set-username', { username: U.A.username, first_name: 'F', last_name: 'F' })
  check('Neuer Nutzer kann „deltest-a“ nicht registrieren (409)', taken.status === 409, taken)
  const reReg = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email: U.A.email, password: 'Neu12345!', name: 'A neu' }),
  })
  check('Alte E-Mail ist wieder frei (Neuanmeldung möglich, eigenes neues Konto)', reReg.ok, reReg.status)
  await sql`DELETE FROM users WHERE email = ${U.A.email}` // Aufräumen der Neuanmeldung
  const ub = await one(sql`SELECT referred_by_username FROM users WHERE id = ${U.B.id}::uuid`)
  check('B bleibt „geworben von deltest-a“ (Name zeigt nie auf jemand anderen)', ub.referred_by_username === U.A.username)
  check('B: eigene Seite + Daten unberührt', await count(sql`SELECT count(*)::int n FROM site_data WHERE user_site_id = ${SITE_B1}::uuid`) === 1)
  check('Provisionen mit B als Geworbenem bleiben (referee_id)', await count(sql`SELECT count(*)::int n FROM affiliate_commissions WHERE referee_id = ${U.B.id}::uuid`) === 2)

  section('Ergebnis')
  console.log(`  ${passed} bestanden, ${failed} fehlgeschlagen`)
  if (failed) console.log('  Fehlgeschlagen:\n   - ' + failures.join('\n   - '))
  if (stripe && subId) {
    // Testmodus-Aufräumen (nur Test-Objekte dieses Laufs)
    const s = await stripe.subscriptions.retrieve(subId).catch(() => null)
    if (s && typeof s.customer === 'string') await stripe.customers.del(s.customer).catch(() => {})
  }
  if (process.env.KEEP_TEST_DATA !== '1') await cleanup()
  await sql.end()
  process.exit(failed ? 1 : 0)
}

main().catch(async err => {
  console.error('Testlauf abgebrochen:', err)
  await sql.end().catch(() => {})
  process.exit(1)
})
