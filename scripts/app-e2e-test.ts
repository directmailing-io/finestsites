/**
 * Ende-zu-Ende-Test der App-Schnittstellen OHNE Simulator: geht genau die Anfragen durch, die die
 * Expo-App (mobile/src/api/client.ts + endpoints.ts) stellt – gleiche Header (Bearer, X-FS-Client,
 * X-App-Version, Accept), keine Cookies (wie fetch mit credentials: 'omit'), gleiche Pfade und Bodys.
 * Jede /api/app/v1-Antwort wird gegen den zod-Vertrag (src/lib/contracts/app-v1) geprüft, die
 * Web-Routen gegen die Formen aus mobile/src/api/types.ts.
 *
 * NUR LOKAL gegen die Testumgebung (docs/local-testenv.md):
 *   scripts/local-testenv/start.sh            # Server auf http://localhost:3077, DB finestsites_dev
 *   npx tsx scripts/app-e2e-test.ts
 *
 * Schreibt nur in finestsites_dev (Testkonten qa-*): legt kurz eine Support-Zugriffsanfrage, eine
 * Mitteilung, ein Push-Gerät und einen Entwurf an und räumt sie wieder ab. Keine Mails, kein Push,
 * kein Stripe-Aufruf (Auszahlung läuft im Modus „verrechnen“ und endet vor Stripe).
 *
 * Sicherheit: bricht ab, wenn Server oder DB nicht localhost sind. Sendet nie einen fremden
 * Host-Header (die lokale Middleware leitet unbekannte Hosts an den Produktions-Worker weiter).
 */
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import postgres from 'postgres'
import type { z } from 'zod'
import * as C from '../src/lib/contracts/app-v1'

const BASE = (process.env.APP_E2E_BASE ?? 'http://localhost:3077').replace(/\/$/, '')
const DB_URL = process.env.APP_E2E_DATABASE_URL ?? 'postgresql://finestsites_dev:finestsites_dev_local@localhost:5432/finestsites_dev'
const PASSWORD = 'Test1234!'
const APP_VERSION = '1.0.0 (1)'

{
  const b = new URL(BASE)
  const d = new URL(DB_URL)
  if (!['localhost', '127.0.0.1'].includes(b.hostname) || !['localhost', '127.0.0.1'].includes(d.hostname) || !d.pathname.endsWith('/finestsites_dev')) {
    console.error('Abbruch: dieser Test läuft nur gegen localhost und die Test-DB finestsites_dev.')
    process.exit(2)
  }
}

const sql = postgres(DB_URL, { max: 2, onnotice: () => {} })

// ─── Mini-Testrahmen ──────────────────────────────────────────────────────────

let passed = 0
let failed = 0
const failures: string[] = []
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    const msg = (err instanceof Error ? err.message : String(err)).split('\n').slice(0, 8).join('\n      ')
    failures.push(name)
    console.log(`  ✗ ${name}\n      ${msg}`)
  }
}

// ─── App-Client (wie mobile/src/api/client.ts) ────────────────────────────────

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
interface Res { status: number; headers: Headers; text: string; json: unknown }

class AppClient {
  token: string | null = null
  constructor(readonly platform: 'ios' | 'android' = 'ios') {}

  headers(): Record<string, string> {
    // Genau die Header aus baseHeaders(): kein Cookie, kein Origin, kein fremder Host
    const h: Record<string, string> = { Accept: 'application/json', 'X-FS-Client': this.platform, 'X-App-Version': APP_VERSION }
    if (this.token) h.Authorization = `Bearer ${this.token}`
    return h
  }

  async raw(method: Method, path: string, opts: { body?: unknown; query?: Record<string, string | number | undefined> } = {}): Promise<Res> {
    const url = new URL(`${BASE}${path}`)
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    const headers = this.headers()
    let body: string | undefined
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.body)
    }
    if (body !== undefined) headers['Content-Length'] = String(Buffer.byteLength(body))
    // node:http statt fetch: Node-fetch (undici) setzt wie ein Browser `Sec-Fetch-Mode: cors`, die
    // React-Native-Netzwerkschicht (NSURLSession/OkHttp) nicht. Mit diesem Header würde BetterAuth
    // eine Herkunft verlangen – der Test bliebe dann nicht bei den echten App-Headern.
    const res = await new Promise<{ status: number; headers: Headers; text: string }>((resolve, reject) => {
      const req = httpRequest(url, { method, headers }, r => {
        const chunks: Buffer[] = []
        r.on('data', c => chunks.push(c))
        r.on('end', () => {
          const h = new Headers()
          for (const [k, v] of Object.entries(r.headers)) {
            if (Array.isArray(v)) for (const x of v) h.append(k, x)
            else if (v !== undefined) h.set(k, v)
          }
          resolve({ status: r.statusCode ?? 0, headers: h, text: Buffer.concat(chunks).toString('utf8') })
        })
      })
      req.on('error', reject)
      if (body !== undefined) req.write(body)
      req.end()
    })
    let json: unknown = null
    try { json = res.text ? JSON.parse(res.text) : null } catch { json = null }
    // Wie die App: ein neues Token im Header übernehmen
    const rotated = res.headers.get('set-auth-token')
    if (rotated && this.token && rotated !== this.token) this.token = rotated
    return { ...res, json }
  }

  async get(path: string, query?: Record<string, string | number | undefined>) { return this.raw('GET', path, { query }) }
  async post(path: string, body?: unknown) { return this.raw('POST', path, { body }) }
  async put(path: string, body?: unknown) { return this.raw('PUT', path, { body }) }
  async patch(path: string, body?: unknown) { return this.raw('PATCH', path, { body }) }
  async del(path: string, body?: unknown) { return this.raw('DELETE', path, { body }) }

  /** signIn() aus mobile/src/api/endpoints.ts */
  async signIn(email: string) {
    const res = await this.raw('POST', '/api/auth/sign-in/email', { body: { email: email.toLowerCase().trim(), password: PASSWORD, rememberMe: true } })
    assert.equal(res.status, 200, `Anmeldung ${email}: HTTP ${res.status} ${res.text.slice(0, 200)}`)
    const token = res.headers.get('set-auth-token') ?? (res.json as { token?: string })?.token ?? null
    assert.ok(token, 'kein set-auth-token-Header')
    this.token = token
    return res
  }
}

function ok(res: Res, status = 200) {
  assert.equal(res.status, status, `HTTP ${res.status} statt ${status}: ${res.text.slice(0, 300)}`)
}

function contract<S extends z.ZodTypeAny>(schema: S, res: Res, status = 200): z.infer<S> {
  ok(res, status)
  const p = schema.safeParse(res.json)
  if (!p.success) throw new Error(`Vertrag verletzt: ${JSON.stringify(p.error.issues).slice(0, 600)}`)
  return p.data
}

function hasKeys(obj: unknown, keys: string[], label: string) {
  assert.ok(obj && typeof obj === 'object', `${label}: kein Objekt`)
  for (const k of keys) assert.ok(k in (obj as Record<string, unknown>), `${label}: Feld „${k}“ fehlt`)
}

/** Kauf-/Preis-Wörter, die in keiner Antwort an die App stehen dürfen (Texte, nicht Codes). */
const FORBIDDEN_TEXT = /(€|tarif wählen|upgrade|jetzt kaufen|rabatt|gutschein|preis|premium|kostenlos|starter|unlimited|aktives abo|bitte upgrade)/i

// ─── Testablauf ───────────────────────────────────────────────────────────────

const pro = new AppClient('ios')
const free = new AppClient('ios')
const partner = new AppClient('ios')
const cleanup: (() => Promise<unknown>)[] = []

async function main() {
  const health = await fetch(`${BASE}/api/health`).catch(() => null)
  if (!health?.ok) {
    console.error(`Server ${BASE} nicht erreichbar – zuerst scripts/local-testenv/start.sh starten.`)
    process.exit(2)
  }
  const [{ id: proId }] = await sql<{ id: string }[]>`select id from users where email = 'qa-pro@example.invalid'`
  const [{ id: adminId }] = await sql<{ id: string }[]>`select id from users where email = 'admin@example.invalid'`

  console.log('▶ Start der App (ohne Anmeldung)')
  await step('GET /api/app/v1/config – Vertrag, öffentlich', async () => {
    const anon = new AppClient()
    const c = contract(C.ConfigResponse, await anon.get('/api/app/v1/config'))
    assert.equal(c.apiVersion, 1)
  })
  await step('geschützte Route ohne Token → 401 UNAUTHORIZED', async () => {
    const r = await new AppClient().get('/api/app/v1/me')
    const e = contract(C.AppErrorBody, r, 401)
    assert.equal(e.code, 'UNAUTHORIZED')
  })

  console.log('▶ Anmelden (qa-pro)')
  await step('POST /api/auth/sign-in/email mit X-FS-Client → Bearer-Token, ohne Cookie-Zwang', async () => {
    const r = await pro.signIn('qa-pro@example.invalid')
    contract(C.SignInEmailResponse, r)
  })
  await step('Browser-Anmeldung bekommt KEIN set-auth-token', async () => {
    const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE, 'User-Agent': 'Mozilla/5.0 Safari/605.1.15' },
      body: JSON.stringify({ email: 'qa-pro@example.invalid', password: PASSWORD }),
    })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('set-auth-token'), null)
  })

  let me!: C.MeResponse
  await step('GET /api/app/v1/me', async () => {
    me = contract(C.MeResponse, await pro.get('/api/app/v1/me'))
    assert.equal(me.user.email, 'qa-pro@example.invalid')
    assert.equal(me.onboarding.complete, true)
    assert.equal(me.features.partnerProgram, true)
  })

  let overview!: C.OverviewResponse
  await step('GET /api/app/v1/overview – Seiten mit visitors7d, Vorwoche, Status, Aufgaben', async () => {
    overview = contract(C.OverviewResponse, await pro.get('/api/app/v1/overview'))
    assert.ok(overview.sites.length >= 2, 'qa-pro hat 2 Seiten')
    for (const s of overview.sites) assert.equal(typeof s.visitors7d, 'number')
    assert.equal(overview.accountStatus.code, 'ok')
    assert.ok(overview.todos.some(t => t.code === 'unread_submissions'), 'Aufgabe „neue Anfragen“ fehlt')
    assert.ok(!FORBIDDEN_TEXT.test(JSON.stringify(overview.todos)), 'Kauf-Text in Aufgaben')
  })

  console.log('▶ Seiten')
  let siteId = ''
  await step('GET /api/sites (Web-Route mit Bearer)', async () => {
    const r = await pro.get('/api/sites')
    ok(r)
    const list = r.json as Record<string, unknown>[]
    assert.ok(Array.isArray(list) && list.length >= 2)
    for (const s of list) hasKeys(s, ['id', 'template_id', 'status', 'published_at', 'created_at', 'updated_at', 'username', 'custom_domain', 'custom_domain_status', 'unread_submissions', 'has_unpublished_changes', 'templates'], 'Site')
    siteId = String(list.find(s => s.status === 'published')?.id ?? list[0].id)
    assert.ok(overview.sites.some(c => c.id === siteId), 'Seite fehlt in der Übersicht')
  })
  await step('GET /api/sites/[id] (Detail)', async () => {
    const r = await pro.get(`/api/sites/${siteId}`)
    ok(r)
    hasKeys(r.json, ['id', 'template_id', 'status', 'published_at', 'username', 'custom_domain', 'custom_domain_status', 'templates', 'has_unpublished_changes'], 'Site-Detail')
  })
  await step('GET /api/templates mit X-FS-Client → ohne Preis-/Tarif-Felder (strikter Vertrag)', async () => {
    const list = contract(C.AppTemplatesResponse, await pro.get('/api/templates'))
    assert.ok(list.length > 0)
    const text = JSON.stringify(list)
    for (const f of ['is_free', 'placeholder_schema', 'nm_companies', 'is_test', 'beliebt']) assert.ok(!text.includes(f), `Feld/Wert ${f} darf nicht an die App`)
  })

  console.log('▶ Anfragen')
  let sub: { id: string; user_site_id: string; read_at: string | null } | null = null
  await step('GET /api/submissions?status=all + Detail aus der Liste', async () => {
    const r = await pro.get('/api/submissions', { status: 'all' })
    ok(r)
    const d = r.json as { submissions: Record<string, unknown>[]; total: number }
    hasKeys(d, ['submissions', 'total'], 'SubmissionList')
    assert.ok(d.submissions.length > 0)
    for (const s of d.submissions) hasKeys(s, ['id', 'user_site_id', 'form_name', 'data', 'read_at', 'archived_at', 'created_at', 'site'], 'Submission')
    const unread = d.submissions.find(s => !s.read_at) as typeof sub
    assert.ok(unread, 'keine ungelesene Anfrage')
    sub = unread
    // „Detail“ in der App: Suche in Liste + Archiv (mobile/src/app/(tabs)/inbox/[id].tsx)
    const arch = await pro.get('/api/submissions', { status: 'archived' })
    ok(arch)
  })
  await step('GET /api/submissions?status=unread + unread-count', async () => {
    ok(await pro.get('/api/submissions', { status: 'unread' }))
    const c = await pro.get('/api/submissions/unread-count')
    ok(c)
    assert.equal(typeof (c.json as { count: number }).count, 'number')
  })
  await step('PATCH /api/sites/[id]/submissions/[id] { read: true } → gelesen, danach zurück', async () => {
    assert.ok(sub)
    ok(await pro.patch(`/api/sites/${sub.user_site_id}/submissions/${sub.id}`, { read: true }))
    const [row] = await sql<{ read_at: Date | null }[]>`select read_at from form_submissions where id = ${sub.id}`
    assert.ok(row.read_at, 'read_at nicht gesetzt')
    ok(await pro.patch(`/api/sites/${sub.user_site_id}/submissions/${sub.id}`, { read: false }))
  })

  console.log('▶ Hilfe-Chat')
  let conversationId = ''
  await step('GET /api/support/conversation', async () => {
    const r = await pro.get('/api/support/conversation')
    ok(r)
    const list = (r.json as { conversations: Record<string, unknown>[] }).conversations
    assert.ok(list.length > 0)
    for (const c of list) hasKeys(c, ['id', 'subject', 'status', 'createdAt', 'unreadByUser', 'lastMessage'], 'Conversation')
    conversationId = String(list[0].id)
  })
  await step('GET /api/support/messages?conversationId=…', async () => {
    const r = await pro.get('/api/support/messages', { conversationId })
    ok(r)
    const msgs = (r.json as { messages: Record<string, unknown>[] }).messages
    for (const m of msgs) hasKeys(m, ['id', 'conversationId', 'senderType', 'senderId', 'content', 'contentType', 'mediaUrl', 'createdAt'], 'Message')
  })
  let sentId = ''
  await step('POST /api/support/messages (Text) + PATCH …/read', async () => {
    // Zähler/Zeitstempel des Gesprächs nach dem Test wiederherstellen (die Nachricht wird gelöscht)
    const [conv] = await sql<{ unread_by_admin: number; unread_by_user: number; last_message_at: Date | null; updated_at: Date }[]>`
      select unread_by_admin, unread_by_user, last_message_at, updated_at from support_conversations where id = ${conversationId}`
    cleanup.push(() => sql`update support_conversations set unread_by_admin = ${conv.unread_by_admin}, unread_by_user = ${conv.unread_by_user},
      last_message_at = ${conv.last_message_at}, updated_at = ${conv.updated_at} where id = ${conversationId}`)
    const r = await pro.post('/api/support/messages', { conversationId, content: 'E2E-Test aus der App', contentType: 'text' })
    ok(r)
    const m = (r.json as { message: { id: string; content: string } }).message
    assert.equal(m.content, 'E2E-Test aus der App')
    sentId = m.id
    cleanup.push(() => sql`delete from support_messages where id = ${sentId}`)
    ok(await pro.patch(`/api/support/conversation/${conversationId}/read`))
  })

  console.log('▶ Support-Zugriff (Freigabe in der App)')
  const impTokenA = `e2e_${randomBytes(12).toString('hex')}`
  const impTokenB = `e2e_${randomBytes(12).toString('hex')}`
  await sql`insert into impersonation_requests (admin_id, user_id, token, status, conversation_id) values (${adminId}, ${proId}, ${impTokenA}, 'pending', ${conversationId}), (${adminId}, ${proId}, ${impTokenB}, 'pending', ${conversationId})`
  cleanup.push(() => sql`delete from impersonation_requests where token in (${impTokenA}, ${impTokenB})`)
  await step('GET /api/app/v1/impersonation?token=… → pending', async () => {
    const v = contract(C.ImpersonationResponse, await pro.get('/api/app/v1/impersonation', { token: impTokenA }))
    assert.equal(v.request?.status, 'pending')
    assert.equal(v.request?.adminName, '@demo')
  })
  await step('GET /api/app/v1/impersonation (ohne Token) → neueste offene Anfrage', async () => {
    const v = contract(C.ImpersonationResponse, await pro.get('/api/app/v1/impersonation'))
    assert.ok(v.request && [impTokenA, impTokenB].includes(v.request.token))
  })
  await step('POST /api/app/v1/impersonation approve → approved', async () => {
    const d = contract(C.ImpersonationDecisionResponse, await pro.post('/api/app/v1/impersonation', { token: impTokenA, action: 'approve' }))
    assert.equal(d.status, 'approved')
    const v = contract(C.ImpersonationResponse, await pro.get('/api/app/v1/impersonation', { token: impTokenA }))
    assert.equal(v.request?.status, 'approved')
  })
  await step('POST /api/app/v1/impersonation deny → rejected; erneutes approve → 404', async () => {
    const d = contract(C.ImpersonationDecisionResponse, await pro.post('/api/app/v1/impersonation', { token: impTokenB, action: 'deny' }))
    assert.equal(d.status, 'rejected')
    const again = await pro.post('/api/app/v1/impersonation', { token: impTokenB, action: 'approve' })
    assert.equal(contract(C.AppErrorBody, again, 404).code, 'NOT_FOUND')
  })
  await step('fremdes Token → request null, Entscheidung 404', async () => {
    const v = contract(C.ImpersonationResponse, await pro.get('/api/app/v1/impersonation', { token: 'gibt-es-nicht' }))
    assert.equal(v.request, null)
    ok(await pro.post('/api/app/v1/impersonation', { token: 'gibt-es-nicht', action: 'deny' }), 404)
  })

  console.log('▶ Mitteilungen')
  const notifId = randomUUID()
  await sql`insert into user_notifications (id, user_id, type, title, message, data) values (${notifId}, ${proId}, 'submission', 'Neue Anfrage', 'Über deine Webseite ist eine neue Anfrage eingegangen.', ${sql.json({ url: `finestsites://submissions/${randomUUID()}` })})`
  cleanup.push(() => sql`delete from user_notifications where id = ${notifId}`)
  await step('GET /api/app/v1/notifications', async () => {
    const n = contract(C.NotificationsResponse, await pro.get('/api/app/v1/notifications', { limit: 50 }))
    const item = n.items.find(i => i.id === notifId)
    assert.ok(item && item.readAt === null)
    assert.ok(n.unreadCount >= 1)
    assert.match(String(item.data.url), /^finestsites:\/\/submissions\//)
  })
  await step('POST /api/app/v1/notifications/read { ids } und { all: true }', async () => {
    const r1 = contract(C.MarkReadResponse, await pro.post('/api/app/v1/notifications/read', { ids: [notifId] }))
    assert.equal(r1.updated, 1)
    const r2 = contract(C.MarkReadResponse, await pro.post('/api/app/v1/notifications/read', { all: true }))
    assert.equal(r2.unreadCount, 0)
    const bad = await pro.post('/api/app/v1/notifications/read', { ids: 'all' })
    assert.equal(contract(C.AppErrorBody, bad, 400).code, 'VALIDATION_FAILED')
  })

  console.log('▶ Push-Gerät und Einstellungen')
  const pushToken = `ExponentPushToken[e2e${randomBytes(10).toString('hex')}]`
  cleanup.push(() => sql`delete from push_devices where expo_token = ${pushToken}`)
  await step('POST /api/app/v1/push/devices (wie lib/push.ts)', async () => {
    const d = contract(C.DeviceResponse, await pro.post('/api/app/v1/push/devices', {
      token: pushToken, platform: 'ios', appVersion: '1.0.0', osVersion: '27.0', deviceModel: 'iPhone 16', locale: 'de-DE',
    }), 201)
    assert.equal(d.enabled, true)
  })
  await step('DELETE /api/app/v1/push/devices (vor dem Abmelden)', async () => {
    contract(C.OkBody, await pro.del('/api/app/v1/push/devices', { token: pushToken }))
    const rows = await sql`select 1 from push_devices where expo_token = ${pushToken}`
    assert.equal(rows.length, 0)
  })
  let prefsBefore!: C.NotificationPreferences
  await step('GET/PUT /api/app/v1/notification-preferences (Teilupdate + Zeitzone), danach zurück', async () => {
    prefsBefore = contract(C.NotificationPreferencesResponse, await pro.get('/api/app/v1/notification-preferences'))
    const next = contract(C.NotificationPreferencesResponse, await pro.put('/api/app/v1/notification-preferences', {
      leads: !prefsBefore.leads, quietHours: { enabled: true, start: 22, end: 7 }, timezone: 'Europe/Berlin',
    }))
    assert.equal(next.leads, !prefsBefore.leads)
    assert.equal(next.quietHours.start, 22)
    contract(C.NotificationPreferencesResponse, await pro.put('/api/app/v1/notification-preferences', {
      leads: prefsBefore.leads, support: prefsBefore.support, account: prefsBefore.account, partner: prefsBefore.partner,
      quietHours: prefsBefore.quietHours, timezone: prefsBefore.timezone,
    }))
  })

  console.log('▶ Profil (Web-Route mit Bearer)')
  await step('PATCH /api/user/profile { email_opt_out } → /me zeigt es, danach zurück', async () => {
    ok(await pro.patch('/api/user/profile', { email_opt_out: ['offers'] }))
    const m = contract(C.MeResponse, await pro.get('/api/app/v1/me'))
    assert.deepEqual(m.emailOptOut, ['offers'])
    ok(await pro.patch('/api/user/profile', { email_opt_out: me.emailOptOut }))
  })

  console.log('▶ Partnerprogramm (qa-pro sieht es, Gutschriften leer)')
  await step('GET /api/app/v1/affiliate (qa-pro) – neutrale Texte', async () => {
    const a = contract(C.AffiliateResponse, await pro.get('/api/app/v1/affiliate'))
    assert.ok(!FORBIDDEN_TEXT.test(JSON.stringify(a.texts)), 'Kauf-Text in Partner-Texten')
    assert.ok(!/starter|pro\b|unlimited|monat|jahr/i.test(JSON.stringify(a.referrals)), 'Tarif in Empfehlungen')
  })

  console.log('▶ Editor-Übergabe (Einmal-Schlüssel → WebView)')
  await step('GET /api/auth/one-time-token/generate (Bearer) → Token', async () => {
    contract(C.OneTimeTokenResponse, await pro.get('/api/auth/one-time-token/generate'))
  })
  await step('editor-handoff → 302 mit Session- + fs_app-Cookie; Editor lädt im App-Modus (ohne Seitenleiste)', async () => {
    const { token: ott } = contract(C.OneTimeTokenResponse, await pro.get('/api/auth/one-time-token/generate'))
    const next = `/sites/${siteId}/edit`
    // Der WebView schickt weder Bearer noch X-FS-Client, nur seinen User-Agent
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 FinestSitesApp/1'
    const r = await fetch(`${BASE}/api/app/v1/editor-handoff?ott=${encodeURIComponent(ott)}&next=${encodeURIComponent(next)}`, { redirect: 'manual', headers: { 'User-Agent': ua } })
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), `${BASE}${next}`)
    const cookies = r.headers.getSetCookie()
    const jar = cookies.map(c => c.split(';')[0]).filter(c => !c.endsWith('='))
    assert.ok(jar.some(c => c.startsWith('fs_app=1')), 'fs_app-Cookie fehlt')
    assert.ok(jar.some(c => /session_token=/.test(c)), 'Session-Cookie fehlt')
    // Einmal-Schlüssel ist verbraucht
    const again = await fetch(`${BASE}/api/app/v1/editor-handoff?ott=${encodeURIComponent(ott)}&next=${encodeURIComponent(next)}`, { redirect: 'manual', headers: { 'User-Agent': ua } })
    assert.equal(again.status, 400)
    // Editor-Seite mit den Cookies des WebViews
    const page = await fetch(`${BASE}${next}`, { headers: { Cookie: jar.join('; '), 'User-Agent': ua }, redirect: 'manual' })
    assert.equal(page.status, 200, `Editor: HTTP ${page.status} → ${page.headers.get('location')}`)
    const html = await page.text()
    assert.ok(!html.includes('w-[220px]'), 'Seitenleiste ist im App-Modus sichtbar')
    // Gegenprobe: dieselbe Sitzung ohne fs_app = normales Web-Layout mit Seitenleiste
    const web = await fetch(`${BASE}${next}`, { headers: { Cookie: jar.filter(c => !c.startsWith('fs_app=')).join('; '), 'User-Agent': 'Mozilla/5.0 Safari/605.1.15' }, redirect: 'manual' })
    assert.equal(web.status, 200)
    assert.ok((await web.text()).includes('w-[220px]'), 'Gegenprobe: Web-Layout ohne Seitenleiste?')
  })
  await step('editor-handoff mit fremdem next → nur Positivliste (/sites)', async () => {
    const { token: ott } = contract(C.OneTimeTokenResponse, await pro.get('/api/auth/one-time-token/generate'))
    const r = await fetch(`${BASE}/api/app/v1/editor-handoff?ott=${encodeURIComponent(ott)}&next=${encodeURIComponent('/billing')}`, { redirect: 'manual' })
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), `${BASE}/sites`)
  })

  console.log('▶ Kauf-Wege gesperrt')
  await step('POST /api/billing/checkout aus der App → 403 APP_PURCHASE_DISABLED', async () => {
    const e = contract(C.AppPurchaseDisabledBody, await pro.post('/api/billing/checkout', { plan: 'pro', interval: 'monthly' }), 403)
    assert.equal(e.code, 'APP_PURCHASE_DISABLED')
  })
  await step('GET /api/billing/subscription aus der App → 403 APP_PURCHASE_DISABLED', async () => {
    contract(C.AppPurchaseDisabledBody, await pro.get('/api/billing/subscription'), 403)
  })

  console.log('▶ Konto ohne Tarif (qa-free)')
  await step('Anmelden qa-free, /me ohne Tarif, Partnerprogramm verborgen', async () => {
    await free.signIn('qa-free@example.invalid')
    const m = contract(C.MeResponse, await free.get('/api/app/v1/me'))
    assert.equal(m.account.planLabel, null)
    assert.equal(m.features.partnerProgram, false)
    const a = await free.get('/api/app/v1/affiliate')
    assert.equal(contract(C.AppErrorBody, a, 403).code, 'AFFILIATE_NOT_AVAILABLE')
    for (const p of ['/api/app/v1/affiliate/payout-mode', '/api/app/v1/affiliate/tax-profile', '/api/app/v1/affiliate/credit-notes']) {
      assert.equal(contract(C.AppErrorBody, await free.get(p), 403).code, 'AFFILIATE_NOT_AVAILABLE', p)
    }
  })
  await step('Veröffentlichen ohne Tarif → 402 SUBSCRIPTION_REQUIRED mit neutralem Text', async () => {
    const tpl = contract(C.AppTemplatesResponse, await free.get('/api/templates')).find(t => t.domain === 'wellpreneur.io' && !t.is_coming_soon)
    assert.ok(tpl, 'Business-Vorlage nicht gefunden')
    const created = await free.post('/api/sites', { template_id: tpl.id })
    assert.ok(created.status === 200 || created.status === 201, `Entwurf: HTTP ${created.status} ${created.text.slice(0, 200)}`)
    const draftId = (created.json as { id: string }).id
    try {
      await publishBlocked(draftId)
    } finally {
      ok(await free.del(`/api/sites/${draftId}`))
    }
  })
}

async function publishBlocked(draftId: string) {
  const pub = await free.post(`/api/sites/${draftId}/publish`, {})
  const body = contract(C.PublishErrorBody, pub, 402)
  assert.equal(body.code, 'SUBSCRIPTION_REQUIRED')
  assert.ok(!FORBIDDEN_TEXT.test(body.error) && !/tarif/i.test(body.error), `Kauf-Text: ${body.error}`)
  // Gegenprobe ohne App-Kennung (kein X-FS-Client): unveränderter Web-Text
  const browserLike = await fetch(`${BASE}/api/sites/${draftId}/publish`, { method: 'POST', headers: { Authorization: `Bearer ${free.token}`, 'Content-Type': 'application/json' }, body: '{}' })
  const wb = await browserLike.json() as { error: string; code: string }
  assert.equal(browserLike.status, 402)
  assert.equal(wb.error, 'Wähle einen Tarif, um deine Webseite zu veröffentlichen.')
}

async function partnerAndSignOut() {
  console.log('▶ Partnerprogramm (qa-partner)')
  let modeBefore: C.PayoutModeResponse['mode'] = 'credit'
  await step('Anmelden qa-partner, GET /api/app/v1/affiliate', async () => {
    await partner.signIn('qa-partner@example.invalid')
    const a = contract(C.AffiliateResponse, await partner.get('/api/app/v1/affiliate'))
    assert.ok(a.history.commissions.length > 0, 'qa-partner hat Provisionen')
    assert.ok(a.history.payouts.some(p => p.creditNote?.number === 'GS-2026-90001'), 'Gutschrift GS-2026-90001 fehlt im Verlauf')
  })
  await step('GET/PUT /api/app/v1/affiliate/payout-mode (umstellen und zurück)', async () => {
    const m = contract(C.PayoutModeResponse, await partner.get('/api/app/v1/affiliate/payout-mode'))
    modeBefore = m.mode
    assert.equal(m.canChange, true)
    const other = m.mode === 'credit' ? 'payout' : 'credit'
    assert.equal(contract(C.PayoutModeResponse, await partner.put('/api/app/v1/affiliate/payout-mode', { mode: other })).mode, other)
    assert.equal(contract(C.PayoutModeResponse, await partner.put('/api/app/v1/affiliate/payout-mode', { mode: modeBefore })).mode, modeBefore)
    const bad = await partner.put('/api/app/v1/affiliate/payout-mode', { mode: 'bar' })
    assert.equal(contract(C.AppErrorBody, bad, 400).code, 'VALIDATION_FAILED')
  })
  await step('GET/PUT /api/app/v1/affiliate/tax-profile – gleiche Prüfung wie im Web', async () => {
    const before = contract(C.TaxProfileResponse, await partner.get('/api/app/v1/affiliate/tax-profile'))
    assert.equal(before.complete, true)
    const p = before.profile!
    const bad = await partner.put('/api/app/v1/affiliate/tax-profile', {
      taxStatus: 'x', fullName: '', street: '', zip: '1', city: '', taxId: '', entrepreneurConfirmed: false, consent: false,
    })
    const e = contract(C.AppErrorBody, bad, 400)
    assert.equal(e.code, 'VALIDATION_FAILED')
    for (const f of ['taxStatus', 'fullName', 'street', 'zip', 'city', 'entrepreneurConfirmed', 'consent']) assert.ok(e.fields?.[f], `Hinweis für ${f} fehlt`)
    const badVat = await partner.put('/api/app/v1/affiliate/tax-profile', {
      taxStatus: 'regelbesteuert', fullName: p.fullName, street: p.street, zip: p.zip, city: p.city, taxId: 'DE12', entrepreneurConfirmed: true, consent: true,
    })
    assert.equal(contract(C.AppErrorBody, badVat, 400).fields?.taxId, 'Die USt-IdNr. sieht so aus: DE und 9 Ziffern, z. B. DE123456789.')
    const saved = contract(C.TaxProfileResponse, await partner.put('/api/app/v1/affiliate/tax-profile', {
      taxStatus: p.taxStatus, fullName: p.fullName, street: p.street, zip: p.zip, city: p.city, taxId: p.taxId, entrepreneurConfirmed: true, consent: true,
    }))
    assert.equal(saved.complete, true)
    assert.equal(saved.profile?.taxId, p.taxId)
  })
  await step('POST /api/app/v1/affiliate/payout im Modus „verrechnen“ → mode_credit (kein Stripe)', async () => {
    const m = contract(C.PayoutModeResponse, await partner.get('/api/app/v1/affiliate/payout-mode'))
    assert.equal(m.mode, 'credit', 'qa-partner sollte auf „verrechnen“ stehen')
    const r = contract(C.PayoutResponse, await partner.post('/api/app/v1/affiliate/payout'))
    assert.equal(r.status, 'mode_credit')
  })
  let noteId = ''
  await step('GET /api/app/v1/affiliate/credit-notes → GS-2026-90001', async () => {
    const n = contract(C.CreditNotesResponse, await partner.get('/api/app/v1/affiliate/credit-notes'))
    const note = n.items.find(i => i.number === 'GS-2026-90001')
    assert.ok(note, 'Gutschrift fehlt')
    noteId = note.id
  })
  await step('GET /api/app/v1/affiliate/credit-notes/[id] (PDF mit Bearer; R2 lokal nicht erreichbar → 503 erlaubt)', async () => {
    const r = await partner.raw('GET', `/api/app/v1/affiliate/credit-notes/${noteId}`)
    assert.ok(r.status === 200 || r.status === 503, `HTTP ${r.status}: ${r.text.slice(0, 200)}`)
    if (r.status === 200) assert.match(r.headers.get('content-type') ?? '', /pdf/)
    // fremde Gutschrift: qa-pro bekommt sie nie
    const foreign = await pro.raw('GET', `/api/app/v1/affiliate/credit-notes/${noteId}`)
    assert.equal(foreign.status, 404)
  })

  // Nur lesend: auf finestsites_dev wird nie eine Löschung angefragt (dafür scripts/test-account-deletion.ts
  // gegen eine eigene Wegwerf-DB).
  console.log('▶ Konto löschen (nur Status)')
  await step('GET /api/app/v1/account/deletion (qa-pro) → status none, darf löschen', async () => {
    const d = contract(C.DeletionStatusResponse, await pro.get('/api/app/v1/account/deletion'))
    assert.equal(d.status, 'none')
    assert.equal(d.scheduledFor, null)
    assert.equal(d.canDelete, true)
    assert.equal(d.graceDays, C.DELETION_GRACE_DAYS)
  })
  await step('GET /api/app/v1/account/deletion (qa-partner) → Guthaben im Vertrag, Verzichtstext nennt Betrag', async () => {
    const d = contract(C.DeletionStatusResponse, await partner.get('/api/app/v1/account/deletion'))
    assert.equal(d.status, 'none')
    assert.ok(d.partnerBalance.totalCents >= 0)
    assert.equal(d.partnerBalance.waiverText, C.waiverText(d.partnerBalance.totalCents))
  })
  await step('POST /api/app/v1/account/deletion mit falschem Passwort → 400 INVALID_PASSWORD, nichts vorgemerkt', async () => {
    assert.equal(contract(C.AppErrorBody, await free.post('/api/app/v1/account/deletion', { password: 'falsch-falsch' }), 400).code, 'INVALID_PASSWORD')
    const d = contract(C.DeletionStatusResponse, await free.get('/api/app/v1/account/deletion'))
    assert.equal(d.status, 'none')
  })

  console.log('▶ Abmelden')
  await step('POST /api/auth/sign-out mit Bearer (ohne Cookie/Origin) → danach 401', async () => {
    for (const c of [pro, free, partner]) {
      const r = await c.post('/api/auth/sign-out', {})
      ok(r)
      const after = await c.get('/api/app/v1/me')
      assert.equal(after.status, 401)
    }
  })
}

async function all() {
  await main()
  await partnerAndSignOut()
}

all()
  .catch(err => {
    failed++
    console.error('Abbruch:', err)
  })
  .finally(async () => {
    for (const fn of cleanup.reverse()) await fn().catch(() => {})
    await sql.end({ timeout: 5 })
    console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen${failures.length ? `\n  → ${failures.join('\n  → ')}` : ''}`)
    process.exit(failed > 0 ? 1 : 0)
  })
