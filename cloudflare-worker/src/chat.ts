/**
 * Besucher-Chat (Seitenbesucher ↔ Seitenbetreiber) auf Kundenseiten.
 * Konzept: docs/chat/konzept.md
 *
 *  - handleChatRequest(): nimmt `/.finestsites/chat/*` same-origin vom Widget entgegen und
 *    reicht an `${APP_URL}/api/worker/chat/<name>` weiter. Der Worker setzt die Kopfzeilen
 *    (Secret, Seite, Host, IP-Hash, UA, Besucher-Token) – die echte IP verlässt den Worker nie.
 *    `widget.js` holt das Skript aus `public/chat-widget/v1.js` der App und hält es 5 min im Cache.
 *  - injectChatWidget(): hängt das Widget-Skript ans HTML (nur wenn `meta.chat.enabled`).
 *  - chatPrivacySectionDe/En(): Abschnitt „Chat“ für die Datenschutzseite.
 */
import type { Env, SiteMeta } from './index'
import { hashIP } from './index'

// ─── Proxy ────────────────────────────────────────────────────────────────────

const CHAT_PREFIX = '/.finestsites/chat/'
/** Erlaubte Endpunkte (Name → zulässige Methoden). */
const ENDPOINTS: Record<string, ReadonlySet<string>> = {
  config: new Set(['GET']),
  session: new Set(['POST']),
  messages: new Set(['GET', 'POST']),
  read: new Set(['POST']),
  profile: new Set(['POST']),
  handoff: new Set(['POST']),
}
const MAX_BODY_BYTES = 16 * 1024
const WIDGET_CACHE_SECONDS = 300

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

export function chatJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

export async function handleChatRequest(request: Request, pathname: string, meta: SiteMeta, env: Env, hostname: string): Promise<Response> {
  if (!meta.chat?.enabled) return chatJson(404, { error: 'NOT_FOUND' })
  const name = pathname.slice(CHAT_PREFIX.length).replace(/\/+$/, '')

  if (name === 'widget.js') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return chatJson(405, { error: 'METHOD_NOT_ALLOWED' })
    return serveWidget(request, env)
  }

  const allowed = ENDPOINTS[name]
  if (!allowed) return chatJson(404, { error: 'NOT_FOUND' })
  if (request.method !== 'GET' && request.method !== 'POST') return chatJson(405, { error: 'METHOD_NOT_ALLOWED' })
  if (!allowed.has(request.method)) return chatJson(405, { error: 'METHOD_NOT_ALLOWED' })

  let body: string | undefined
  if (request.method === 'POST') {
    const declared = parseInt(request.headers.get('content-length') ?? '0', 10)
    if (declared > MAX_BODY_BYTES) return chatJson(413, { error: 'PAYLOAD_TOO_LARGE' })
    body = await request.text().catch(() => '')
    if (body.length > MAX_BODY_BYTES) return chatJson(413, { error: 'PAYLOAD_TOO_LARGE' })
  }

  const ip = request.headers.get('cf-connecting-ip') ?? ''
  const ua = (request.headers.get('user-agent') ?? '').slice(0, 200)
  const visitor = (request.headers.get('x-fs-visitor') ?? '').trim().slice(0, 128)
  const ticket = (request.headers.get('x-fs-ticket') ?? '').trim().slice(0, 400)
  const search = new URL(request.url).search

  const headers: Record<string, string> = {
    'x-worker-secret': env.WORKER_SECRET,
    'x-fs-site-id': meta.siteId,
    'x-fs-host': hostname,
    'x-fs-ip-hash': ip ? await hashIP(ip) : '',
    'x-fs-ua': ua,
    'x-fs-visitor': visitor,
    'x-fs-ticket': ticket,
    Accept: 'application/json',
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  try {
    const upstream = await fetch(`${env.APP_URL}/api/worker/chat/${name}${search}`, {
      method: request.method,
      headers,
      body,
    })
    const text = await upstream.text()
    // Antwort 1:1 (Status + JSON-Körper); kein JSON vom App-Server → als Fehler behandeln
    return new Response(text || '{}', { status: upstream.status, headers: JSON_HEADERS })
  } catch (err) {
    console.error('chat proxy error:', err)
    return chatJson(503, { error: 'unavailable' })
  }
}

/** Widget-Skript aus der App (`public/chat-widget/v1.js`), 5 min im Edge-Cache. */
async function serveWidget(request: Request, env: Env): Promise<Response> {
  const cache = caches.default
  // Cache-Schlüssel ohne Host: ein Skript für alle Kundenseiten
  const cacheKey = new Request(`${env.APP_URL}/chat-widget/v1.js`, { method: 'GET' })
  const hit = await cache.match(cacheKey).catch(() => undefined)
  if (hit) return request.method === 'HEAD' ? new Response(null, hit) : hit

  try {
    const upstream = await fetch(cacheKey)
    if (!upstream.ok) throw new Error(`widget upstream ${upstream.status}`)
    const js = await upstream.text()
    const res = new Response(js, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': `public, max-age=${WIDGET_CACHE_SECONDS}`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
    await cache.put(cacheKey, res.clone()).catch(() => {})
    return request.method === 'HEAD' ? new Response(null, res) : res
  } catch (err) {
    console.error('chat widget fetch error:', err)
    return new Response('/* chat widget unavailable */', {
      status: 503,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
}

// ─── Script-Tag fürs HTML ─────────────────────────────────────────────────────

const MARK = 'data-fs-chat'
const SCRIPT_TAG = `<script ${MARK} src="/.finestsites/chat/widget.js" defer></script>`

/** Rechtsseiten bekommen kein Widget (Konzept: /impressum, /datenschutz). */
export function shouldInjectChat(pathname: string, meta: SiteMeta): boolean {
  if (!meta.chat?.enabled) return false
  return pathname !== '/impressum' && pathname !== '/datenschutz'
}

export function injectChatWidget(html: string, meta: SiteMeta): string {
  if (!meta.chat?.enabled || html.includes(MARK)) return html
  return html.includes('</body>') ? html.replace('</body>', `${SCRIPT_TAG}</body>`) : html + SCRIPT_TAG
}

// ─── Datenschutz-Abschnitt ────────────────────────────────────────────────────

export function chatPrivacySectionDe(): string {
  return `<section>
<h2>Chat-Funktion</h2>
<p>Auf dieser Webseite kannst du mir über ein Chat-Fenster Nachrichten schreiben. Dabei werden deine Nachrichten, der Zeitpunkt, die aufgerufene Seite sowie – nur wenn du sie freiwillig angibst – Name, E-Mail-Adresse und Telefonnummer gespeichert. Deine IP-Adresse wird ausschließlich in gekürzter, nicht rückrechenbarer Form (Hash) zum Schutz vor Missbrauch verarbeitet. Damit du dein Gespräch beim nächsten Besuch fortsetzen kannst, speichert dein Browser eine zufällige Chat-Kennung (lokaler Speicher bzw. Cookie „fs_chat_token“, 180 Tage). Diese Speicherung ist technisch erforderlich, um die von dir ausdrücklich gewünschte Chat-Funktion bereitzustellen (§ 25 Abs. 2 Nr. 2 TDDDG); sie erfolgt erst, wenn du die erste Nachricht sendest.</p>
<p>Rechtsgrundlage der Verarbeitung ist Art. 6 Abs. 1 lit. b DSGVO (Anbahnung bzw. Durchführung eines Vertrags oder Beantwortung deiner Anfrage) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer einfachen Kontaktmöglichkeit und am Schutz vor Missbrauch). Wenn du eine E-Mail-Adresse angibst und „Antworten per E-Mail erhalten“ aktivierst, informieren wir dich per E-Mail über neue Antworten; das kannst du jederzeit über den Link in der E-Mail oder im Chat beenden.</p>
<p>Die Chat-Daten werden auf Servern von FinestSites (Hetzner Online GmbH, Deutschland) im Rahmen einer Auftragsverarbeitung gespeichert und 180 Tage nach der letzten Nachricht automatisch gelöscht; auf Wunsch lösche ich dein Gespräch auch früher. Für WhatsApp gilt der Abschnitt „WhatsApp“.</p>
</section>`
}

export function chatPrivacySectionEn(): string {
  return `<section>
<h2>Chat</h2>
<p>You can send me messages through the chat window on this website. We store your messages, the time, the page you were on and, only if you provide them voluntarily, your name, e-mail address and phone number. Your IP address is processed only in truncated, irreversibly hashed form to prevent abuse. So you can continue your conversation on your next visit, your browser stores a random chat identifier (local storage or cookie "fs_chat_token", 180 days). This is technically necessary to provide the chat you explicitly requested (Section 25 (2) no. 2 TDDDG) and only happens once you send your first message.</p>
<p>The legal basis is Art. 6 (1) (b) GDPR (initiating or performing a contract or answering your enquiry) and Art. 6 (1) (f) GDPR (legitimate interest in an easy way to get in touch and in preventing abuse). If you provide an e-mail address and enable "receive replies by e-mail", we notify you about new replies by e-mail; you can stop this at any time via the link in the e-mail or in the chat.</p>
<p>Chat data is stored on FinestSites servers (Hetzner Online GmbH, Germany) under a data processing agreement and deleted automatically 180 days after the last message; on request I will delete your conversation earlier. For WhatsApp, see the "WhatsApp" section.</p>
</section>`
}

/**
 * Fügt den Chat-Abschnitt in einen fertigen (auch übersetzten) Datenschutz-Block ein:
 * direkt vor dem Abschnitt, der den WhatsApp-Link enthält. Fehlt der, vor „Stand: …“.
 */
export function insertChatPrivacySection(html: string, section: string): string {
  const block = `${section}\n\n<hr class="divider">\n\n`
  const anchor = html.indexOf('whatsapp.com/legal/privacy-policy-eea')
  if (anchor !== -1) {
    const start = html.lastIndexOf('<section>', anchor)
    if (start !== -1) return html.slice(0, start) + block + html.slice(start)
  }
  const foot = html.lastIndexOf('<p class="footnote">')
  if (foot !== -1) return html.slice(0, foot) + block + html.slice(foot)
  return html + '\n' + block
}
