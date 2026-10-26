/**
 * Test „Neuigkeiten“ (docs/news/spec.md) auf Dienst-Ebene gegen eine LOKALE Wegwerf-Datenbank –
 * ohne Dev-Server (die HTTP-Routen sind dünne Hüllen um src/lib/news/service.ts).
 *
 *   PGPASSWORD=finestsites_dev_local createdb -h localhost -U finestsites_dev finestsites_news_test
 *   PGPASSWORD=finestsites_dev_local pg_dump -h localhost -U finestsites_dev --schema-only --no-owner --no-acl finestsites_dev \
 *     | PGPASSWORD=finestsites_dev_local psql -q -h localhost -U finestsites_dev finestsites_news_test
 *   TEST_DATABASE_URL=postgresql://finestsites_dev:finestsites_dev_local@localhost:5432/finestsites_news_test \
 *   node --import tsx scripts/test-news.ts
 *
 * Prüft: Audience (auch „Bestimmte Nutzer“ mit Konto-Liste, Reichweite, Push), Gelesen/Ungelesen, Startkarte
 * verschwindet nach Lesen oder Wegwischen und ignoriert Neuigkeiten älter als 14 Tage, „Sichtbar bis“ (expires_at,
 * Ende des Tages Europe/Berlin) versteckt nach Ablauf, Tageslimit (Europe/Berlin), Testversand nur an eigene Geräte,
 * Push nur mit aktivem Gerät und ohne Löschanfrage, Archivieren versteckt, Löschen nur Entwurf, Nutzer mit
 * news = false bekommt durch den Drain keinen Push.
 *
 * Sicherheit: bricht ab, wenn die DB nicht lokal ist oder `finestsites`/`finestsites_dev` heißt. Push geht
 * an einen eingebauten Schein-Expo-Server auf 127.0.0.1 (PUSH_EXPO_URL) – nichts verlässt den Rechner.
 */
import postgres from 'postgres'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

// ─── Sicherheitsnetz + Umgebung (VOR dem Laden der App-Module) ───────────────
const DB_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://finestsites_dev:finestsites_dev_local@localhost:5432/finestsites_news_test'
const dbName = DB_URL.split('/').pop() ?? ''
if (!/@localhost:\d+\//.test(DB_URL) || ['finestsites', 'finestsites_dev', ''].includes(dbName)) {
  console.error('Abbruch: TEST_DATABASE_URL muss auf eine lokale Wegwerf-DB zeigen (nicht finestsites/finestsites_dev).')
  process.exit(1)
}
process.env.DATABASE_URL = DB_URL
process.env.FS_ENV = 'local'
process.env.PUSH_ENABLED = 'true'
delete process.env.EXPO_PUSH_ACCESS_TOKEN
delete process.env.PUSH_ALLOW_REAL_EXPO

// Schein-Expo: nimmt Nachrichten an, liefert je Nachricht ein ok-Ticket, merkt sich die Empfänger-Token
const received: { to: string; title: string; body: string; data: Record<string, unknown> }[] = []
const expo = http.createServer((req, res) => {
  let raw = ''
  req.on('data', c => { raw += c })
  req.on('end', () => {
    const msgs = JSON.parse(raw || '[]') as typeof received
    received.push(...msgs)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ data: msgs.map((_, i) => ({ status: 'ok', id: `ticket-${received.length}-${i}` })) }))
  })
})

const sql = postgres(DB_URL, { max: 2, onnotice: () => {} })

// App-Module werden erst in main() geladen (sie lesen DATABASE_URL/PUSH_* beim Import)
type Service = typeof import('../src/lib/news/service')
type AdminSchema = typeof import('../src/lib/news/admin-schema')
let service: Service
let NewsAdminInput: AdminSchema['NewsAdminInput']
let berlinEndOfDay: AdminSchema['berlinEndOfDay']
let isRecentEnoughForCard: typeof import('../src/lib/news/constants')['isRecentEnoughForCard']
let drainPushOutbox: typeof import('../src/lib/push/drain')['drainPushOutbox']
let resetPushEnabledCache: typeof import('../src/lib/push/config')['resetPushEnabledCache']

async function boot() {
  await new Promise<void>(r => expo.listen(0, '127.0.0.1', () => r()))
  const port = (expo.address() as AddressInfo).port
  process.env.PUSH_EXPO_URL = `http://127.0.0.1:${port}/push`
  process.env.PUSH_EXPO_RECEIPTS_URL = `http://127.0.0.1:${port}/receipts`
  service = await import('../src/lib/news/service')
  ;({ NewsAdminInput, berlinEndOfDay } = await import('../src/lib/news/admin-schema'))
  ;({ isRecentEnoughForCard } = await import('../src/lib/news/constants'))
  ;({ drainPushOutbox } = await import('../src/lib/push/drain'))
  ;({ resetPushEnabledCache } = await import('../src/lib/push/config'))
}

// ─── Mini-Testrahmen ─────────────────────────────────────────────────────────
let passed = 0, failed = 0
const failures: string[] = []
function check(name: string, cond: unknown, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✔ ${name}`) }
  else { failed++; failures.push(name); console.log(`  ✘ ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`) }
}
function section(t: string) { console.log(`\n▶ ${t}`) }
async function expectNewsError(name: string, fn: () => Promise<unknown>, code: string, status: number) {
  try { await fn(); check(name, false, 'kein Fehler') }
  catch (err) {
    const e = err as { code?: string; status?: number; message?: string }
    check(name, e.code === code && e.status === status, { code: e.code, status: e.status, message: e.message })
  }
}
async function eventually(fn: () => Promise<boolean>, ms = 5000): Promise<boolean> {
  const end = Date.now() + ms
  while (Date.now() < end) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)) }
  return fn()
}

// ─── Testdaten ───────────────────────────────────────────────────────────────
const id = (n: number) => `00000000-0000-4000-e000-${String(n).padStart(12, '0')}`
const U = {
  A: { id: id(1), plan: 'pro', devices: 2, enabled: true, news: true },        // zwei aktive Geräte
  B: { id: id(2), plan: 'starter', devices: 1, enabled: true, news: true },    // Starter
  C: { id: id(3), plan: 'pro', devices: 1, enabled: false, news: true },       // Gerät abgeschaltet
  D: { id: id(4), plan: 'pro', devices: 0, enabled: true, news: true },        // kein Gerät
  E: { id: id(5), plan: 'pro', devices: 1, enabled: true, news: false },       // Schalter „Neuigkeiten“ aus
  F: { id: id(6), plan: 'pro', devices: 1, enabled: true, news: true, deleting: true }, // Löschanfrage läuft
  ADMIN: { id: id(7), plan: 'unlimited', devices: 1, enabled: true, news: true, admin: true },
  ADMIN2: { id: id(8), plan: 'unlimited', devices: 0, enabled: true, news: true, admin: true },
} as const
type Key = keyof typeof U
const ALL = Object.values(U).map(u => u.id)
const token = (k: Key, i: number) => `ExponentPushToken[newstest-${k}-${i}]`
const ctx = (k: Key) => ({ plan: U[k].plan })

async function cleanup() {
  await sql`DELETE FROM news_posts`
  await sql`DELETE FROM users WHERE id = ANY(${ALL}::uuid[]) OR email LIKE 'newstest-%@example.invalid'`
}

async function seed() {
  const now = new Date()
  await sql`INSERT INTO app_settings (key, value) VALUES ('push_enabled', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'`
  for (const [k, u] of Object.entries(U) as [Key, (typeof U)[Key]][]) {
    await sql`INSERT INTO users (id, email, username, name, plan, is_admin, email_verified, deletion_requested_at, created_at, updated_at)
              VALUES (${u.id}::uuid, ${`newstest-${k.toLowerCase()}@example.invalid`}, ${`newstest-${k.toLowerCase()}`}, ${'Test ' + k}, ${u.plan},
                      ${'admin' in u && u.admin}, true, ${'deleting' in u && u.deleting ? now : null}, ${now}, ${now})`
    for (let i = 0; i < u.devices; i++) {
      await sql`INSERT INTO push_devices (user_id, expo_token, platform, enabled, disabled_reason)
                VALUES (${u.id}::uuid, ${token(k, i)}, 'ios', ${u.enabled}, ${u.enabled ? null : 'user'})`
    }
    // Nachtruhe aus, damit der Drain zu jeder Tageszeit gleich entscheidet
    await sql`INSERT INTO notification_preferences (user_id, news, quiet_hours_enabled) VALUES (${u.id}::uuid, ${u.news}, false)`
  }
}

const baseInput = (over: Record<string, unknown> = {}) => NewsAdminInput.parse({
  title: 'Neu: Besucher-Chat für deine Webseite',
  pushTitle: 'Neu: Besucher-Chat',
  pushBody: 'Besucher schreiben dir direkt auf deiner Webseite – du antwortest in der App.',
  body: 'Ab heute können Besucher dir direkt schreiben.\n\n- Antworten in Web und App\n- Übergabe an WhatsApp möglich\n\nViel Spaß damit!',
  ctaLabel: 'Chats ansehen',
  ctaKind: 'chats',
  audience: 'all',
  ...over,
})

const outbox = (where: ReturnType<typeof sql>) => sql<{ user_id: string; status: string; skip_reason: string | null; collapse_key: string | null; category: string; data: Record<string, unknown> }[]>`
  SELECT user_id, status, skip_reason, collapse_key, category, data FROM push_outbox WHERE ${where} ORDER BY created_at`

// ─── Ablauf ──────────────────────────────────────────────────────────────────
async function main() {
  await boot()
  await cleanup()
  await seed()
  resetPushEnabledCache()

  section('Eingabe-Prüfung (NewsAdminInput)')
  {
    const ok = baseInput()
    check('gültige Eingabe: Knopf chats ohne URL', ok.ctaKind === 'chats' && ok.ctaUrl === null && ok.audience === 'all')
    const noUrl = NewsAdminInput.safeParse({ ...baseInput(), ctaKind: 'url', ctaUrl: null })
    check('url-Knopf ohne Link → Fehler bei ctaUrl', !noUrl.success && noUrl.error.issues.some(i => i.path[0] === 'ctaUrl'))
    const httpUrl = NewsAdminInput.safeParse({ ...baseInput(), ctaKind: 'url', ctaUrl: 'http://finestsites.io/x' })
    check('url-Knopf mit http:// → Fehler', !httpUrl.success)
    const httpsUrl = NewsAdminInput.safeParse({ ...baseInput(), ctaKind: 'url', ctaUrl: 'https://finestsites.io/changelog' })
    check('url-Knopf mit https:// → gültig', httpsUrl.success && httpsUrl.data.ctaUrl === 'https://finestsites.io/changelog')
    const tooLong = NewsAdminInput.safeParse({ ...baseInput(), pushBody: 'x'.repeat(171) })
    check('pushBody 171 Zeichen → Fehler mit deutscher Meldung', !tooLong.success && /höchstens 170/.test(tooLong.error.issues[0]?.message ?? ''))
    const noCta = NewsAdminInput.parse({ ...baseInput(), ctaLabel: '', ctaKind: null })
    check('leerer Knopf → cta null', noCta.ctaLabel === null && noCta.ctaKind === null && noCta.ctaUrl === null)
    const badAudience = NewsAdminInput.safeParse({ ...baseInput(), audience: 'plan:secret' })
    check('unbekannte Audience → Fehler', !badAudience.success)
    const usersEmpty = NewsAdminInput.safeParse({ ...baseInput(), audience: 'users', audienceUserIds: [] })
    check('audience users ohne Konten → Fehler bei audienceUserIds', !usersEmpty.success && usersEmpty.error.issues.some(i => i.path[0] === 'audienceUserIds'))
    const usersOk = NewsAdminInput.parse({ ...baseInput(), audience: 'users', audienceUserIds: [U.A.id, U.A.id.toUpperCase(), U.B.id] })
    check('audience users: Konten ohne Dubletten, kleingeschrieben', JSON.stringify(usersOk.audienceUserIds) === JSON.stringify([U.A.id, U.B.id]), usersOk.audienceUserIds)
    const allWithIds = NewsAdminInput.parse({ ...baseInput(), audience: 'all', audienceUserIds: [U.A.id] })
    check('audience all: mitgeschickte Konten werden verworfen', allWithIds.audienceUserIds.length === 0)
    const badId = NewsAdminInput.safeParse({ ...baseInput(), audience: 'users', audienceUserIds: ['nicht-uuid'] })
    check('ungültige Konto-ID → Fehler', !badId.success)
    const tooMany = NewsAdminInput.safeParse({ ...baseInput(), audience: 'users', audienceUserIds: Array.from({ length: 201 }, (_, i) => id(1000 + i)) })
    check('mehr als 200 Konten → Fehler', !tooMany.success)
    check('expiresAt leer → null', baseInput().expiresAt === null && NewsAdminInput.parse({ ...baseInput(), expiresAt: '' }).expiresAt === null)
    const exp = NewsAdminInput.parse({ ...baseInput(), expiresAt: '2026-11-04' })
    check('expiresAt 2026-11-04 → Ende des Tages Berlin (Winter, 23:00Z)', exp.expiresAt?.toISOString() === '2026-11-04T23:00:00.000Z', exp.expiresAt)
    check('berlinEndOfDay Sommer: 2026-07-01 → 22:00Z', berlinEndOfDay('2026-07-01').toISOString() === '2026-07-01T22:00:00.000Z')
    check('berlinEndOfDay Zeitumstellung Ende: 2026-10-25 → 23:00Z', berlinEndOfDay('2026-10-25').toISOString() === '2026-10-25T23:00:00.000Z')
    check('berlinEndOfDay Zeitumstellung Anfang: 2026-03-29 → 22:00Z', berlinEndOfDay('2026-03-29').toISOString() === '2026-03-29T22:00:00.000Z')
    const badDay = NewsAdminInput.safeParse({ ...baseInput(), expiresAt: '04.11.2026' })
    check('expiresAt im falschen Format → Fehler', !badDay.success && badDay.error.issues.some(i => i.path[0] === 'expiresAt'))
  }

  section('Entwurf: unsichtbar für Nutzer')
  const p1 = await service.createDraft(baseInput(), U.ADMIN.id)
  check('Entwurf angelegt (status draft)', p1.status === 'draft' && p1.publishedAt === null && p1.pushSentAt === null)
  check('Entwurf nicht in Nutzerliste', (await service.listForUser(U.A.id, ctx('A'))).items.length === 0)
  check('Entwurf im Detail null', (await service.getForUser(U.A.id, p1.id, ctx('A'))) === null)
  check('Entwurf: markRead liefert null', (await service.markRead(U.A.id, p1.id, ctx('A'))) === null)
  check('Entwurf: Startkarte null, unread 0', JSON.stringify(await service.overviewFor(U.A.id, ctx('A'))) === JSON.stringify({ unread: 0, latest: null }))

  section('Reichweite (aktives Gerät + Audience + keine Löschanfrage)')
  {
    const r = await service.recipientPreview(p1.id)
    // A (2 Geräte), B, E, ADMIN → 4 Nutzer, 5 Geräte; C (aus), D (keins), F (Löschanfrage), ADMIN2 (keins) fehlen
    check('audience all: 4 Nutzer', r.users === 4, r)
    check('audience all: 5 Geräte', r.devices === 5, r)
  }

  section('Testversand nur an eigene Geräte, veröffentlicht nichts')
  {
    const t1 = await service.sendTest(p1.id, U.ADMIN.id)
    check('Admin mit Gerät: devices 1, eingereiht', t1.devices === 1 && t1.result === 'queued', t1)
    const t2 = await service.sendTest(p1.id, U.ADMIN2.id)
    check('Admin ohne Gerät: devices 0, nichts eingereiht', t2.devices === 0 && t2.result === null, t2)
    const t3 = await service.sendTest(p1.id, U.ADMIN.id)
    check('zweiter Test innerhalb 30 s: gedrosselt', t3.devices === 1 && t3.result === 'throttled', t3)
    const rows = await outbox(sql`collapse_key = 'news-test'`)
    check('genau eine Test-Zeile, nur für den Admin', rows.length === 1 && rows[0].user_id === U.ADMIN.id && rows[0].category === 'news', rows)
    check('Test-Zeile ohne Postfach-Eintrag (inbox false)', Number((await sql`SELECT count(*)::int n FROM user_notifications WHERE type = 'news'`)[0].n) === 0)
    const after = await service.getAdmin(p1.id)
    check('Test ändert weder Status noch push_sent_at', after?.status === 'draft' && after.pushSentAt === null && after.pushQueued === 0)
  }

  section('Veröffentlichen mit Push (Testversand zählt nicht fürs Tageslimit)')
  const pub1 = await service.publish(p1.id, { push: true }, U.ADMIN.id)
  check('status published, published_at + push_sent_at gesetzt', pub1.status === 'published' && !!pub1.publishedAt && !!pub1.pushSentAt)
  check('push_queued = 4 (A, B, E, ADMIN)', pub1.pushQueued === 4, pub1.pushQueued)
  {
    const rows = await outbox(sql`collapse_key = 'news'`)
    const byUser = new Set(rows.map(r => r.user_id))
    check('Outbox: genau 4 Zeilen, Kategorie news', rows.length === 4 && rows.every(r => r.category === 'news'), rows.map(r => r.user_id))
    check('Outbox: A, B, E, ADMIN dabei', ['A', 'B', 'E', 'ADMIN'].every(k => byUser.has(U[k as Key].id)))
    check('Outbox: C (Gerät aus), D (kein Gerät), F (Löschanfrage), ADMIN2 fehlen', ['C', 'D', 'F', 'ADMIN2'].every(k => !byUser.has(U[k as Key].id)))
    check('Outbox-Daten: type news, Deep-Link, newsId', rows.every(r => r.data.type === 'news' && r.data.url === `finestsites://news/${p1.id}` && r.data.newsId === p1.id), rows[0]?.data)
    check('kein Postfach-Eintrag für news (inbox false)', Number((await sql`SELECT count(*)::int n FROM user_notifications WHERE type = 'news'`)[0].n) === 0)
  }
  await expectNewsError('erneut veröffentlichen → NEWS_NOT_DRAFT 409', () => service.publish(p1.id, { push: false }, U.ADMIN.id), 'NEWS_NOT_DRAFT', 409)

  section('Drain: Schalter news = false wird übersprungen, aktive Geräte bekommen die Mitteilung')
  {
    await drainPushOutbox({ limit: 100 })
    const settled = await eventually(async () => Number((await sql`SELECT count(*)::int n FROM push_outbox WHERE status IN ('pending', 'processing')`)[0].n) === 0)
    check('alle Outbox-Zeilen abgearbeitet', settled)
    const rows = await outbox(sql`collapse_key = 'news'`)
    const row = (k: Key) => rows.find(r => r.user_id === U[k].id)
    check('E (news aus): skipped / category_off', row('E')?.status === 'skipped' && row('E')?.skip_reason === 'category_off', row('E'))
    check('A, B, ADMIN: sent', ['A', 'B', 'ADMIN'].every(k => row(k as Key)?.status === 'sent'), rows.map(r => [r.user_id, r.status, r.skip_reason]))
    // Nur die Zeilen der Veröffentlichung (der Testversand an den Admin ging zusätzlich raus – gleiche newsId)
    const newsOutboxIds = new Set((await sql`SELECT id FROM push_outbox WHERE collapse_key = 'news'`).map(r => r.id as string))
    const tokens = received.filter(m => newsOutboxIds.has(String(m.data?.outboxId))).map(m => m.to).sort()
    check('Expo erhielt genau die 4 Token von A (2), B, ADMIN', JSON.stringify(tokens) === JSON.stringify([token('A', 0), token('A', 1), token('ADMIN', 0), token('B', 0)].sort()), tokens)
    check('kein Token von E, C, F', !received.some(m => [token('E', 0), token('C', 0), token('F', 0)].includes(m.to)))
    check('Testversand an den Admin kam ebenfalls an (collapse news-test)', received.some(m => m.to === token('ADMIN', 0) && !newsOutboxIds.has(String(m.data?.outboxId))))
    check('Push-Text = pushTitle/pushBody', received.filter(m => m.data?.newsId === p1.id).every(m => m.title === 'Neu: Besucher-Chat' && m.body.startsWith('Besucher schreiben')))
  }

  section('Tageslimit: eine Veröffentlichung mit Push je Kalendertag (Europe/Berlin)')
  const p2 = await service.createDraft(baseInput({ title: 'Nur für Starter', pushTitle: 'Starter-Info', pushBody: 'Eine Info nur für Starter-Konten.', audience: 'plan:starter', ctaLabel: 'Zu den Webseiten', ctaKind: 'sites' }), U.ADMIN.id)
  await expectNewsError('zweiter Push am selben Tag → NEWS_PUSH_LIMIT 409', () => service.publish(p2.id, { push: true }, U.ADMIN.id), 'NEWS_PUSH_LIMIT', 409)
  check('Entwurf blieb nach Ablehnung Entwurf', (await service.getAdmin(p2.id))?.status === 'draft')
  const pub2 = await service.publish(p2.id, { push: false }, U.ADMIN.id)
  check('ohne Push jederzeit möglich', pub2.status === 'published' && pub2.pushSentAt === null && pub2.pushQueued === 0)
  {
    // Gestern 23:30 Berlin = anderer Kalendertag → heute ist wieder ein Push frei
    const yesterday = new Date(Date.now() - 86400_000)
    await sql`UPDATE news_posts SET push_sent_at = ${yesterday} WHERE id = ${p1.id}::uuid`
    const p3 = await service.createDraft(baseInput({ title: 'Dritte', pushTitle: 'Dritte', pushBody: 'Dritte Mitteilung.', audience: 'plan:unlimited', ctaLabel: '', ctaKind: null }), U.ADMIN.id)
    const pub3 = await service.publish(p3.id, { push: true }, U.ADMIN.id)
    check('Vortag zählt nicht: Push heute wieder möglich (nur Unlimited = ADMIN)', pub3.status === 'published' && pub3.pushQueued === 1, pub3.pushQueued)
    check('berlinDay liefert YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(service.berlinDay(new Date())))
    // 23:30 UTC = 00:30/01:30 Berlin am Folgetag → Berlin-Datum, nicht UTC-Datum
    check('berlinDay rechnet in Europe/Berlin', service.berlinDay(new Date('2026-06-30T23:30:00Z')) === '2026-07-01')
    await sql`UPDATE news_posts SET push_sent_at = ${new Date()} WHERE id = ${p1.id}::uuid`
    await service.archive(p3.id)
  }

  section('Audience')
  {
    const a = await service.listForUser(U.A.id, ctx('A'))
    const b = await service.listForUser(U.B.id, ctx('B'))
    check('Pro-Nutzer sieht nur „all“ (1 Eintrag)', a.items.length === 1 && a.items[0].id === p1.id, a.items.map(i => i.title))
    check('Starter-Nutzer sieht „all“ + „plan:starter“ (2 Einträge, neueste zuerst)', b.items.length === 2 && b.items[0].id === p2.id && b.items[1].id === p1.id, b.items.map(i => i.title))
    check('Detail der Starter-Neuigkeit für Pro: null', (await service.getForUser(U.A.id, p2.id, ctx('A'))) === null)
    check('Detail der Starter-Neuigkeit für Starter: da, cta sites', (await service.getForUser(U.B.id, p2.id, ctx('B')))?.cta?.kind === 'sites')
    check('Nutzer ohne Tarif (null) sieht nur „all“', (await service.listForUser(U.D.id, { plan: null })).items.length === 1)
    const r = await service.recipientPreview(p2.id)
    check('Reichweite plan:starter: nur B (1 Nutzer, 1 Gerät)', r.users === 1 && r.devices === 1, r)
    const item = a.items[0]
    check('NewsItem-Form: summary = pushBody, cta chats, readAt null', item.summary === 'Besucher schreiben dir direkt auf deiner Webseite – du antwortest in der App.' && item.cta?.kind === 'chats' && item.cta.url === null && item.readAt === null)
  }

  section('Gelesen / Ungelesen / Startkarte')
  {
    check('A: unread 1 vor dem Lesen', (await service.unreadCountFor(U.A.id, ctx('A'))) === 1)
    const ovBefore = await service.overviewFor(U.A.id, ctx('A'))
    check('A: Startkarte = p1', ovBefore.unread === 1 && ovBefore.latest?.id === p1.id && ovBefore.latest.summary.startsWith('Besucher'))
    const read = await service.markRead(U.A.id, p1.id, ctx('A'))
    check('markRead: readAt gesetzt, unread 0', !!read?.item.readAt && read.unreadCount === 0)
    const firstReadAt = read!.item.readAt
    await new Promise(r => setTimeout(r, 20))
    const again = await service.markRead(U.A.id, p1.id, ctx('A'))
    check('zweites markRead ändert readAt nicht', again?.item.readAt === firstReadAt)
    const ovAfter = await service.overviewFor(U.A.id, ctx('A'))
    check('A: Startkarte verschwindet nach Lesen', ovAfter.unread === 0 && ovAfter.latest === null)
    const cta = await service.markCtaClicked(U.A.id, p1.id, ctx('A'))
    check('markCtaClicked liefert Stand + unread', cta?.item.id === p1.id && cta.unreadCount === 0)
    check('cta_clicked_at gespeichert', (await sql`SELECT cta_clicked_at FROM news_reads WHERE news_id = ${p1.id}::uuid AND user_id = ${U.A.id}::uuid`)[0].cta_clicked_at !== null)

    // B: zwei ungelesene, Startkarte = neueste (p2); wegwischen → nächste (p1), unread bleibt 2
    const ovB = await service.overviewFor(U.B.id, ctx('B'))
    check('B: unread 2, Startkarte = p2 (neueste)', ovB.unread === 2 && ovB.latest?.id === p2.id, ovB)
    const dis = await service.dismiss(U.B.id, p2.id, ctx('B'))
    check('dismiss: dismissedAt gesetzt, readAt bleibt null, unread bleibt 2', !!dis?.item.dismissedAt && dis.item.readAt === null && dis.unreadCount === 2)
    const ovB2 = await service.overviewFor(U.B.id, ctx('B'))
    check('B: Startkarte nach Wegwischen = p1', ovB2.unread === 2 && ovB2.latest?.id === p1.id, ovB2)
    await service.dismiss(U.B.id, p1.id, ctx('B'))
    check('B: beide weggewischt → Startkarte null, unread 2', JSON.stringify(await service.overviewFor(U.B.id, ctx('B'))) === JSON.stringify({ unread: 2, latest: null }))
    check('Liste zeigt dismissedAt am Eintrag', (await service.listForUser(U.B.id, ctx('B'))).items.every(i => i.dismissedAt !== null))
  }

  section('Admin-Liste mit Statistik, Ändern nach Push')
  {
    const list = await service.listAdmin()
    const a1 = list.find(i => i.id === p1.id)!
    const a2 = list.find(i => i.id === p2.id)!
    check('listAdmin: 3 Einträge, neueste zuerst', list.length === 3 && list[0].status === 'archived', list.map(i => [i.title, i.status]))
    check('p1: pushQueued 4, readCount 1, ctaCount 1, dismissedCount 1', a1.pushQueued === 4 && a1.readCount === 1 && a1.ctaCount === 1 && a1.dismissedCount === 1, a1)
    check('p2: ohne Push, dismissedCount 1', a2.pushQueued === 0 && a2.pushSentAt === null && a2.dismissedCount === 1, a2)
    const upd = await service.updateDraft(p1.id, baseInput({ title: 'Geänderte Überschrift', pushTitle: 'NEUER PUSH-TITEL', pushBody: 'Neuer Push-Text.', audience: 'plan:pro' }))
    check('nach Push: title änderbar, pushTitle/pushBody/audience bleiben', upd.title === 'Geänderte Überschrift' && upd.pushTitle === 'Neu: Besucher-Chat' && upd.pushBody.startsWith('Besucher') && upd.audience === 'all', upd)
    const d = await service.createDraft(baseInput({ title: 'Entwurf' }), U.ADMIN.id)
    const upd2 = await service.updateDraft(d.id, baseInput({ title: 'Entwurf 2', pushTitle: 'Push 2', audience: 'plan:pro' }))
    check('Entwurf: alles änderbar', upd2.title === 'Entwurf 2' && upd2.pushTitle === 'Push 2' && upd2.audience === 'plan:pro')
    await service.deleteDraft(d.id)
  }

  section('Archivieren versteckt sofort')
  {
    const arch = await service.archive(p1.id)
    check('archive: status archived', arch.status === 'archived')
    check('A: Liste leer, Detail null, unread 0', (await service.listForUser(U.A.id, ctx('A'))).items.length === 0 && (await service.getForUser(U.A.id, p1.id, ctx('A'))) === null)
    const b = await service.listForUser(U.B.id, ctx('B'))
    check('B: Liste nur p2, unread 1', b.items.length === 1 && b.items[0].id === p2.id && b.unreadCount === 1, b)
    const d = await service.createDraft(baseInput({ title: 'Entwurf' }), U.ADMIN.id)
    await expectNewsError('Entwurf archivieren → NEWS_NOT_PUBLISHED 409', () => service.archive(d.id), 'NEWS_NOT_PUBLISHED', 409)
    await expectNewsError('archivierte bearbeiten → NEWS_ARCHIVED 409', () => service.updateDraft(p1.id, baseInput()), 'NEWS_ARCHIVED', 409)
    await expectNewsError('archivierte veröffentlichen → NEWS_NOT_DRAFT 409', () => service.publish(p1.id, { push: false }, U.ADMIN.id), 'NEWS_NOT_DRAFT', 409)
    await service.deleteDraft(d.id)
  }

  section('Löschen nur Entwurf')
  {
    await expectNewsError('veröffentlichte löschen → NEWS_NOT_DRAFT 409', () => service.deleteDraft(p2.id), 'NEWS_NOT_DRAFT', 409)
    await expectNewsError('archivierte löschen → NEWS_NOT_DRAFT 409', () => service.deleteDraft(p1.id), 'NEWS_NOT_DRAFT', 409)
    const d = await service.createDraft(baseInput({ title: 'Wegwerf-Entwurf' }), U.ADMIN.id)
    await service.deleteDraft(d.id)
    check('Entwurf gelöscht', (await service.getAdmin(d.id)) === null)
    await expectNewsError('unbekannte ID → NOT_FOUND 404', () => service.deleteDraft(id(999)), 'NOT_FOUND', 404)
  }

  section('Zielgruppe „Bestimmte Nutzer“ (zum Testen)')
  {
    const before = Number((await sql`SELECT count(*)::int n FROM push_outbox WHERE collapse_key = 'news'`)[0].n)
    const pu = await service.createDraft(baseInput({ title: 'Nur für Tester', pushTitle: 'Tester-Info', pushBody: 'Nur für ausgewählte Konten.', audience: 'users', audienceUserIds: [U.A.id, U.D.id] }), U.ADMIN.id)
    check('Entwurf: audience users, zwei Konten', pu.audience === 'users' && JSON.stringify(pu.audienceUserIds) === JSON.stringify([U.A.id, U.D.id]), pu.audienceUserIds)
    check('Admin-Form: audienceUsers mit E-Mail + Benutzername aufgelöst', pu.audienceUsers.length === 2 && pu.audienceUsers[0].email === 'newstest-a@example.invalid' && pu.audienceUsers[0].username === 'newstest-a' && pu.audienceUsers[1].email === 'newstest-d@example.invalid', pu.audienceUsers)
    const r = await service.recipientPreview(pu.id)
    check('Reichweite users: nur A mit Gerät (1 Nutzer, 2 Geräte; D hat keins)', r.users === 1 && r.devices === 2, r)
    check('Entwurf für A unsichtbar', (await service.listForUser(U.A.id, ctx('A'))).items.every(i => i.id !== pu.id))
    await service.publish(pu.id, { push: false }, U.ADMIN.id)
    const a = await service.listForUser(U.A.id, ctx('A'))
    check('A (in der Liste) sieht die Neuigkeit, unread 1', a.items.some(i => i.id === pu.id) && a.unreadCount === 1, a.items.map(i => i.title))
    check('D (in der Liste, ohne Gerät) sieht sie ebenfalls', (await service.getForUser(U.D.id, pu.id, ctx('D')))?.id === pu.id)
    check('B (nicht in der Liste) sieht sie nicht – Liste wie zuvor, Detail null', (await service.listForUser(U.B.id, ctx('B'))).items.every(i => i.id !== pu.id) && (await service.getForUser(U.B.id, pu.id, ctx('B'))) === null)
    check('B: markRead für fremde Tester-Neuigkeit liefert null', (await service.markRead(U.B.id, pu.id, ctx('B'))) === null)
    check('B: unread zählt sie nicht', (await service.unreadCountFor(U.B.id, ctx('B'))) === 1)
    check('audienceMatches users: A ja, B nein, ohne userId nein', service.audienceMatches('users', 'pro', U.A.id, [U.A.id]) && !service.audienceMatches('users', 'starter', U.B.id, [U.A.id]) && !service.audienceMatches('users', 'pro', null, [U.A.id]))
    check('audienceMatches Groß-/Kleinschreibung der ID egal', service.audienceMatches('users', null, U.A.id.toUpperCase(), [U.A.id]))
    const ovA = await service.overviewFor(U.A.id, ctx('A'))
    check('A: Startkarte = Tester-Neuigkeit', ovA.latest?.id === pu.id && ovA.unread === 1, ovA)
    // Veröffentlicht: Zielgruppen-Art bleibt, aber die Konto-Liste darf geändert werden – ohne neuen Push
    const keep = await service.updateDraft(pu.id, baseInput({ audience: 'plan:pro', audienceUserIds: [U.B.id] }))
    check('veröffentlicht: Wechsel der Zielgruppen-Art wird ignoriert, Konten bleiben', keep.audience === 'users' && JSON.stringify(keep.audienceUserIds) === JSON.stringify([U.A.id, U.D.id]), keep)
    const upd = await service.updateDraft(pu.id, baseInput({ audience: 'users', audienceUserIds: [U.A.id, U.B.id] }))
    check('veröffentlicht: Konto-Liste geändert (D raus, B rein)', JSON.stringify(upd.audienceUserIds) === JSON.stringify([U.A.id, U.B.id]) && upd.audienceUsers.map(u => u.username).join(',') === 'newstest-a,newstest-b', upd)
    check('B sieht sie jetzt, D nicht mehr', (await service.getForUser(U.B.id, pu.id, ctx('B')))?.id === pu.id && (await service.getForUser(U.D.id, pu.id, ctx('D'))) === null)
    const after = Number((await sql`SELECT count(*)::int n FROM push_outbox WHERE collapse_key = 'news'`)[0].n)
    check('kein zusätzlicher Push durch die Listenänderung', after === before, { before, after })
    const list = await service.listAdmin()
    check('listAdmin: audienceUsers je Eintrag aufgelöst (eine Abfrage), andere leer', list.find(i => i.id === pu.id)?.audienceUsers.length === 2 && list.filter(i => i.audience !== 'users').every(i => i.audienceUsers.length === 0 && i.audienceUserIds.length === 0))

    // Push an bestimmte Nutzer: Tageslimit freimachen, dann B (Gerät an), C (Gerät aus), F (Löschanfrage)
    await sql`UPDATE news_posts SET push_sent_at = push_sent_at - interval '1 day' WHERE push_sent_at IS NOT NULL`
    const pu2 = await service.createDraft(baseInput({ title: 'Tester-Push', pushTitle: 'Tester-Push', pushBody: 'Push nur an bestimmte Konten.', audience: 'users', audienceUserIds: [U.B.id, U.C.id, U.F.id] }), U.ADMIN.id)
    const r2 = await service.recipientPreview(pu2.id)
    check('Reichweite users [B, C, F]: nur B (1 Nutzer, 1 Gerät)', r2.users === 1 && r2.devices === 1, r2)
    const pub = await service.publish(pu2.id, { push: true }, U.ADMIN.id)
    check('Push an bestimmte Nutzer: push_queued 1', pub.pushQueued === 1 && !!pub.pushSentAt, pub.pushQueued)
    const rows = await outbox(sql`collapse_key = 'news' AND data->>'newsId' = ${pu2.id}`)
    check('Outbox: genau eine Zeile, für B', rows.length === 1 && rows[0].user_id === U.B.id, rows.map(r => r.user_id))
    check('A (nicht in der Liste) sieht Tester-Push nicht', (await service.getForUser(U.A.id, pu2.id, ctx('A'))) === null)
    await service.archive(pu2.id)
    await service.archive(pu.id)
  }

  section('Sichtbar bis (expires_at) versteckt nach Ablauf')
  {
    const pe = await service.createDraft(baseInput({ title: 'Nur bis Jahresende', expiresAt: '2030-12-31' }), U.ADMIN.id)
    check('Entwurf: expiresAt = Ende des Tages Berlin', pe.expiresAt === '2030-12-31T23:00:00.000Z', pe.expiresAt)
    await service.publish(pe.id, { push: false }, U.ADMIN.id)
    check('vor Ablauf: A sieht sie, unread 1', (await service.getForUser(U.A.id, pe.id, ctx('A')))?.id === pe.id && (await service.unreadCountFor(U.A.id, ctx('A'))) === 1)
    await sql`UPDATE news_posts SET expires_at = now() - interval '1 minute' WHERE id = ${pe.id}::uuid`
    check('nach Ablauf: Liste leer, Detail null, unread 0', (await service.listForUser(U.A.id, ctx('A'))).items.every(i => i.id !== pe.id) && (await service.getForUser(U.A.id, pe.id, ctx('A'))) === null && (await service.unreadCountFor(U.A.id, ctx('A'))) === 0)
    check('nach Ablauf: Startkarte null', (await service.overviewFor(U.A.id, ctx('A'))).latest === null)
    check('nach Ablauf: markRead null', (await service.markRead(U.A.id, pe.id, ctx('A'))) === null)
    check('Admin sieht sie weiterhin (status published, expiresAt gesetzt)', (await service.getAdmin(pe.id))?.status === 'published' && !!(await service.getAdmin(pe.id))?.expiresAt)
    const cleared = await service.updateDraft(pe.id, baseInput({ title: 'Nur bis Jahresende', expiresAt: null }))
    check('veröffentlicht: „Sichtbar bis“ entfernen → wieder sichtbar', cleared.expiresAt === null && (await service.getForUser(U.A.id, pe.id, ctx('A')))?.id === pe.id)
    const later = await service.updateDraft(pe.id, baseInput({ title: 'Nur bis Jahresend', expiresAt: '2031-06-30' }))
    check('veröffentlicht: neues Datum setzen (Sommer → 22:00Z)', later.expiresAt === '2031-06-30T22:00:00.000Z', later.expiresAt)

    section('Startkarte ignoriert Neuigkeiten älter als 14 Tage')
    const ov1 = await service.overviewFor(U.D.id, ctx('D'))
    check('D: frisch veröffentlicht → Startkarte da, unread 1', ov1.latest?.id === pe.id && ov1.unread === 1, ov1)
    await sql`UPDATE news_posts SET published_at = now() - interval '15 days' WHERE id = ${pe.id}::uuid`
    const ov2 = await service.overviewFor(U.D.id, ctx('D'))
    check('15 Tage alt: Startkarte null, unread bleibt 1, Liste zeigt sie weiter', ov2.latest === null && ov2.unread === 1 && (await service.listForUser(U.D.id, ctx('D'))).items.some(i => i.id === pe.id), ov2)
    await sql`UPDATE news_posts SET published_at = now() - interval '13 days' WHERE id = ${pe.id}::uuid`
    check('13 Tage alt: Startkarte wieder da', (await service.overviewFor(U.D.id, ctx('D'))).latest?.id === pe.id)
    check('isRecentEnoughForCard (Web-Karte): 13 Tage ja, 15 Tage nein, Müll nein', isRecentEnoughForCard(new Date(Date.now() - 13 * 86400_000).toISOString()) && !isRecentEnoughForCard(new Date(Date.now() - 15 * 86400_000).toISOString()) && !isRecentEnoughForCard('x'))
    check('NEWS_CARD_MAX_AGE_DAYS = 14', service.NEWS_CARD_MAX_AGE_DAYS === 14)
    await service.archive(pe.id)
  }

  section('Ergebnis')
  console.log(`  ${passed} bestanden, ${failed} fehlgeschlagen`)
  if (failed) console.log('  Fehlgeschlagen:\n   - ' + failures.join('\n   - '))
  if (process.env.KEEP_TEST_DATA !== '1') await cleanup()
  await sql.end()
  expo.close()
  process.exit(failed ? 1 : 0)
}

main().catch(async err => {
  console.error('Testlauf abgebrochen:', err)
  await sql.end().catch(() => {})
  expo.close()
  process.exit(1)
})
