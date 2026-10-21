/**
 * Vertrags- und Ende-zu-Ende-Tests der App-Schnittstellen (native App, /api/app/v1/*).
 *
 * NUR LOKAL bzw. gegen eine Test-/Staging-Umgebung – nie gegen Produktion (der Test meldet sich an,
 * ändert Passwörter hin und zurück, schreibt Push-Geräte und ruft Kauf-Routen im Web-Modus auf).
 *
 *   npx tsx scripts/app-api-contract-test.ts --unit
 *       nur reine Logik (keine Server-Verbindung)
 *   APP_API_BASE=http://localhost:3088 DATABASE_URL=postgres://…/finestsites_backend_test \
 *   TEST_PASSWORD='…' npx tsx scripts/app-api-contract-test.ts
 *       + Live-Tests gegen den laufenden Dev-Server (Konten app-pro|app-nosub|app-starter|app-partner@example.invalid)
 *   … --push=enabled   zusätzlich Push-Ende-zu-Ende (Server mit PUSH_ENABLED=true und
 *                      PUSH_EXPO_URL=http://127.0.0.1:3099/send gestartet; der Test startet den Expo-Ersatz)
 *   … --record=datei.json  nur Web-Anfragen aufzeichnen (Vorher/Nachher-Vergleich mit altem Code)
 */
import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { writeFileSync } from 'node:fs'
import postgres from 'postgres'
import * as C from '../src/lib/contracts/app-v1'
import { safeHandoffNext } from '../src/lib/app-api/handoff'
import { isInQuietHours, nextAllowedTime } from '../src/lib/push/quiet-hours'
import { isAppRequestHeaders, isAppClientHeaders } from '../src/lib/app-mode'

const args = new Set(process.argv.slice(2))
const argVal = (name: string) => process.argv.slice(2).find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
const BASE = (process.env.APP_API_BASE ?? 'http://localhost:3088').replace(/\/$/, '')
const PASSWORD = process.env.TEST_PASSWORD ?? 'Test-Passwort-123!'
const ACCOUNTS = {
  pro: 'app-pro@example.invalid',
  nosub: 'app-nosub@example.invalid',
  starter: 'app-starter@example.invalid',
  partner: 'app-partner@example.invalid',
}

if (/finestsites\.io|finestsites\.de/.test(BASE)) {
  console.error('Abbruch: dieser Test läuft nie gegen Produktion.')
  process.exit(2)
}

let passed = 0
let failed = 0
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    console.log(`  ✗ ${name}\n      ${(err instanceof Error ? err.message : String(err)).split('\n').join('\n      ')}`)
  }
}

// ─── Reine Logik ──────────────────────────────────────────────────────────────

async function unitTests() {
  console.log('▶ Reine Logik')
  await test('safeHandoffNext: erlaubte Ziele', () => {
    assert.equal(safeHandoffNext('/sites'), '/sites')
    assert.equal(safeHandoffNext('/sites/8070e55a-848d-4ffc-8f28-9c2b1c8d6bad/edit'), '/sites/8070e55a-848d-4ffc-8f28-9c2b1c8d6bad/edit')
    assert.equal(safeHandoffNext('/sites/new?template=abc'), '/sites/new?template=abc')
    assert.equal(safeHandoffNext('/affiliate'), '/affiliate')
    assert.equal(safeHandoffNext('/settings?tab=werbung'), '/settings?tab=werbung')
    assert.equal(safeHandoffNext('/onboarding/username'), '/onboarding/username')
  })
  await test('safeHandoffNext: alles andere → /sites', () => {
    for (const bad of [
      undefined, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/%2F%2Fevil.example',
      '/settings', '/settings?tab=zahlung', '/settings?tab=rechnungen', '/settings/billing', '/billing',
      '/onboarding/plan', '/admin', '/sites/x/../../admin', '/sites?evil=1', '/api/billing/checkout',
      '/sites/abc/edit?tab=x', 'javascript:alert(1)', '/sites\n/evil',
    ]) assert.equal(safeHandoffNext(bad), '/sites', `für ${JSON.stringify(bad)}`)
  })
  await test('App-Erkennung: nur mit Kennzeichen', () => {
    const h = (o: Record<string, string>) => new Headers(o)
    assert.equal(isAppRequestHeaders(h({})), false)
    assert.equal(isAppRequestHeaders(h({ 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15' })), false)
    assert.equal(isAppRequestHeaders(h({ cookie: 'fs_app=0' })), false)
    assert.equal(isAppRequestHeaders(h({ cookie: 'x=1; fs_app=10' })), false)
    assert.equal(isAppRequestHeaders(h({ 'x-fs-client': 'web' })), false)
    assert.equal(isAppRequestHeaders(h({ cookie: 'a=b; fs_app=1' })), true)
    assert.equal(isAppRequestHeaders(h({ cookie: 'fs_app=1; a=b' })), true)
    assert.equal(isAppRequestHeaders(h({ 'x-fs-client': 'iOS' })), true)
    assert.equal(isAppRequestHeaders(h({ 'x-fs-client': 'android' })), true)
    assert.equal(isAppRequestHeaders(h({ 'user-agent': 'Mozilla/5.0 (iPad) FinestSitesApp/1.0.0' })), true)
    // Bearer-Token-Ausgabe nur nativ, nicht über das WebView-Cookie
    assert.equal(isAppClientHeaders(h({ cookie: 'fs_app=1' })), false)
  })
  await test('Nachtruhe 21–8 Uhr Europe/Berlin', () => {
    const q = { enabled: true, start: 21, end: 8, timezone: 'Europe/Berlin' }
    assert.equal(isInQuietHours(new Date('2026-10-21T18:30:00Z'), q), false) // 20:30 MESZ
    assert.equal(isInQuietHours(new Date('2026-10-21T19:30:00Z'), q), true)  // 21:30
    assert.equal(isInQuietHours(new Date('2026-10-22T05:59:00Z'), q), true)  // 07:59
    assert.equal(isInQuietHours(new Date('2026-10-22T06:00:00Z'), q), false) // 08:00
    assert.equal(nextAllowedTime(new Date('2026-10-21T19:30:00Z'), q).toISOString(), '2026-10-22T06:00:00.000Z')
    assert.equal(isInQuietHours(new Date('2026-10-21T19:30:00Z'), { ...q, enabled: false }), false)
    assert.equal(isInQuietHours(new Date('2026-10-21T10:30:00Z'), { ...q, start: 12, end: 14 }), true) // 12:30
  })
  await test('Verbindungs-State: signiert, manipulationssicher, läuft ab', async () => {
    process.env.BETTER_AUTH_SECRET ??= 'unit-test-secret'
    const { signConnectState, verifyConnectState } = await import('../src/lib/affiliate/connect-app')
    const s = signConnectState('11111111-1111-1111-1111-111111111111', 'acct_123ABC')
    assert.deepEqual(verifyConnectState(s), { userId: '11111111-1111-1111-1111-111111111111', accountId: 'acct_123ABC' })
    const [p, sig] = s.split('.')
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), a: 'acct_EVIL' })).toString('base64url')
    assert.equal(verifyConnectState(`${forged}.${sig}`), null)
    assert.equal(verifyConnectState(s, Math.floor(Date.now() / 1000) + 25 * 3600), null)
    assert.equal(verifyConnectState('kaputt'), null)
  })
  await test('Verträge: Beispiel-Fehler und Kauf-Sperre', () => {
    C.AppErrorBody.parse({ code: 'UNAUTHORIZED', message: 'x' })
    C.AppPurchaseDisabledBody.parse({ code: 'APP_PURCHASE_DISABLED', message: 'x' })
    assert.throws(() => C.AppErrorBody.parse({ code: 'NOPE', message: 'x' }))
    C.MarkReadRequest.parse({ all: true })
    assert.throws(() => C.MarkReadRequest.parse({ all: true, ids: [] }))
    C.ExpoPushToken.parse('ExponentPushToken[abcdefghijklmnop]')
    assert.throws(() => C.ExpoPushToken.parse('not-a-token'))
  })
  await test('Push: exp.host außerhalb der Produktion gesperrt', async () => {
    const { expoSendUrl } = await import('../src/lib/push/config')
    const saved = process.env.PUSH_EXPO_URL
    delete process.env.PUSH_EXPO_URL
    assert.throws(() => expoSendUrl(), /gesperrt/)
    process.env.PUSH_EXPO_URL = 'http://127.0.0.1:3099/send'
    assert.equal(expoSendUrl(), 'http://127.0.0.1:3099/send')
    if (saved === undefined) delete process.env.PUSH_EXPO_URL; else process.env.PUSH_EXPO_URL = saved
  })
  await test('Kauf-Wörter: neutrale Texte enthalten keine Kauf-/Tarif-Begriffe', async () => {
    const { appMessage } = await import('../src/lib/app-api/messages')
    const banned = /tarif|upgrade|preis|€|euro|kauf|buch|abo\b|abonnement|starter|unlimited|\bpro\b|rabatt|zahl jetzt|bezahl/i
    for (const code of ['SUBSCRIPTION_REQUIRED', 'PLAN_LIMIT_REACHED', 'PAYMENT_PENDING', 'APP_PURCHASE_DISABLED', 'AFFILIATE_NOT_AVAILABLE'] as const) {
      assert.ok(!banned.test(appMessage(code)), `${code}: ${appMessage(code)}`)
    }
  })
}

// ─── HTTP-Helfer ──────────────────────────────────────────────────────────────

type Res = { status: number; headers: Headers; text: string; json: any }
async function call(path: string, init: RequestInit & { cookie?: string; bearer?: string; app?: boolean; web?: boolean } = {}): Promise<Res> {
  const h = new Headers(init.headers)
  if (init.cookie) h.set('cookie', init.cookie)
  if (init.bearer) h.set('authorization', `Bearer ${init.bearer}`)
  if (init.app) { h.set('x-fs-client', 'ios'); h.set('user-agent', 'FinestSitesApp/1.0.0 (iPhone; iOS 26.0)') }
  if (init.web) {
    h.set('user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15')
    if (init.method && init.method !== 'GET') { h.set('origin', BASE); h.set('sec-fetch-site', 'same-origin'); h.set('sec-fetch-mode', 'cors'); h.set('sec-fetch-dest', 'empty') }
  }
  if (init.body && !h.has('content-type')) h.set('content-type', 'application/json')
  // node:http statt fetch: fetch (undici) setzt selbst „Sec-Fetch-Mode: cors“, die native App
  // (React Native/NSURLSession) nicht. So gehen exakt die Header raus, die wir setzen.
  const url = new URL(BASE + path)
  const body = typeof init.body === 'string' ? init.body : undefined
  if (body) h.set('content-length', String(Buffer.byteLength(body)))
  const { status, headers, text } = await new Promise<{ status: number; headers: Headers; text: string }>((resolve, reject) => {
    const req = httpRequest(url, { method: init.method ?? 'GET', headers: Object.fromEntries(h.entries()) }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const out = new Headers()
        for (const [k, v] of Object.entries(res.headers)) {
          if (Array.isArray(v)) v.forEach(x => out.append(k, x))
          else if (v != null) out.set(k, String(v))
        }
        resolve({ status: res.statusCode ?? 0, headers: out, text: Buffer.concat(chunks).toString('utf8') })
      })
    })
    req.setTimeout(120_000, () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
  let json: any = null
  try { json = JSON.parse(text) } catch { /* kein JSON */ }
  return { status, headers, text, json }
}

function cookiesFrom(res: Res): string {
  return res.headers.getSetCookie().map(c => c.split(';')[0]).filter(c => !c.endsWith('=')).join('; ')
}

async function webLogin(email: string): Promise<string> {
  const r = await call('/api/auth/sign-in/email', { method: 'POST', web: true, body: JSON.stringify({ email, password: PASSWORD }) })
  assert.equal(r.status, 200, `Web-Login ${email}: ${r.status} ${r.text.slice(0, 200)}`)
  assert.equal(r.headers.get('set-auth-token'), null, 'Web-Login darf kein set-auth-token liefern')
  const c = cookiesFrom(r)
  assert.ok(c.includes('session_token'), 'Session-Cookie fehlt')
  return c
}

async function appLogin(email: string): Promise<string> {
  const r = await call('/api/auth/sign-in/email', { method: 'POST', app: true, body: JSON.stringify({ email, password: PASSWORD }) })
  assert.equal(r.status, 200, `App-Login ${email}: ${r.status} ${r.text.slice(0, 200)}`)
  const t = r.headers.get('set-auth-token')
  assert.ok(t && t.includes('.'), 'set-auth-token fehlt oder ist nicht signiert')
  assert.ok((r.headers.get('access-control-expose-headers') ?? '').includes('set-auth-token'))
  return t!
}

// ─── Web-Aufzeichnung (Vorher/Nachher) ────────────────────────────────────────

const VOLATILE = new Set(['token', 'expiresAt', 'createdAt', 'updatedAt', 'id', 'ipAddress', 'userAgent', 'userId', 'url', 'serverTime', 'session_id'])
function shape(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shape)
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const k of Object.keys(v).sort()) o[k] = VOLATILE.has(k) ? '<v>' : shape((v as Record<string, unknown>)[k])
    return o
  }
  return v
}
const IGNORED_HEADERS = new Set(['date', 'etag', 'set-cookie', 'content-length', 'keep-alive', 'connection', 'transfer-encoding', 'vary', 'x-nextjs-cache', 'location'])

async function webRequestsForRecord(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  const rec = (name: string, r: Res) => {
    out[name] = {
      status: r.status,
      headers: [...r.headers.keys()].filter(k => !IGNORED_HEADERS.has(k)).sort(),
      body: r.json ? shape(r.json) : r.text.length,
      location: r.headers.get('location')?.replace(BASE, '<base>') ?? null,
      cookieNames: r.headers.getSetCookie().map(c => c.split('=')[0]).sort(),
    }
  }
  const signin = await call('/api/auth/sign-in/email', { method: 'POST', web: true, body: JSON.stringify({ email: ACCOUNTS.nosub, password: PASSWORD }) })
  rec('auth.sign-in', signin)
  const cookie = cookiesFrom(signin)
  rec('auth.sign-in.wrong-password', await call('/api/auth/sign-in/email', { method: 'POST', web: true, body: JSON.stringify({ email: ACCOUNTS.nosub, password: 'falsch' }) }))
  rec('auth.sign-in.no-origin-with-cookie', await call('/api/auth/sign-in/email', { method: 'POST', cookie, body: JSON.stringify({ email: ACCOUNTS.nosub, password: PASSWORD }) }))
  rec('auth.get-session', await call('/api/auth/get-session', { web: true, cookie }))
  rec('auth.get-session.anon', await call('/api/auth/get-session', { web: true }))
  rec('auth.sign-out.no-origin', await call('/api/auth/sign-out', { method: 'POST', cookie, body: '{}' }))
  rec('page.login', await call('/login', { web: true }))
  rec('page.sites.anon', await call('/sites', { web: true }))
  rec('page.sites', await call('/sites', { web: true, cookie }))
  rec('api.user.profile', await call('/api/user/profile', { web: true, cookie }))
  rec('api.submissions.unread', await call('/api/submissions/unread-count', { web: true, cookie }))
  rec('api.tracking.stats', await call('/api/tracking/stats', { web: true, cookie }))
  rec('api.affiliate.stats', await call('/api/affiliate/stats', { web: true, cookie }))
  rec('api.affiliate.connect.return.anon', await call('/api/affiliate/connect/return?account=acct_1', { web: true }))
  for (const [name, method, path, body] of BILLING_ROUTES) {
    rec(`billing.${name}`, await call(path, { method, web: true, cookie, body }))
    rec(`billing.${name}.anon`, await call(path, { method, web: true, body }))
  }
  // Veröffentlichen ohne Tarif (Entwurf mit Bezahl-Vorlage) → bisheriger Kauf-Text im Browser
  rec('publish.nosub', await call(`/api/sites/${NOSUB_SITE}/publish`, { method: 'POST', web: true, cookie }))
  const starter = await webLogin(ACCOUNTS.starter)
  rec('publish.plan-limit', await call(`/api/sites/${STARTER_DRAFT}/publish`, { method: 'POST', web: true, cookie: starter }))
  rec('cron.check-domains.anon', await call('/api/cron/check-domains', {}))
  rec('worker.submit.no-secret', await call('/api/worker/submit', { method: 'POST', body: '{}' }))
  return out
}

const NOSUB_SITE = '8070e55a-848d-4ffc-8f28-9c2b1c8d6bad'
const STARTER_DRAFT = 'e3f89179-ea78-4dab-9048-b1c2f06bb649'

// [name, method, path, body] – Bodies so gewählt, dass im Web nichts gebucht wird (Konto ohne Stripe-Kunde / ungültiger Plan)
const BILLING_ROUTES: [string, string, string, string | undefined][] = [
  ['checkout', 'POST', '/api/billing/checkout', '{}'],
  ['upgrade', 'POST', '/api/billing/upgrade', '{}'],
  ['upgrade.preview', 'POST', '/api/billing/upgrade/preview', '{}'],
  ['portal.post', 'POST', '/api/billing/portal', '{}'],
  ['portal.get', 'GET', '/api/billing/portal', undefined],
  ['reactivate', 'POST', '/api/billing/reactivate', '{}'],
  ['validate-promo', 'GET', '/api/billing/validate-promo?code=TESTCODE', undefined],
  ['referral-offer', 'GET', '/api/billing/referral-offer', undefined],
  ['campaign', 'GET', '/api/billing/campaign', undefined],
  ['verify-session', 'GET', '/api/billing/verify-session', undefined],
  ['activate', 'GET', '/api/billing/activate', undefined],
  ['payment-methods.get', 'GET', '/api/billing/payment-methods', undefined],
  ['payment-methods.patch', 'PATCH', '/api/billing/payment-methods', '{}'],
  ['invoice-details.get', 'GET', '/api/billing/invoice-details', undefined],
  ['invoice-details.post', 'POST', '/api/billing/invoice-details', '{}'],
  ['invoices', 'GET', '/api/billing/invoices', undefined],
  ['subscription.get', 'GET', '/api/billing/subscription', undefined],
  ['subscription.patch', 'PATCH', '/api/billing/subscription', '{}'],
  ['subscription.delete', 'DELETE', '/api/billing/subscription', undefined],
]

// ─── Live-Tests ───────────────────────────────────────────────────────────────

async function liveTests() {
  console.log(`▶ Live gegen ${BASE}`)

  await test('config (öffentlich) erfüllt den Vertrag', async () => {
    const r = await call('/api/app/v1/config')
    assert.equal(r.status, 200, r.text)
    C.ConfigResponse.parse(r.json)
  })

  await test('ohne Anmeldung: 401 UNAUTHORIZED mit festem Code', async () => {
    for (const p of ['/api/app/v1/me', '/api/app/v1/overview', '/api/app/v1/notifications', '/api/app/v1/affiliate', '/api/app/v1/notification-preferences']) {
      const r = await call(p, { app: true })
      assert.equal(r.status, 401, p)
      assert.equal(C.AppErrorBody.parse(r.json).code, 'UNAUTHORIZED')
    }
  })

  let webCookie = ''
  await test('Web: Cookie-Login wie bisher (kein set-auth-token), Session per Cookie', async () => {
    webCookie = await webLogin(ACCOUNTS.pro)
    const s = await call('/api/auth/get-session', { web: true, cookie: webCookie })
    assert.equal(s.status, 200)
    assert.equal(s.json?.user?.email, ACCOUNTS.pro)
    assert.equal(s.headers.get('set-auth-token'), null)
  })

  let token = ''
  await test('App: Login liefert set-auth-token, get-session nur mit Bearer (ohne Cookie/Origin)', async () => {
    token = await appLogin(ACCOUNTS.pro)
    const s = await call('/api/auth/get-session', { app: true, bearer: token })
    assert.equal(s.status, 200)
    assert.equal(s.json?.user?.email, ACCOUNTS.pro)
  })

  await test('App: Login auch mit Sec-Fetch-Headern + Origin finestsites:// (Rückfall für andere fetch-Umsetzungen)', async () => {
    const r = await call('/api/auth/sign-in/email', {
      method: 'POST', app: true,
      headers: { origin: 'finestsites://app', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'cross-site', 'sec-fetch-dest': 'empty' },
      body: JSON.stringify({ email: ACCOUNTS.pro, password: PASSWORD }),
    })
    assert.equal(r.status, 200, r.text)
    assert.ok(r.headers.get('set-auth-token'))
    // ohne Origin, aber mit Sec-Fetch → BetterAuth verlangt Origin (unverändertes Verhalten)
    const no = await call('/api/auth/sign-in/email', { method: 'POST', app: true, headers: { 'sec-fetch-mode': 'cors' }, body: JSON.stringify({ email: ACCOUNTS.pro, password: PASSWORD }) })
    assert.equal(no.status, 403)
  })

  await test('App: unsigniertes Roh-Token wird als Bearer abgelehnt', async () => {
    const raw = token.split('.')[0]
    const s = await call('/api/auth/get-session', { app: true, bearer: decodeURIComponent(raw) })
    assert.equal(s.json, null)
    const me = await call('/api/app/v1/me', { app: true, bearer: decodeURIComponent(raw) })
    assert.equal(me.status, 401)
  })

  await test('me / overview / notifications erfüllen den Vertrag', async () => {
    const me = await call('/api/app/v1/me', { app: true, bearer: token })
    assert.equal(me.status, 200, me.text)
    const m = C.MeResponse.parse(me.json)
    assert.equal(m.user.email, ACCOUNTS.pro)
    assert.equal(m.account.planLabel, 'Pro')
    assert.ok(!/€|preis|price/i.test(me.text), 'keine Preise in /me')
    const ov = await call('/api/app/v1/overview', { app: true, bearer: token })
    assert.equal(ov.status, 200, ov.text)
    const o = C.OverviewResponse.parse(ov.json)
    assert.ok(o.sites.length > 0)
    const n = await call('/api/app/v1/notifications?limit=5', { app: true, bearer: token })
    assert.equal(n.status, 200, n.text)
    C.NotificationsResponse.parse(n.json)
    const mr = await call('/api/app/v1/notifications/read', { method: 'POST', app: true, bearer: token, body: JSON.stringify({ all: true }) })
    assert.equal(mr.status, 200, mr.text)
    C.MarkReadResponse.parse(mr.json)
    const bad = await call('/api/app/v1/notifications/read', { method: 'POST', app: true, bearer: token, body: JSON.stringify({ ids: ['x'] }) })
    assert.equal(bad.status, 400)
    assert.equal(bad.json.code, 'VALIDATION_FAILED')
  })

  await test('me: Konto ohne Tarif → planLabel/quota null, Partnerprogramm aus', async () => {
    const t = await appLogin(ACCOUNTS.nosub)
    const m = C.MeResponse.parse((await call('/api/app/v1/me', { app: true, bearer: t })).json)
    assert.equal(m.account.planLabel, null)
    assert.equal(m.account.quota, null)
    assert.equal(m.features.partnerProgram, false)
    const a = await call('/api/app/v1/affiliate', { app: true, bearer: t })
    assert.equal(a.status, 403)
    assert.equal(a.json.code, 'AFFILIATE_NOT_AVAILABLE')
  })

  await test('Benachrichtigungs-Einstellungen GET/PUT', async () => {
    const g = await call('/api/app/v1/notification-preferences', { app: true, bearer: token })
    assert.equal(g.status, 200, g.text)
    C.NotificationPreferencesResponse.parse(g.json)
    const p = await call('/api/app/v1/notification-preferences', { method: 'PUT', app: true, bearer: token, body: JSON.stringify({ leads: false, quietHours: { start: 22 } }) })
    assert.equal(p.status, 200, p.text)
    const v = C.NotificationPreferencesResponse.parse(p.json)
    assert.equal(v.leads, false); assert.equal(v.quietHours.start, 22); assert.equal(v.quietHours.end, 8)
    const back = await call('/api/app/v1/notification-preferences', { method: 'PUT', app: true, bearer: token, body: JSON.stringify({ leads: true, quietHours: { start: 21 } }) })
    assert.equal(back.status, 200)
    const tz = await call('/api/app/v1/notification-preferences', { method: 'PUT', app: true, bearer: token, body: JSON.stringify({ timezone: 'Mars/Olympus' }) })
    assert.equal(tz.status, 400)
  })

  const deviceToken = `ExponentPushToken[contracttest${Date.now()}]`
  await test('Push-Geräte POST/PATCH/DELETE', async () => {
    const p = await call('/api/app/v1/push/devices', { method: 'POST', app: true, bearer: token, body: JSON.stringify({ token: deviceToken, platform: 'ios', appVersion: '1.0.0' }) })
    assert.equal(p.status, 201, p.text)
    C.DeviceResponse.parse(p.json)
    const again = await call('/api/app/v1/push/devices', { method: 'POST', app: true, bearer: token, body: JSON.stringify({ token: deviceToken, platform: 'ios', appVersion: '1.0.1' }) })
    assert.equal(again.json.id, p.json.id, 'idempotent über das Token')
    const u = await call('/api/app/v1/push/devices', { method: 'PATCH', app: true, bearer: token, body: JSON.stringify({ token: deviceToken, enabled: false }) })
    assert.equal(u.status, 200); assert.equal(u.json.enabled, false)
    const bad = await call('/api/app/v1/push/devices', { method: 'POST', app: true, bearer: token, body: JSON.stringify({ token: 'kaputt', platform: 'ios' }) })
    assert.equal(bad.status, 400)
    const d = await call('/api/app/v1/push/devices', { method: 'DELETE', app: true, bearer: token, body: JSON.stringify({ token: deviceToken }) })
    assert.equal(d.status, 200); C.OkBody.parse(d.json)
  })

  await test('Partnerprogramm (neutral): Vertrag, keine Tarifnamen/Rabatte', async () => {
    const t = await appLogin(ACCOUNTS.partner)
    const r = await call('/api/app/v1/affiliate', { app: true, bearer: t })
    assert.equal(r.status, 200, r.text)
    const a = C.AffiliateResponse.parse(r.json)
    assert.ok(a.link.startsWith('https://finestsites.io/?ref='))
    assert.ok(!/starter|unlimited|"pro"|monthly|yearly|rabatt|spar|%\s*off|aktives abo|billing_interval|plan/i.test(r.text), 'verbotene Begriffe im Partner-JSON')
    const pdf = await call('/api/app/v1/affiliate/credit-notes/00000000-0000-0000-0000-000000000000', { app: true, bearer: t })
    assert.equal(pdf.status, 404)
    const conn = await call('/api/app/v1/affiliate/connect/return?state=kaputt', {})
    assert.equal(conn.status, 302)
    assert.equal(conn.headers.get('location'), 'finestsites://affiliate?connect=error')
  })

  await test('Kauf-Routen: App (Bearer+Header) → 403 APP_PURCHASE_DISABLED', async () => {
    for (const [name, method, path, body] of BILLING_ROUTES) {
      const r = await call(path, { method, app: true, bearer: token, body })
      assert.equal(r.status, 403, `${name}: ${r.status}`)
      C.AppPurchaseDisabledBody.parse(r.json)
    }
  })

  await test('Kauf-Routen: Editor-WebView (Cookie fs_app=1) → 403', async () => {
    for (const [name, method, path, body] of BILLING_ROUTES) {
      const r = await call(path, { method, web: true, cookie: `${webCookie}; fs_app=1`, body })
      assert.equal(r.status, 403, `${name}: ${r.status}`)
      assert.equal(r.json?.code, 'APP_PURCHASE_DISABLED')
    }
  })

  await test('Kauf-Routen: Browser ohne Kennzeichen → nie APP_PURCHASE_DISABLED', async () => {
    const nosub = await webLogin(ACCOUNTS.nosub)
    for (const [name, method, path, body] of BILLING_ROUTES) {
      const r = await call(path, { method, web: true, cookie: nosub, body })
      assert.notEqual(r.json?.code, 'APP_PURCHASE_DISABLED', name)
    }
  })

  await test('Veröffentlichen: App bekommt neutrale Texte, Browser die bisherigen', async () => {
    const tApp = await appLogin(ACCOUNTS.nosub)
    const a = await call(`/api/sites/${NOSUB_SITE}/publish`, { method: 'POST', app: true, bearer: tApp })
    assert.equal(a.status, 402)
    const pa = C.PublishErrorBody.parse(a.json)
    assert.equal(pa.code, 'SUBSCRIPTION_REQUIRED')
    assert.equal(pa.error, 'Diese Vorlage ist in deinem Konto noch nicht freigeschaltet. Dein Entwurf ist gespeichert.')
    const w = await call(`/api/sites/${NOSUB_SITE}/publish`, { method: 'POST', web: true, cookie: await webLogin(ACCOUNTS.nosub) })
    assert.equal(w.status, 402)
    assert.equal(w.json.error, 'Wähle einen Tarif, um deine Webseite zu veröffentlichen.')

    const ts = await appLogin(ACCOUNTS.starter)
    const l = await call(`/api/sites/${STARTER_DRAFT}/publish`, { method: 'POST', app: true, bearer: ts })
    assert.equal(l.status, 403)
    assert.equal(l.json.code, 'PLAN_LIMIT_REACHED')
    assert.equal(l.json.error, 'In deinem Konto sind alle Webseiten schon online.')
    const lw = await call(`/api/sites/${STARTER_DRAFT}/publish`, { method: 'POST', web: true, cookie: await webLogin(ACCOUNTS.starter) })
    assert.equal(lw.status, 403)
    assert.ok(lw.json.error.startsWith('Plan-Limit erreicht. Dein starter-Plan erlaubt 1 aktive Premium-Webseite.'), lw.json.error)
    // WebView mit fs_app-Cookie zählt als App
    const wv = await call(`/api/sites/${STARTER_DRAFT}/publish`, { method: 'POST', web: true, cookie: `${await webLogin(ACCOUNTS.starter)}; fs_app=1` })
    assert.equal(wv.json.error, 'In deinem Konto sind alle Webseiten schon online.')
  })

  await test('Editor-Übergabe: Einmal-Schlüssel → Cookies + fs_app + 302, nur einmal gültig', async () => {
    const g = await call('/api/auth/one-time-token/generate', { app: true, bearer: token })
    assert.equal(g.status, 200, g.text)
    const { token: ott } = C.OneTimeTokenResponse.parse(g.json)
    const h = await call(`/api/app/v1/editor-handoff?ott=${encodeURIComponent(ott)}&next=${encodeURIComponent('/sites/' + NOSUB_SITE + '/edit')}`, {})
    assert.equal(h.status, 302, h.text)
    assert.equal(h.headers.get('location'), `${BASE}/sites/${NOSUB_SITE}/edit`)
    const sc = h.headers.getSetCookie()
    assert.ok(sc.some(c => c.includes('session_token=') && /HttpOnly/i.test(c)), 'Session-Cookie fehlt')
    const appC = sc.find(c => c.startsWith('fs_app=1'))
    assert.ok(appC && /HttpOnly/i.test(appC) && /SameSite=Lax/i.test(appC) && /Path=\//.test(appC), `fs_app-Cookie: ${appC}`)
    // Session aus dem WebView-Cookie funktioniert
    const cookie = cookiesFrom(h)
    const s = await call('/api/auth/get-session', { web: true, cookie })
    assert.equal(s.json?.user?.email, ACCOUNTS.pro)
    // zweites Einlösen scheitert
    const again = await call(`/api/app/v1/editor-handoff?ott=${encodeURIComponent(ott)}`, {})
    assert.equal(again.status, 400)
    assert.equal(again.headers.get('x-fs-error'), 'HANDOFF_INVALID')
    // fremdes Ziel → /sites
    const g2 = await call('/api/auth/one-time-token/generate', { app: true, bearer: token })
    const h2 = await call(`/api/app/v1/editor-handoff?ott=${encodeURIComponent(g2.json.token)}&next=${encodeURIComponent('//evil.example/x')}`, { headers: { origin: 'https://evil.example', referer: 'https://evil.example/' } })
    assert.equal(h2.headers.get('location'), `${BASE}/sites`)
  })

  await test('App: Passwort ändern mit Bearer (ohne Cookie/Origin) und zurück', async () => {
    const r = await call('/api/auth/change-password', { method: 'POST', app: true, bearer: token, body: JSON.stringify({ currentPassword: PASSWORD, newPassword: PASSWORD + 'x' }) })
    assert.equal(r.status, 200, r.text)
    const back = await call('/api/auth/change-password', { method: 'POST', app: true, bearer: r.headers.get('set-auth-token') ?? token, body: JSON.stringify({ currentPassword: PASSWORD + 'x', newPassword: PASSWORD }) })
    assert.equal(back.status, 200, back.text)
    token = back.headers.get('set-auth-token') ?? r.headers.get('set-auth-token') ?? token
  })

  await test('App: Abmelden mit Bearer (ohne Cookie/Origin) beendet die Session', async () => {
    const t = await appLogin(ACCOUNTS.pro)
    const out = await call('/api/auth/sign-out', { method: 'POST', app: true, bearer: t, body: '{}' })
    assert.equal(out.status, 200, out.text)
    const s = await call('/api/auth/get-session', { app: true, bearer: t })
    assert.equal(s.json, null)
    const me = await call('/api/app/v1/me', { app: true, bearer: t })
    assert.equal(me.status, 401)
  })

  await test('Web: Cookie-Session nach allem weiterhin gültig', async () => {
    const s = await call('/api/auth/get-session', { web: true, cookie: webCookie })
    assert.equal(s.json?.user?.email, ACCOUNTS.pro)
  })
}

// ─── Push ─────────────────────────────────────────────────────────────────────

async function withDb<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL fehlt (lokale Test-DB)')
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error('DATABASE_URL zeigt nicht auf localhost – Abbruch')
  const sql = postgres(url, { max: 1 })
  try { return await fn(sql) } finally { await sql.end() }
}

async function submitLead(siteId: string, isSpam = false): Promise<string> {
  const r = await call('/api/worker/submit', {
    method: 'POST',
    headers: { 'x-worker-secret': process.env.WORKER_SECRET ?? 'local-worker-secret' },
    body: JSON.stringify({ userSiteId: siteId, formName: 'contact', data: { name: 'Test', message: 'Hallo' }, isSpam }),
  })
  assert.equal(r.status, 200, r.text)
  return r.json.id
}

async function pushDisabledTests() {
  console.log('▶ Push abgeschaltet (Standard)')
  await test('Formular-Eingang ohne Push: Antwort unverändert, keine Outbox-/Mitteilungs-Zeilen', async () => {
    await withDb(async (sql) => {
      const [site] = await sql`select s.id, s.user_id from user_sites s join users u on u.id = s.user_id where u.email = ${ACCOUNTS.pro} and s.status = 'published' limit 1`
      const [before] = await sql`select (select count(*) from push_outbox)::int o, (select count(*) from user_notifications)::int n`
      const id = await submitLead(site.id)
      assert.ok(id)
      await new Promise(r => setTimeout(r, 800))
      const [after] = await sql`select (select count(*) from push_outbox)::int o, (select count(*) from user_notifications)::int n`
      assert.deepEqual(after, before)
      await sql`delete from form_submissions where id = ${id}`
    })
  })
  await test('Cron push-drain/push-receipts: ohne Secret 401, mit Secret „disabled“', async () => {
    assert.equal((await call('/api/cron/push-drain', {})).status, 401)
    const auth = { authorization: `Bearer ${process.env.CRON_SECRET ?? 'local-cron-secret'}` }
    const d = await call('/api/cron/push-drain', { headers: auth })
    assert.equal(d.status, 200); assert.equal(d.json.disabled, true)
    const r = await call('/api/cron/push-receipts', { headers: auth })
    assert.equal(r.status, 200); assert.equal(r.json.disabled, true)
  })
}

async function pushEnabledTests() {
  console.log('▶ Push eingeschaltet (Server mit PUSH_ENABLED=true, PUSH_EXPO_URL auf Expo-Ersatz)')
  const received: unknown[][] = []
  const receiptsAsked: string[][] = []
  const mock = createServer((req, res) => {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      const json = JSON.parse(body || 'null')
      res.setHeader('content-type', 'application/json')
      if (req.url === '/send') {
        received.push(json)
        res.end(JSON.stringify({ data: (json as { to: string }[]).map((m, i) => m.to.includes('gone') ? { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: `ticket-${Date.now()}-${i}` }) }))
      } else if (req.url === '/receipts') {
        receiptsAsked.push(json.ids)
        res.end(JSON.stringify({ data: Object.fromEntries(json.ids.map((id: string) => [id, { status: 'ok' }])) }))
      } else { res.statusCode = 404; res.end('{}') }
    })
  })
  await new Promise<void>(r => mock.listen(3099, '127.0.0.1', () => r()))
  const auth = { authorization: `Bearer ${process.env.CRON_SECRET ?? 'local-cron-secret'}` }
  try {
    await withDb(async (sql) => {
      await sql`insert into app_settings (key, value) values ('push_enabled', 'true') on conflict (key) do update set value = 'true'`
      // Schalter-Zwischenspeicher im Server (30 s) abwarten
      await new Promise(r => setTimeout(r, 31_000))
      const [site] = await sql`select s.id, s.user_id from user_sites s join users u on u.id = s.user_id where u.email = ${ACCOUNTS.pro} and s.status = 'published' limit 1`
      await sql`delete from push_outbox where user_id = ${site.user_id}`
      await sql`delete from notification_preferences where user_id = ${site.user_id}`
      await sql`insert into notification_preferences (user_id, quiet_hours_enabled) values (${site.user_id}, false)`
      await sql`delete from push_devices where user_id = ${site.user_id}`
      await sql`insert into push_devices (user_id, expo_token, platform) values (${site.user_id}, 'ExponentPushToken[localtestdevice01]', 'ios'), (${site.user_id}, 'ExponentPushToken[localtestgone0001]', 'ios')`

      await test('Formular-Eingang → genau eine Outbox-Zeile + Mitteilung, ohne Interessenten-Daten', async () => {
        const id1 = await submitLead(site.id)
        const id2 = await submitLead(site.id) // innerhalb der Sperrzeit → gedrosselt
        const idSpam = await submitLead(site.id, true)
        await new Promise(r => setTimeout(r, 1500))
        const rows = await sql`select * from push_outbox where user_id = ${site.user_id}`
        assert.equal(rows.length, 1, `Outbox-Zeilen: ${rows.length}`)
        assert.equal(rows[0].status, 'pending')
        assert.equal(rows[0].category, 'leads')
        assert.ok(!/Test|Hallo/.test(rows[0].title + rows[0].body), 'Interessenten-Daten im Text')
        const notes = await sql`select * from user_notifications where user_id = ${site.user_id} and type = 'submission'`
        assert.ok(notes.length >= 1)
        await sql`delete from form_submissions where id in (${id1}, ${id2}, ${idSpam})`
      })

      await test('Cron push-drain sendet an den Expo-Ersatz, speichert Tickets, schaltet abgemeldete Geräte ab', async () => {
        const d = await call('/api/cron/push-drain', { headers: auth })
        assert.equal(d.status, 200, d.text)
        assert.equal(d.json.sent, 1, JSON.stringify(d.json))
        assert.equal(received.length, 1)
        assert.equal((received[0] as unknown[]).length, 2)
        const [row] = await sql`select status from push_outbox where user_id = ${site.user_id}`
        assert.equal(row.status, 'sent')
        const del = await sql`select d.status, d.ticket_id, d.error from push_deliveries d join push_outbox o on o.id = d.outbox_id where o.user_id = ${site.user_id}`
        assert.equal(del.length, 2)
        const gone = await sql`select enabled, disabled_reason from push_devices where expo_token = 'ExponentPushToken[localtestgone0001]'`
        assert.equal(gone[0].enabled, false); assert.equal(gone[0].disabled_reason, 'device_not_registered')
        const again = await call('/api/cron/push-drain', { headers: auth })
        assert.equal(again.json.claimed, 0, 'nichts doppelt')
      })

      await test('Empfangsbestätigungen (Tickets künstlich gealtert)', async () => {
        await sql`update push_deliveries set created_at = now() - interval '20 minutes' where outbox_id in (select id from push_outbox where user_id = ${site.user_id})`
        const r = await call('/api/cron/push-receipts', { headers: auth })
        assert.equal(r.status, 200, r.text)
        assert.equal(r.json.ok, 1, JSON.stringify(r.json))
        assert.equal(receiptsAsked.length, 1)
      })

      await test('Nachtruhe: Zeile wird verschoben statt gesendet', async () => {
        await sql`update notification_preferences set quiet_hours_enabled = true, quiet_start_hour = 0, quiet_end_hour = 0 where user_id = ${site.user_id}`
        // start == end = keine Nachtruhe → stattdessen Nachtruhe rund um die aktuelle Stunde setzen
        const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
        await sql`update notification_preferences set quiet_start_hour = ${hour}, quiet_end_hour = ${(hour + 2) % 24} where user_id = ${site.user_id}`
        await sql`insert into push_outbox (user_id, category, type, title, body) values (${site.user_id}, 'support', 'support_reply', 'Test', 'Test')`
        const before = received.length
        const d = await call('/api/cron/push-drain', { headers: auth })
        assert.equal(d.json.deferred, 1, JSON.stringify(d.json))
        assert.equal(received.length, before)
        const [row] = await sql`select status, not_before > now() as later, attempts from push_outbox where user_id = ${site.user_id} and type = 'support_reply'`
        assert.equal(row.status, 'pending'); assert.equal(row.later, true); assert.equal(row.attempts, 0)
      })

      await test('Kategorie aus → übersprungen', async () => {
        await sql`update notification_preferences set quiet_hours_enabled = false, support = false where user_id = ${site.user_id}`
        await sql`update push_outbox set not_before = now() where user_id = ${site.user_id} and status = 'pending'`
        const d = await call('/api/cron/push-drain', { headers: auth })
        assert.equal(d.json.skipped, 1, JSON.stringify(d.json))
        const [row] = await sql`select status, skip_reason from push_outbox where user_id = ${site.user_id} and type = 'support_reply'`
        assert.equal(row.status, 'skipped'); assert.equal(row.skip_reason, 'category_off')
      })

      await test('Support-Antwort des Admins → Outbox-Zeile ohne Nachrichtentext', async () => {
        const [conv] = await sql`insert into support_conversations (user_id, status, last_message_at) values (${site.user_id}, 'open', now()) returning id`
        const admin = await webLogin('admin-local@example.invalid')
        const r = await call('/api/admin/support/messages', { method: 'POST', web: true, cookie: admin, body: JSON.stringify({ conversationId: conv.id, content: 'Geheimer Antworttext 123' }) })
        assert.equal(r.status, 200, r.text)
        await new Promise(res => setTimeout(res, 1000))
        const rows = await sql`select title, body, data from push_outbox where user_id = ${site.user_id} and type = 'support_reply' and data->>'conversationId' = ${conv.id}`
        assert.equal(rows.length, 1)
        assert.ok(!/Geheim/.test(rows[0].title + rows[0].body))
        await sql`delete from support_conversations where id = ${conv.id}`
      })

      // Aufräumen: Schalter wieder aus, Test-Zeilen weg
      await sql`update app_settings set value = 'false' where key = 'push_enabled'`
      await sql`delete from push_outbox where user_id = ${site.user_id}`
      await sql`delete from user_notifications where user_id = ${site.user_id} and type in ('submission', 'support_reply')`
      await sql`delete from push_devices where user_id = ${site.user_id}`
      await sql`delete from notification_preferences where user_id = ${site.user_id}`
    })
  } finally {
    mock.close()
  }
}

// ─── Ablauf ───────────────────────────────────────────────────────────────────

async function main() {
  const record = argVal('record')
  if (record) {
    const out = await webRequestsForRecord()
    writeFileSync(record, JSON.stringify(out, null, 2))
    console.log(`Web-Aufzeichnung: ${Object.keys(out).length} Anfragen → ${record}`)
    return
  }
  await unitTests()
  if (!args.has('--unit')) {
    await liveTests()
    if (argVal('push') === 'enabled') await pushEnabledTests()
    else await pushDisabledTests()
  }
  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} ok, ${failed} fehlgeschlagen`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => { console.error(err); process.exit(1) })
