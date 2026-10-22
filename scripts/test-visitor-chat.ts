/**
 * Ende-zu-Ende-Test des Besucher-Chats (Server-Teil) gegen die LOKALE Testumgebung (docs/local-testenv.md):
 *
 *   psql postgresql://finestsites_dev:finestsites_dev_local@localhost:5432/finestsites_dev \
 *        -f supabase/migrations/20261022200000_visitor_chat.sql
 *   scripts/local-testenv/start.sh            # Server auf http://localhost:3077
 *   npx tsx scripts/test-visitor-chat.ts
 *
 * Spielt beide Seiten durch: das Widget (über die Worker-Kopfzeilen, wie der Cloudflare-Worker sie setzt)
 * und den Betreiber (qa-pro, Bearer wie die App). Schaltet den Chat per SQL aus/ein (app_settings) und
 * wartet auf den 30-s-Cache des Servers. Schreibt nur in finestsites_dev und räumt die Gespräche ab.
 * Keine Mails: Resend ist lokal ein Dummy, geprüft wird nur der Eintrag in email_logs.
 */
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import postgres from 'postgres'
import type { z } from 'zod'
import * as C from '../src/lib/contracts/app-v1'

const BASE = (process.env.APP_E2E_BASE ?? 'http://localhost:3077').replace(/\/$/, '')
const DB_URL = process.env.APP_E2E_DATABASE_URL ?? 'postgresql://finestsites_dev:finestsites_dev_local@localhost:5432/finestsites_dev'
const WORKER_SECRET = process.env.TEST_WORKER_SECRET ?? 'local-worker-secret-dummy'
const CRON_SECRET = process.env.TEST_CRON_SECRET ?? 'local-cron-secret-dummy'
const PASSWORD = 'Test1234!'
const OWNER_EMAIL = 'qa-pro@example.invalid'
const ADMIN_EMAIL = 'admin@example.invalid'

{
  const b = new URL(BASE)
  const d = new URL(DB_URL)
  if (!['localhost', '127.0.0.1'].includes(b.hostname) || !['localhost', '127.0.0.1'].includes(d.hostname) || !d.pathname.endsWith('/finestsites_dev')) {
    console.error('Abbruch: dieser Test läuft nur gegen localhost und die Test-DB finestsites_dev.')
    process.exit(2)
  }
}

const sql = postgres(DB_URL, { max: 2, onnotice: () => {} })
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

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

interface Res { status: number; headers: Headers; text: string; json: unknown }

function contract<S extends z.ZodTypeAny>(schema: S, res: Res, status = 200): z.infer<S> {
  assert.equal(res.status, status, `HTTP ${res.status} statt ${status}: ${res.text.slice(0, 300)}`)
  const p = schema.safeParse(res.json)
  if (!p.success) throw new Error(`Vertrag verletzt: ${JSON.stringify(p.error.issues).slice(0, 600)}`)
  return p.data
}

// ─── Betreiber-Client (Bearer, wie mobile/src/api/client.ts) ──────────────────

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'
class AppClient {
  token: string | null = null
  headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: 'application/json', 'X-FS-Client': 'ios', 'X-App-Version': '1.0.0 (1)' }
    if (this.token) h.Authorization = `Bearer ${this.token}`
    return h
  }
  async raw(method: Method, path: string, body?: unknown): Promise<Res> {
    const url = new URL(`${BASE}${path}`)
    const headers = this.headers()
    let payload: string | undefined
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      payload = JSON.stringify(body)
      headers['Content-Length'] = String(Buffer.byteLength(payload))
    }
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
      if (payload !== undefined) req.write(payload)
      req.end()
    })
    let json: unknown = null
    try { json = res.text ? JSON.parse(res.text) : null } catch { json = null }
    const rotated = res.headers.get('set-auth-token')
    if (rotated && this.token && rotated !== this.token) this.token = rotated
    return { ...res, json }
  }
  get(path: string) { return this.raw('GET', path) }
  post(path: string, body?: unknown) { return this.raw('POST', path, body) }
  put(path: string, body?: unknown) { return this.raw('PUT', path, body) }
  del(path: string) { return this.raw('DELETE', path) }
  async signIn(email: string) {
    const res = await this.raw('POST', '/api/auth/sign-in/email', { email, password: PASSWORD, rememberMe: true })
    assert.equal(res.status, 200, `Anmeldung ${email}: HTTP ${res.status} ${res.text.slice(0, 200)}`)
    const token = res.headers.get('set-auth-token') ?? (res.json as { token?: string })?.token ?? null
    assert.ok(token, 'kein set-auth-token-Header')
    this.token = token
  }
}

// ─── Besucher-Client (so, wie der Worker die App ruft) ────────────────────────

class Visitor {
  constructor(readonly siteId: string, readonly host: string, public token: string | null, readonly ipHash = sha256(`ip:${randomBytes(4).toString('hex')}`)) {}
  async call(method: 'GET' | 'POST', path: string, body?: unknown, query?: Record<string, string>): Promise<Res> {
    const url = new URL(`${BASE}/api/worker/chat/${path}`)
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v)
    const headers: Record<string, string> = {
      'x-worker-secret': WORKER_SECRET,
      'x-fs-site-id': this.siteId,
      'x-fs-host': this.host,
      'x-fs-ip-hash': this.ipHash,
      'x-fs-ua': 'Mozilla/5.0 (Test)',
      Accept: 'application/json',
    }
    if (this.token) headers['x-fs-visitor'] = this.token
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const r = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
    const text = await r.text()
    let json: unknown = null
    try { json = text ? JSON.parse(text) : null } catch { json = null }
    return { status: r.status, headers: r.headers, text, json }
  }
  config() { return this.call('GET', 'config') }
  session(body: Record<string, unknown> = {}) { return this.call('POST', 'session', body) }
  messages(after?: string) { return this.call('GET', 'messages', undefined, after ? { after } : undefined) }
  send(body: string, clientId = randomBytes(8).toString('hex'), pageUrl = `https://${this.host}/?utm=test`) {
    return this.call('POST', 'messages', { body, clientId, pageUrl })
  }
  read() { return this.call('POST', 'read', {}) }
  profile(body: Record<string, unknown>) { return this.call('POST', 'profile', body) }
}

const newToken = () => randomBytes(32).toString('base64url')

// ─── Schalter per SQL + auf den Server-Cache warten ───────────────────────────

async function setSetting(key: string, value: string) {
  await sql`insert into app_settings (key, value, updated_at) values (${key}, ${value}, now())
            on conflict (key) do update set value = excluded.value, updated_at = now()`
}

async function waitForEnabled(v: Visitor, want: boolean, maxMs = 40_000) {
  const started = Date.now()
  for (;;) {
    const res = await v.config()
    const enabled = res.status === 200 && (res.json as { enabled?: boolean })?.enabled === true
    if (enabled === want) return
    if (Date.now() - started > maxMs) throw new Error(`Schalter wurde nicht ${want ? 'an' : 'aus'} (HTTP ${res.status} ${res.text.slice(0, 120)})`)
    await sleep(1000)
  }
}

// ─── Testablauf ───────────────────────────────────────────────────────────────

const owner = new AppClient()
const admin = new AppClient()

async function main() {
  const health = await fetch(`${BASE}/api/health`).catch(() => null)
  if (!health?.ok) {
    console.error(`Server ${BASE} nicht erreichbar – zuerst scripts/local-testenv/start.sh starten.`)
    process.exit(2)
  }
  const [pro] = await sql<{ id: string; username: string }[]>`select id, username from users where email = ${OWNER_EMAIL}`
  assert.ok(pro, 'Testkonto qa-pro fehlt')
  const [site] = await sql<{ id: string; domain: string; title: string; published_data: Record<string, string> | null }[]>`
    select us.id, t.domain, t.title, us.published_data from user_sites us join templates t on t.id = us.template_id
    where us.user_id = ${pro.id} and us.status = 'published' order by us.created_at limit 1`
  assert.ok(site, 'qa-pro hat keine veröffentlichte Seite')
  const host = `${pro.username}.${site.domain}`
  const [{ count: tablesOk }] = await sql<{ count: number }[]>`select count(*)::int as count from information_schema.tables where table_name in ('chat_conversations','chat_messages','chat_blocks','chat_resume_tokens')`
  if (Number(tablesOk) !== 4) {
    console.error('Migration 20261022200000_visitor_chat.sql fehlt in finestsites_dev.')
    process.exit(2)
  }

  // Ausgangslage: alte Testreste weg, Schalter merken
  await sql`delete from chat_conversations where user_id = ${pro.id}`
  await sql`delete from chat_blocks where user_id = ${pro.id}`
  const previous = Object.fromEntries((await sql<{ key: string; value: string }[]>`select key, value from app_settings where key in ('visitor_chat_enabled','visitor_chat_users')`).map(r => [r.key, r.value]))

  const probe = new Visitor(site.id, host, null)

  console.log('▶ Schalter aus')
  await setSetting('visitor_chat_enabled', 'false')
  await setSetting('visitor_chat_users', pro.username)
  await waitForEnabled(probe, false)

  await step('config → 200 { enabled:false }', async () => {
    const res = await probe.config()
    assert.equal(res.status, 200)
    assert.deepEqual(res.json, { enabled: false })
  })
  await step('session → 404 disabled', async () => {
    const res = await probe.session({})
    assert.equal(res.status, 404, res.text)
    assert.equal((res.json as { error: string }).error, 'disabled')
  })
  await step('messages POST → 404 disabled', async () => {
    const v = new Visitor(site.id, host, newToken())
    const res = await v.send('Hallo')
    assert.equal(res.status, 404, res.text)
  })
  await step('ohne Worker-Secret → 401', async () => {
    const r = await fetch(`${BASE}/api/worker/chat/config`, { headers: { 'x-fs-site-id': site.id } })
    assert.equal(r.status, 401)
  })
  await step('Betreiber-Anmeldung qa-pro (Bearer)', () => owner.signIn(OWNER_EMAIL))
  await step('Betreiber: Liste → 403 FEATURE_DISABLED', async () => {
    const res = await owner.get('/api/app/v1/chat/conversations')
    assert.equal(res.status, 403, res.text)
    assert.equal((res.json as { code: string }).code, 'FEATURE_DISABLED')
  })
  await step('Betreiber: unread → 403 FEATURE_DISABLED', async () => {
    const res = await owner.get('/api/app/v1/chat/unread')
    assert.equal(res.status, 403, res.text)
  })
  await step('me.features.visitorChat = false, overview.unread.chat = 0', async () => {
    const me = contract(C.MeResponse, await owner.get('/api/app/v1/me'))
    assert.equal(me.features.visitorChat, false)
    const ov = contract(C.OverviewResponse, await owner.get('/api/app/v1/overview'))
    assert.equal(ov.unread.chat, 0)
    assert.ok(!ov.todos.some(t => t.code === 'unread_chats'))
  })
  await step('site-meta ohne chat', async () => {
    const r = await fetch(`${BASE}/api/worker/site-meta?username=${pro.username}&domain=${site.domain}`, { headers: { 'x-worker-secret': WORKER_SECRET } })
    assert.equal(r.status, 200)
    const j = await r.json() as { chat?: unknown }
    assert.equal(j.chat, undefined)
  })

  console.log('▶ Schalter an (qapro) – warte auf den 30-s-Cache')
  await setSetting('visitor_chat_enabled', 'true')
  await waitForEnabled(probe, true)

  const expectedOwnerName = (site.published_data?.vorname ?? '').trim()
    || ((await sql<{ first_name: string | null }[]>`select first_name from users where id = ${pro.id}`)[0].first_name ?? '').trim()
    || 'Inhaber'

  await step('config → owner/whatsapp/welcome/siteHost', async () => {
    const res = await probe.config()
    assert.equal(res.status, 200, res.text)
    const j = res.json as { enabled: boolean; owner: { name: string; avatarUrl: string | null; brandColor: string | null }; whatsappUrl: string | null; welcome: string; siteHost: string }
    assert.equal(j.enabled, true)
    assert.equal(j.owner.name, expectedOwnerName)
    assert.equal(j.siteHost, host)
    assert.equal(j.welcome, 'Hi! Schreib mir gern, ich antworte so schnell ich kann.')
    assert.ok(j.whatsappUrl === null || /^https:\/\/wa\.me\/\d+$/.test(j.whatsappUrl), `whatsappUrl ${j.whatsappUrl}`)
    assert.ok('avatarUrl' in j.owner && 'brandColor' in j.owner)
  })
  await step('site-meta → chat.enabled', async () => {
    const r = await fetch(`${BASE}/api/worker/site-meta?username=${pro.username}&domain=${site.domain}`, { headers: { 'x-worker-secret': WORKER_SECRET } })
    const j = await r.json() as { chat?: { enabled: boolean } }
    assert.deepEqual(j.chat, { enabled: true })
  })
  await step('session ohne Token → kein Gespräch', async () => {
    const res = await probe.session({})
    assert.equal(res.status, 200, res.text)
    const j = res.json as { enabled: boolean; conversationId: string | null; messages: unknown[] }
    assert.equal(j.enabled, true)
    assert.equal(j.conversationId, null)
    assert.deepEqual(j.messages, [])
    assert.equal((await sql`select count(*)::int as n from chat_conversations where user_id = ${pro.id}`)[0].n, 0, 'session darf kein Gespräch anlegen')
  })

  const token1 = newToken()
  const visitor = new Visitor(site.id, host, token1)
  let conversationId = ''
  let firstMessageId = ''
  const clientId1 = 'c-' + randomBytes(6).toString('hex')

  await step('POST messages ohne Token → 400 TOKEN_REQUIRED', async () => {
    const res = await probe.send('Hallo?')
    assert.equal(res.status, 400, res.text)
    assert.equal((res.json as { error: string }).error, 'TOKEN_REQUIRED')
  })
  await step('erste Nachricht legt Gespräch an (owner_unread 1, Pfad, nur Hashes)', async () => {
    const res = await visitor.send('Hallo, ich habe eine Frage zu deinem Angebot.', clientId1)
    assert.equal(res.status, 200, res.text)
    const { message, conversationId: topId } = res.json as { message: z.infer<typeof C.ChatMessage>; conversationId: string }
    assert.ok(C.ChatMessage.safeParse(message).success, 'Nachricht entspricht nicht ChatMessage')
    assert.equal(message.sender, 'visitor')
    assert.equal(message.clientId, clientId1)
    assert.equal(topId, message.conversationId, 'conversationId auf oberster Ebene fehlt')
    conversationId = message.conversationId
    firstMessageId = message.id
    const [row] = await sql<Record<string, unknown>[]>`select * from chat_conversations where id = ${conversationId}`
    assert.ok(row)
    assert.equal(row.owner_unread, 1)
    assert.equal(row.visitor_unread, 0)
    assert.equal(row.started_on_path, '/?utm=test')
    assert.equal(row.visitor_token_hash, sha256(token1))
    assert.equal(row.visitor_key, sha256(token1).slice(0, 4).toUpperCase())
    assert.equal(row.ip_hash, visitor.ipHash)
    assert.equal(row.last_message_sender, 'visitor')
    assert.ok(!JSON.stringify(row).includes(token1), 'Klartext-Token in der DB')
  })
  await step('Idempotenz: gleiche clientId → gleiche Nachricht, Zähler unverändert', async () => {
    const res = await visitor.send('Hallo, ich habe eine Frage zu deinem Angebot.', clientId1)
    assert.equal(res.status, 200, res.text)
    assert.equal((res.json as { message: { id: string } }).message.id, firstMessageId)
    const [row] = await sql`select owner_unread, (select count(*)::int from chat_messages where conversation_id = ${conversationId}) as n from chat_conversations where id = ${conversationId}`
    assert.equal(row.owner_unread, 1)
    assert.equal(row.n, 1)
  })
  await step('session mit Token → Gespräch + Nachrichten', async () => {
    const res = await visitor.session({ visitorToken: token1 })
    assert.equal(res.status, 200, res.text)
    const j = res.json as { conversationId: string; status: string; visitor: { name: null; notifyByEmail: boolean }; messages: { id: string }[]; visitorToken: string }
    assert.equal(j.conversationId, conversationId)
    assert.equal(j.status, 'open')
    assert.equal(j.visitorToken, token1)
    assert.equal(j.messages.length, 1)
    assert.equal(j.visitor.notifyByEmail, false)
  })
  await step('Polling after=<id> → leer, ohne after → 1; visitor_last_seen_at gesetzt', async () => {
    const a = await visitor.messages(firstMessageId)
    assert.equal(a.status, 200, a.text)
    assert.deepEqual((a.json as { messages: unknown[] }).messages, [])
    assert.equal((a.json as { ownerReadAt: unknown }).ownerReadAt, null, 'ownerReadAt muss vor dem Lesen null sein')
    const b = await visitor.messages()
    assert.equal((b.json as { messages: unknown[] }).messages.length, 1)
    const [row] = await sql`select visitor_last_seen_at from chat_conversations where id = ${conversationId}`
    assert.ok(row.visitor_last_seen_at)
  })
  await step('Push-Auslöser: Mitteilung nur wenn Push an (hier aus → keine Zeile, kein Fehler)', async () => {
    const [{ n }] = await sql`select count(*)::int as n from push_outbox where category = 'chat'`
    const pushOn = (await sql`select value from app_settings where key = 'push_enabled'`)[0]?.value === 'true'
    if (!pushOn) assert.equal(n, 0)
  })

  console.log('▶ Betreiber (App-Vertrag)')
  await step('me.features.visitorChat = true', async () => {
    const me = contract(C.MeResponse, await owner.get('/api/app/v1/me'))
    assert.equal(me.features.visitorChat, true)
  })
  await step('overview.unread.chat = 1 + Todo unread_chats', async () => {
    const ov = contract(C.OverviewResponse, await owner.get('/api/app/v1/overview'))
    assert.equal(ov.unread.chat, 1)
    const todo = ov.todos.find(t => t.code === 'unread_chats')
    assert.ok(todo && todo.count === 1, 'Todo unread_chats fehlt')
  })
  await step('unread → { count:1, conversations:1 }', async () => {
    const u = contract(C.ChatUnreadResponse, await owner.get('/api/app/v1/chat/unread'))
    assert.deepEqual(u, { count: 1, conversations: 1 })
  })
  await step('Liste (open) → 1 Gespräch, Vertrag, „Besucher XXXX“', async () => {
    const list = contract(C.ChatConversationsResponse, await owner.get('/api/app/v1/chat/conversations'))
    assert.equal(list.conversations.length, 1)
    assert.equal(list.unreadTotal, 1)
    const c = list.conversations[0]
    assert.equal(c.id, conversationId)
    assert.equal(c.siteId, site.id)
    assert.equal(c.siteHost, host)
    assert.equal(c.siteTitle, site.title)
    assert.equal(c.unread, 1)
    assert.match(c.visitor.displayName, /^Besucher [0-9A-F]{4}$/)
    assert.equal(c.visitor.initials.length, 2)
    assert.equal(c.visitor.online, true)
    assert.equal(c.lastMessage?.sender, 'visitor')
    assert.equal(c.reportedAt, null)
    assert.equal(list.nextCursor, null)
  })
  await step('Liste: ungültiger Status → 400, archived leer', async () => {
    const bad = await owner.get('/api/app/v1/chat/conversations?status=foo')
    assert.equal(bad.status, 400)
    const arch = contract(C.ChatConversationsResponse, await owner.get('/api/app/v1/chat/conversations?status=archived'))
    assert.equal(arch.conversations.length, 0)
  })
  await step('Gespräch GET → Nachrichten, hasMore false, owner_last_seen_at gesetzt', async () => {
    const r = contract(C.ChatConversationResponse, await owner.get(`/api/app/v1/chat/conversations/${conversationId}`))
    assert.equal(r.messages.length, 1)
    assert.equal(r.hasMore, false)
    assert.equal(r.messages[0].clientId, null, 'clientId fremder Nachrichten darf nicht geliefert werden')
    const [row] = await sql`select owner_last_seen_at from chat_conversations where id = ${conversationId}`
    assert.ok(row.owner_last_seen_at)
  })
  await step('fremde/unbekannte ID → 404 NOT_FOUND', async () => {
    const res = await owner.get('/api/app/v1/chat/conversations/00000000-0000-4000-8000-000000000000')
    assert.equal(res.status, 404)
    assert.equal((res.json as { code: string }).code, 'NOT_FOUND')
    const res2 = await owner.get('/api/app/v1/chat/conversations/nicht-uuid')
    assert.equal(res2.status, 404)
  })

  let ownerMessageId = ''
  const ownerClientId = 'o-' + randomBytes(6).toString('hex')
  await step('Betreiber antwortet → visitor_unread 1, owner_unread unverändert', async () => {
    const r = contract(C.SendChatMessageResponse, await owner.post(`/api/app/v1/chat/conversations/${conversationId}/messages`, { body: 'Hallo! Gern, was möchtest du wissen?', clientId: ownerClientId }))
    assert.equal(r.message.sender, 'owner')
    assert.equal(r.message.clientId, ownerClientId)
    ownerMessageId = r.message.id
    const [row] = await sql`select owner_unread, visitor_unread, last_message_sender from chat_conversations where id = ${conversationId}`
    assert.equal(row.visitor_unread, 1)
    assert.equal(row.owner_unread, 1)
    assert.equal(row.last_message_sender, 'owner')
  })
  await step('Betreiber: gleiche clientId → gleiche Nachricht', async () => {
    const r = contract(C.SendChatMessageResponse, await owner.post(`/api/app/v1/chat/conversations/${conversationId}/messages`, { body: 'Hallo! Gern, was möchtest du wissen?', clientId: ownerClientId }))
    assert.equal(r.message.id, ownerMessageId)
  })
  await step('Betreiber: Body ungültig (leer / zu lang / Extra-Feld) → 400', async () => {
    for (const body of [{ body: '' }, { body: 'x'.repeat(2001) }, { body: 'ok', extra: 1 }]) {
      const res = await owner.post(`/api/app/v1/chat/conversations/${conversationId}/messages`, body)
      assert.equal(res.status, 400, res.text)
    }
  })
  await step('Betreiber read → owner_unread 0, Besucher-Nachricht readAt', async () => {
    const r = contract(C.ChatOkResponse, await owner.post(`/api/app/v1/chat/conversations/${conversationId}/read`, {}))
    assert.equal(r.conversation?.unread, 0)
    const [m] = await sql`select read_at from chat_messages where id = ${firstMessageId}`
    assert.ok(m.read_at)
  })
  await step('Besucher: Polling after → Betreiber-Antwort; eigene Nachricht hat readAt (✓✓)', async () => {
    const res = await visitor.messages(firstMessageId)
    const j = res.json as { messages: z.infer<typeof C.ChatMessage>[]; status: string; ownerLastSeenAt: string | null; ownerReadAt: string | null }
    assert.equal(j.messages.length, 1)
    assert.equal(j.messages[0].sender, 'owner')
    assert.equal(j.messages[0].clientId, null)
    assert.ok(j.ownerLastSeenAt)
    assert.ok(j.ownerReadAt, 'ownerReadAt fehlt nach dem Lesen durch den Betreiber')
    const s = await visitor.session({})
    const sj = s.json as { messages: z.infer<typeof C.ChatMessage>[]; ownerReadAt: string | null }
    const mine = sj.messages.find(m => m.id === firstMessageId)
    assert.ok(mine?.readAt, 'readAt der Besucher-Nachricht fehlt')
    assert.equal(sj.ownerReadAt, mine!.readAt)
  })
  await step('Besucher read → Betreiber-Nachricht readAt, visitor_unread 0', async () => {
    const res = await visitor.read()
    assert.equal(res.status, 200, res.text)
    const [row] = await sql`select visitor_unread from chat_conversations where id = ${conversationId}`
    assert.equal(row.visitor_unread, 0)
    const r = contract(C.ChatMessagesResponse, await owner.get(`/api/app/v1/chat/conversations/${conversationId}/messages?after=${firstMessageId}`))
    assert.equal(r.messages.length, 1)
    assert.ok(r.messages[0].readAt)
    assert.equal(r.conversation.id, conversationId)
  })
  await step('Betreiber: before=<id> liefert Verlauf', async () => {
    const r = contract(C.ChatMessagesResponse, await owner.get(`/api/app/v1/chat/conversations/${conversationId}/messages?before=${ownerMessageId}`))
    assert.equal(r.messages.length, 1)
    assert.equal(r.messages[0].id, firstMessageId)
  })

  console.log('▶ Profil')
  await step('profile: Name/E-Mail/Telefon → notifyByEmail automatisch an', async () => {
    const res = await visitor.profile({ name: 'Anna Beispiel', email: 'Anna@Example.invalid', phone: '+49 151 2345678' })
    assert.equal(res.status, 200, res.text)
    const { visitor: v } = res.json as { visitor: { name: string; email: string; phone: string; notifyByEmail: boolean } }
    assert.equal(v.name, 'Anna Beispiel')
    assert.equal(v.email, 'anna@example.invalid')
    assert.equal(v.phone, '+49 151 2345678')
    assert.equal(v.notifyByEmail, true)
  })
  await step('profile: ungültige E-Mail / Telefon → 422', async () => {
    const a = await visitor.profile({ email: 'keine-mail' })
    assert.equal(a.status, 422, a.text)
    const b = await visitor.profile({ phone: 'abc' })
    assert.equal(b.status, 422, b.text)
    const c = await visitor.profile({ phone: '+49 151 2345678 9999999999999999999' })
    assert.equal(c.status, 422, c.text)
  })
  await step('profile: notifyByEmail aus / ohne E-Mail nie an', async () => {
    const a = await visitor.profile({ notifyByEmail: false })
    assert.equal((a.json as { visitor: { notifyByEmail: boolean } }).visitor.notifyByEmail, false)
    const b = await visitor.profile({ email: '', notifyByEmail: true })
    assert.equal((b.json as { visitor: { notifyByEmail: boolean; email: null } }).visitor.notifyByEmail, false)
    const c = await visitor.profile({ email: 'anna@example.invalid', notifyByEmail: true })
    assert.equal((c.json as { visitor: { notifyByEmail: boolean } }).visitor.notifyByEmail, true)
  })
  await step('Liste zeigt Name, Initialen, wa.me-Link', async () => {
    const list = contract(C.ChatConversationsResponse, await owner.get('/api/app/v1/chat/conversations?q=Anna'))
    assert.equal(list.conversations.length, 1)
    const v = list.conversations[0].visitor
    assert.equal(v.displayName, 'Anna Beispiel')
    assert.equal(v.initials, 'AB')
    assert.equal(v.whatsappUrl, 'https://wa.me/491512345678')
    const none = contract(C.ChatConversationsResponse, await owner.get('/api/app/v1/chat/conversations?q=gibtsnicht'))
    assert.equal(none.conversations.length, 0)
  })

  console.log('▶ Antwort-Mail + Resume-Link')
  await step('Antwort-Mail nur wenn Besucher ≥ 2 min offline: online → keine Mail', async () => {
    const before = (await sql`select count(*)::int as n from email_logs where type = 'chat_reply'`)[0].n
    await sleep(1600)
    contract(C.SendChatMessageResponse, await owner.post(`/api/app/v1/chat/conversations/${conversationId}/messages`, { body: 'Noch eine Antwort, du bist ja online.' }))
    await sleep(800)
    const after = (await sql`select count(*)::int as n from email_logs where type = 'chat_reply'`)[0].n
    assert.equal(after, before)
    const [row] = await sql`select visitor_notified_at from chat_conversations where id = ${conversationId}`
    assert.equal(row.visitor_notified_at, null)
  })
  await step('Besucher 3 min offline → Antwort-Mail (email_logs chat_reply) + Resume-Token + Drossel', async () => {
    await sql`update chat_conversations set visitor_last_seen_at = now() - interval '3 minutes' where id = ${conversationId}`
    const before = (await sql`select count(*)::int as n from email_logs where type = 'chat_reply'`)[0].n
    await sleep(1600)
    contract(C.SendChatMessageResponse, await owner.post(`/api/app/v1/chat/conversations/${conversationId}/messages`, { body: 'Bist du noch da? Ich habe dir geantwortet.' }))
    for (let i = 0; i < 20; i++) {
      const n = (await sql`select count(*)::int as n from email_logs where type = 'chat_reply'`)[0].n
      if (n > before) break
      await sleep(250)
    }
    const logs = await sql`select "to", subject, status, category from email_logs where type = 'chat_reply' order by sent_at desc limit 1`
    assert.equal(logs.length, 1)
    assert.equal(logs[0].to, 'anna@example.invalid')
    assert.equal(logs[0].category, 'system')
    assert.match(String(logs[0].subject), /hat dir geantwortet$/)
    const [{ n: tokens }] = await sql`select count(*)::int as n from chat_resume_tokens where conversation_id = ${conversationId} and used_at is null`
    assert.equal(tokens, 1)
    const [row] = await sql`select visitor_notified_at from chat_conversations where id = ${conversationId}`
    assert.ok(row.visitor_notified_at)
    // Drossel: zweite Antwort kurz danach → keine zweite Mail
    await sql`update chat_conversations set visitor_last_seen_at = now() - interval '3 minutes' where id = ${conversationId}`
    await sleep(1600)
    contract(C.SendChatMessageResponse, await owner.post(`/api/app/v1/chat/conversations/${conversationId}/messages`, { body: 'Und noch etwas.' }))
    await sleep(800)
    const n2 = (await sql`select count(*)::int as n from email_logs where type = 'chat_reply'`)[0].n
    assert.equal(n2, before + 1)
  })

  const token2 = newToken()
  const visitor2 = new Visitor(site.id, host, token2)
  let rawResume = ''
  await step('Resume-Token (anderes Gerät) übernimmt das Gespräch, einmalig', async () => {
    // Der Link in der Mail trägt den Klartext – in der DB liegt nur der Hash. Für den Test einen eigenen anlegen.
    rawResume = randomBytes(32).toString('base64url')
    await sql`insert into chat_resume_tokens (token_hash, conversation_id, expires_at) values (${sha256(rawResume)}, ${conversationId}, now() + interval '30 days')`
    const res = await visitor2.session({ visitorToken: token2, resumeToken: rawResume })
    assert.equal(res.status, 200, res.text)
    const j = res.json as { conversationId: string; messages: unknown[]; visitor: { name: string } }
    assert.equal(j.conversationId, conversationId)
    assert.equal(j.visitor.name, 'Anna Beispiel')
    assert.ok(j.messages.length >= 4)
    // Ursprünglicher Token bleibt, der neue kommt als Alias dazu (beide Browser behalten den Zugang)
    const [row] = await sql`select visitor_token_hash from chat_conversations where id = ${conversationId}`
    assert.equal(row.visitor_token_hash, sha256(token1))
    const [alias] = await sql`select conversation_id from chat_visitor_tokens where token_hash = ${sha256(token2)}`
    assert.equal(alias?.conversation_id, conversationId)
    const [t] = await sql`select used_at, kind from chat_resume_tokens where token_hash = ${sha256(rawResume)}`
    assert.ok(t.used_at)
    assert.equal(t.kind, 'reply')
    const old = await visitor.session({})
    assert.equal((old.json as { conversationId: string | null }).conversationId, conversationId)
    // Link ein zweites Mal im selben Browser: verbraucht, aber der Browser kennt das Gespräch → 200
    const again = await visitor2.session({ visitorToken: token2, resumeToken: rawResume })
    assert.equal(again.status, 200, again.text)
    assert.equal((again.json as { conversationId: string }).conversationId, conversationId)
    const fresh = await visitor2.messages()
    assert.ok((fresh.json as { messages: unknown[] }).messages.length >= 4)
  })
  await step('Resume-Token ohne visitorToken → 400, verbraucht/unbekannt in fremdem Browser → 410', async () => {
    const a = await probe.session({ resumeToken: rawResume })
    assert.equal(a.status, 400)
    const stranger = newToken()
    const b = await new Visitor(site.id, host, stranger).session({ visitorToken: stranger, resumeToken: rawResume })
    assert.equal(b.status, 410, b.text)
    const c = await new Visitor(site.id, host, stranger).session({ visitorToken: stranger, resumeToken: randomBytes(32).toString('base64url') })
    assert.equal(c.status, 410)
  })

  console.log('▶ Übergabe zwischen Browsern (Instagram → Safari)')
  const token3 = newToken()
  const visitor3 = new Visitor(site.id, host, token3)
  await step('handoff ohne Gespräch → 404 NO_CONVERSATION, ohne Token → 400, falsches via → 400', async () => {
    const a = await visitor3.call('POST', 'handoff', { via: 'link' })
    assert.equal(a.status, 404, a.text)
    assert.equal((a.json as { error: string }).error, 'NO_CONVERSATION')
    assert.equal((await probe.call('POST', 'handoff', { via: 'link' })).status, 400)
    assert.equal((await visitor.call('POST', 'handoff', { via: 'sms' })).status, 400)
  })
  let handoffLink = ''
  await step('handoff via link → URL derselben Seite mit ?fs_chat=, Token 7 Tage, kind handoff', async () => {
    const res = await visitor.call('POST', 'handoff', { via: 'link', pageUrl: `https://${host}/angebot?x=1&fs_chat=alt#oben` })
    assert.equal(res.status, 200, res.text)
    const j = res.json as { url: string; expiresAt: string }
    const u = new URL(j.url)
    assert.equal(u.host, host)
    assert.equal(u.pathname, '/angebot')
    assert.equal(u.searchParams.get('x'), '1')
    assert.equal(u.hash, '')
    const tok = u.searchParams.get('fs_chat') ?? ''
    assert.ok(tok.length >= 32)
    handoffLink = tok
    const [t] = await sql`select kind, used_at, expires_at from chat_resume_tokens where token_hash = ${sha256(tok)}`
    assert.equal(t.kind, 'handoff')
    assert.equal(t.used_at, null)
    const days = (new Date(t.expires_at).getTime() - Date.now()) / 86_400_000
    assert.ok(days > 6.9 && days <= 7, String(days))
    assert.ok(Math.abs(new Date(j.expiresAt).getTime() - new Date(t.expires_at).getTime()) < 5000)
  })
  await step('Link in Safari einlösen → gleiches Gespräch; Instagram-Browser behält den Zugang; Alias kann schreiben', async () => {
    const res = await visitor3.session({ visitorToken: token3, resumeToken: handoffLink })
    assert.equal(res.status, 200, res.text)
    assert.equal((res.json as { conversationId: string }).conversationId, conversationId)
    const old = await visitor.session({})
    assert.equal((old.json as { conversationId: string | null }).conversationId, conversationId)
    await sleep(1600)
    const sent = await visitor3.send('Jetzt schreibe ich aus Safari weiter.')
    assert.equal(sent.status, 200, sent.text)
    assert.equal((sent.json as { message: { conversationId: string } }).message.conversationId, conversationId)
    const seen = await visitor.messages()
    assert.ok((seen.json as { messages: { body: string }[] }).messages.some(m => m.body.includes('aus Safari')))
    // Der Alias darf selbst wieder einen Übergabe-Link erzeugen
    const again = await visitor3.call('POST', 'handoff', { via: 'link', pageUrl: `https://${host}/` })
    assert.equal(again.status, 200, again.text)
    // Einmalig
    const reuse = await new Visitor(site.id, host, newToken()).session({ visitorToken: newToken(), resumeToken: handoffLink })
    assert.equal(reuse.status, 410)
  })
  await step('handoff via email: ohne E-Mail 400 NO_EMAIL; mit E-Mail → email_logs chat_handoff; 4. Mail/Tag → 429', async () => {
    const saved = await sql`select visitor_email from chat_conversations where id = ${conversationId}`
    await sql`update chat_conversations set visitor_email = null where id = ${conversationId}`
    const none = await visitor.call('POST', 'handoff', { via: 'email' })
    assert.equal(none.status, 400, none.text)
    assert.equal((none.json as { error: string }).error, 'NO_EMAIL')
    await sql`update chat_conversations set visitor_email = ${saved[0].visitor_email} where id = ${conversationId}`
    const before = (await sql`select count(*)::int as n from email_logs where type = 'chat_handoff'`)[0].n
    for (let i = 0; i < 3; i++) {
      const r = await visitor.call('POST', 'handoff', { via: 'email', pageUrl: `https://${host}/` })
      // Lokal ist Resend ein Dummy → 502 MAIL_FAILED, der Eintrag in email_logs entsteht trotzdem
      assert.ok(r.status === 200 || r.status === 502, r.text)
    }
    for (let i = 0; i < 20; i++) {
      const n = (await sql`select count(*)::int as n from email_logs where type = 'chat_handoff'`)[0].n
      if (n >= before + 3) break
      await sleep(200)
    }
    const logs = await sql`select "to", subject, category from email_logs where type = 'chat_handoff' order by sent_at desc limit 3`
    assert.equal(logs.length, 3)
    assert.equal(logs[0].to, 'anna@example.invalid')
    assert.equal(logs[0].category, 'system')
    assert.match(String(logs[0].subject), /^Dein Chat mit /)
    const [{ n: mails }] = await sql`select count(*)::int as n from chat_resume_tokens where conversation_id = ${conversationId} and kind = 'handoff_mail'`
    assert.equal(mails, 3)
    const fourth = await visitor.call('POST', 'handoff', { via: 'email' })
    assert.equal(fourth.status, 429, fourth.text)
  })

  console.log('▶ Filter + Ratenbegrenzung')
  const v = visitor2
  await step('Beleidigung (Besucher) → 422 MESSAGE_REJECTED mit neutraler Meldung', async () => {
    await sleep(1600)
    const res = await v.send('Du Hurensohn, antworte endlich!')
    assert.equal(res.status, 422, res.text)
    const j = res.json as { error: string; message: string }
    assert.equal(j.error, 'MESSAGE_REJECTED')
    assert.equal(j.message, 'Diese Nachricht kann nicht gesendet werden.')
  })
  await step('Drohung (Englisch) + zu viele Links → 422', async () => {
    const a = await v.send("I will kill you if you don't answer")
    assert.equal(a.status, 422, a.text)
    const b = await v.send('Schau mal: https://a.de https://b.de https://c.de https://d.de')
    assert.equal(b.status, 422, b.text)
  })
  await step('Beleidigung (Betreiber) → 422 VALIDATION_FAILED', async () => {
    const res = await owner.post(`/api/app/v1/chat/conversations/${conversationId}/messages`, { body: 'Verpiss dich.' })
    assert.equal(res.status, 422, res.text)
    assert.equal((res.json as { code: string }).code, 'VALIDATION_FAILED')
  })
  await step('zu schnell (< 1,5 s) → 429 RATE_LIMITED', async () => {
    await sleep(1600)
    const a = await v.send('Erste Nachricht in schneller Folge')
    assert.equal(a.status, 200, a.text)
    const b = await v.send('Zweite Nachricht in schneller Folge')
    assert.equal(b.status, 429, b.text)
    assert.equal((b.json as { error: string }).error, 'RATE_LIMITED')
  })
  await step('Wiederholung: dieselbe Nachricht 3× hintereinander → 422', async () => {
    await sleep(1600)
    assert.equal((await v.send('Hallo?')).status, 200)
    await sleep(1600)
    assert.equal((await v.send('Hallo?')).status, 200)
    await sleep(1600)
    const c = await v.send('hallo!')
    assert.equal(c.status, 422, c.text)
  })
  await step('20 Nachrichten in 10 min → die 21. ist 429', async () => {
    const [{ n }] = await sql`select count(*)::int as n from chat_messages where conversation_id = ${conversationId} and sender = 'visitor' and created_at > now() - interval '10 minutes'`
    const fill = Math.max(0, 19 - Number(n))
    for (let i = 0; i < fill; i++) {
      await sql`insert into chat_messages (conversation_id, sender, body, created_at) values (${conversationId}, 'visitor', ${'Füllnachricht ' + i}, now() - interval '5 minutes' + (${i} || ' seconds')::interval)`
    }
    await sleep(1600)
    const ok20 = await v.send('Nachricht Nummer zwanzig')
    assert.equal(ok20.status, 200, ok20.text)
    await sleep(1600)
    const r21 = await v.send('Nachricht Nummer einundzwanzig')
    assert.equal(r21.status, 429, r21.text)
    // Fenster wieder frei machen
    await sql`delete from chat_messages where conversation_id = ${conversationId} and body like 'Füllnachricht %'`
  })

  console.log('▶ Sperren, Melden, Archiv')
  await step('block → status blocked; Besucher überall 403 BLOCKED (config mit whatsappUrl)', async () => {
    const r = contract(C.ChatOkResponse, await owner.post(`/api/app/v1/chat/conversations/${conversationId}/block`, { reason: 'Test' }))
    assert.equal(r.conversation?.status, 'blocked')
    const [{ n }] = await sql`select count(*)::int as n from chat_blocks where user_id = ${pro.id} and visitor_token_hash = ${sha256(token2)}`
    assert.equal(n, 1)
    const cfg = await v.config()
    assert.equal(cfg.status, 403, cfg.text)
    assert.equal((cfg.json as { error: string }).error, 'BLOCKED')
    assert.ok('whatsappUrl' in (cfg.json as object))
    for (const res of [await v.session({}), await v.messages(), await v.send('bin ich gesperrt?'), await v.read(), await v.profile({ name: 'x' })]) {
      assert.equal(res.status, 403, res.text)
    }
    // Gleiche IP (die des Gesprächsbeginns), neues Token → ebenfalls gesperrt
    const sameIp = new Visitor(site.id, host, newToken(), visitor.ipHash)
    assert.equal((await sameIp.send('neuer Browser, gleiche IP')).status, 403)
    // Liste: open leer, blocked 1
    assert.equal(contract(C.ChatConversationsResponse, await owner.get('/api/app/v1/chat/conversations')).conversations.length, 0)
    assert.equal(contract(C.ChatConversationsResponse, await owner.get('/api/app/v1/chat/conversations?status=blocked')).conversations.length, 1)
  })
  await step('Betreiber kann an Gesperrte nicht senden (422), archive gesperrt (400)', async () => {
    assert.equal((await owner.post(`/api/app/v1/chat/conversations/${conversationId}/messages`, { body: 'Hallo?' })).status, 422)
    assert.equal((await owner.post(`/api/app/v1/chat/conversations/${conversationId}/archive`, {})).status, 400)
  })
  await step('unblock → open, Besucher wieder frei', async () => {
    const r = contract(C.ChatOkResponse, await owner.post(`/api/app/v1/chat/conversations/${conversationId}/unblock`, {}))
    assert.equal(r.conversation?.status, 'open')
    const [{ n }] = await sql`select count(*)::int as n from chat_blocks where user_id = ${pro.id}`
    assert.equal(n, 0)
    assert.equal((await v.config()).status, 200)
  })
  await step('report (spam, block) → reported_at, Mail chat_report, gesperrt', async () => {
    const before = (await sql`select count(*)::int as n from email_logs where type = 'chat_report'`)[0].n
    const r = contract(C.ChatOkResponse, await owner.post(`/api/app/v1/chat/conversations/${conversationId}/report`, { reason: 'spam', note: 'Werbung für Fremdprodukte' }))
    assert.equal(r.conversation?.status, 'blocked')
    assert.ok(r.conversation?.reportedAt)
    const [row] = await sql`select report_reason from chat_conversations where id = ${conversationId}`
    assert.match(String(row.report_reason), /^spam: Werbung/)
    for (let i = 0; i < 20; i++) {
      if ((await sql`select count(*)::int as n from email_logs where type = 'chat_report'`)[0].n > before) break
      await sleep(250)
    }
    const [log] = await sql`select "to", subject from email_logs where type = 'chat_report' order by sent_at desc limit 1`
    assert.ok(log, 'Melde-Mail nicht ausgelöst')
    assert.equal(log.subject, 'Chat gemeldet: Spam oder Werbung')
  })
  await step('report: ungültiger Grund → 400', async () => {
    assert.equal((await owner.post(`/api/app/v1/chat/conversations/${conversationId}/report`, { reason: 'egal' })).status, 400)
  })
  await step('Admin: settings GET/PUT + reports (nur Admin)', async () => {
    assert.equal((await owner.get('/api/admin/chat/reports')).status, 401, 'Nicht-Admin muss 401 bekommen')
    await admin.signIn(ADMIN_EMAIL)
    const s = await admin.get('/api/admin/chat/settings')
    assert.equal(s.status, 200, s.text)
    const sj = s.json as { enabled: boolean; usernames: string[] }
    assert.equal(sj.enabled, true)
    assert.deepEqual(sj.usernames, [pro.username])
    const put = await admin.put('/api/admin/chat/settings', { usernames: `${pro.username}, demo, Unbekannt_xyz` })
    assert.equal(put.status, 200, put.text)
    const pj = put.json as { usernames: string[]; unknownUsernames: string[] }
    assert.deepEqual(pj.usernames, [pro.username, 'demo', 'unbekannt_xyz'])
    assert.deepEqual(pj.unknownUsernames, ['unbekannt_xyz'])
    assert.equal((await sql`select value from app_settings where key = 'visitor_chat_users'`)[0].value, `${pro.username},demo,unbekannt_xyz`)
    await admin.put('/api/admin/chat/settings', { usernames: [pro.username] })
    const rep = await admin.get('/api/admin/chat/reports')
    assert.equal(rep.status, 200, rep.text)
    const rj = rep.json as { reports: { conversation: { id: string }; account: { username: string }; messages: unknown[]; reportReason: string }[] }
    const mine = rj.reports.find(r => r.conversation.id === conversationId)
    assert.ok(mine, 'gemeldetes Gespräch fehlt im Admin')
    assert.equal(mine.account.username, pro.username)
    assert.ok(mine.messages.length > 0 && mine.messages.length <= 20)
  })
  await step('unblock → archive → Liste archived; neue Besucher-Nachricht öffnet wieder', async () => {
    contract(C.ChatOkResponse, await owner.post(`/api/app/v1/chat/conversations/${conversationId}/unblock`, {}))
    const a = contract(C.ChatOkResponse, await owner.post(`/api/app/v1/chat/conversations/${conversationId}/archive`, {}))
    assert.equal(a.conversation?.status, 'archived')
    assert.equal(contract(C.ChatConversationsResponse, await owner.get('/api/app/v1/chat/conversations?status=archived')).conversations.length, 1)
    assert.equal(contract(C.ChatConversationsResponse, await owner.get('/api/app/v1/chat/conversations')).conversations.length, 0)
    await sleep(1600)
    const res = await v.send('Ich habe noch eine Frage.')
    assert.equal(res.status, 200, res.text)
    const [row] = await sql`select status from chat_conversations where id = ${conversationId}`
    assert.equal(row.status, 'open')
  })
  await step('archive → unarchive → open', async () => {
    contract(C.ChatOkResponse, await owner.post(`/api/app/v1/chat/conversations/${conversationId}/archive`, {}))
    const u = contract(C.ChatOkResponse, await owner.post(`/api/app/v1/chat/conversations/${conversationId}/unarchive`, {}))
    assert.equal(u.conversation?.status, 'open')
  })
  await step('Cursor-Paginierung mit zweitem Gespräch', async () => {
    const other = new Visitor(site.id, host, newToken())
    const res = await other.send('Zweites Gespräch')
    assert.equal(res.status, 200, res.text)
    const p1 = contract(C.ChatConversationsResponse, await owner.get('/api/app/v1/chat/conversations?limit=1'))
    assert.equal(p1.conversations.length, 1)
    assert.ok(p1.nextCursor)
    const p2 = contract(C.ChatConversationsResponse, await owner.get(`/api/app/v1/chat/conversations?limit=1&cursor=${encodeURIComponent(p1.nextCursor!)}`))
    assert.equal(p2.conversations.length, 1)
    assert.notEqual(p2.conversations[0].id, p1.conversations[0].id)
    assert.equal(p2.nextCursor, null)
    const u = contract(C.ChatUnreadResponse, await owner.get('/api/app/v1/chat/unread'))
    assert.equal(u.conversations, 2)
  })

  console.log('▶ Löschen + Cron')
  await step('delete → ok, danach 404, Nachrichten weg', async () => {
    contract(C.ChatOkResponse, await owner.del(`/api/app/v1/chat/conversations/${conversationId}`))
    assert.equal((await owner.get(`/api/app/v1/chat/conversations/${conversationId}`)).status, 404)
    const [{ n }] = await sql`select count(*)::int as n from chat_messages where conversation_id = ${conversationId}`
    assert.equal(n, 0)
    const [{ t }] = await sql`select count(*)::int as t from chat_resume_tokens where conversation_id = ${conversationId}`
    assert.equal(t, 0)
    // Besucher sieht wieder „kein Gespräch“
    assert.equal((await v.session({})).status, 200)
    assert.equal(((await v.session({})).json as { conversationId: string | null }).conversationId, null)
  })
  await step('Cron chat-cleanup: ohne Secret 401, mit Secret räumt alte Daten', async () => {
    assert.equal((await fetch(`${BASE}/api/cron/chat-cleanup`)).status, 401)
    const stale = new Visitor(site.id, host, newToken())
    const res = await stale.send('uralt')
    assert.equal(res.status, 200, res.text)
    const staleId = (res.json as { message: { conversationId: string } }).message.conversationId
    await sql`update chat_conversations set last_message_at = now() - interval '181 days', created_at = now() - interval '200 days' where id = ${staleId}`
    await sql`insert into chat_resume_tokens (token_hash, conversation_id, expires_at) values (${sha256('abgelaufen-' + staleId)}, ${staleId}, now() - interval '1 day')`
    await sql`insert into chat_blocks (user_id, visitor_token_hash, created_at) values (${pro.id}, ${sha256('alt')}, now() - interval '400 days')`
    const r = await fetch(`${BASE}/api/cron/chat-cleanup`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } })
    assert.equal(r.status, 200)
    const j = await r.json() as { ok: boolean; conversations: number; blocks: number }
    assert.equal(j.ok, true)
    assert.ok(j.conversations >= 1 && j.blocks >= 1, JSON.stringify(j))
    assert.equal((await sql`select count(*)::int as n from chat_conversations where id = ${staleId}`)[0].n, 0)
  })

  // Aufräumen + Schalter zurück
  await sql`delete from chat_conversations where user_id = ${pro.id}`
  await sql`delete from chat_blocks where user_id = ${pro.id}`
  for (const key of ['visitor_chat_enabled', 'visitor_chat_users']) {
    if (previous[key] !== undefined) await setSetting(key, previous[key])
    else await sql`delete from app_settings where key = ${key}`
  }

  console.log(`\n${passed}/${passed + failed} ok${failed ? ` – fehlgeschlagen: ${failures.join(', ')}` : ''}`)
  await sql.end()
  process.exit(failed ? 1 : 0)
}

main().catch(async (err) => {
  console.error(err)
  await sql.end().catch(() => {})
  process.exit(1)
})
