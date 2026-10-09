import { normalizeWhatsAppNumber, rewriteSocialHrefs } from '../../src/lib/utils/social-links'
import type { PublicTrackingConfig } from '../../src/lib/tracking/types'
import {
  shouldInject, injectTracking, handleTrackingBeacon, handleNoTrack, recordEvent, sendServerEvent,
  hasMarketingConsent, isNoTrack, privacySectionDe, privacySectionEn,
} from './tracking'

/**
 * FinestSites Cloudflare Worker
 *
 * This Worker is the public-facing edge layer that serves every user-created site.
 * It runs at Cloudflare's edge globally, meaning zero cold-start latency compared
 * to a Node.js server, and it never touches the database directly.
 *
 * Architecture overview:
 *   Browser → CF Worker → KV (cache hit: return immediately)
 *                       → R2 (static assets: CSS, JS, images, fonts)
 *                       → App API (cache miss: fetch meta + data, render, cache)
 *                       → App API (form submissions: persist via PostgreSQL)
 *
 * Request routing:
 *   GET  /                          → render index.html with placeholder substitution
 *   GET  /path/to/asset.ext         → serve static asset from R2 (1-year immutable cache)
 *   GET  /some/spa-route            → same rendered HTML (client-side router takes over)
 *   POST /.finestsites/forms/{name} → accept form submission, persist, email notification
 *   POST /.finestsites/kv           → internal cache management (purge / offline)
 *   GET  /.finestsites/demo/{slug}  → serve pre-rendered admin preview from KV
 *   GET  /.finestsites/health       → liveness check
 *
 * All database reads/writes go through the FinestSites app API (APP_URL), not directly
 * to PostgreSQL. The Worker authenticates those calls with WORKER_SECRET.
 *
 * Hostname resolution:
 *   Two patterns are supported:
 *   1. Subdomain: {username}.{template-domain} (e.g. john.myevnt.io)
 *   2. Custom domain: any hostname mapped in KV under key custom:{hostname}
 *
 * Deployment:
 *   wrangler deploy --config cloudflare-worker/wrangler.toml
 */

export interface Env {
  /** R2 bucket holding all template bundles (HTML, CSS, JS, assets). */
  R2_BUCKET: R2Bucket
  /**
   * Shared secret between the Worker and the app API. The Worker sends this in
   * the x-worker-secret request header; the app validates it before responding.
   * Also used to authenticate inbound KV admin POSTs from the app.
   */
  WORKER_SECRET: string
  /** KV namespace used for site meta cache, rendered HTML cache, custom domain map, rate limiting. */
  KV_CACHE: KVNamespace
  /** Resend API key for sending form submission notification emails. */
  RESEND_API_KEY: string
  /** Sender for form notifications, e.g. 'FinestSites <anfragen@finestsites.io>' — must be a domain verified in the Resend account of RESEND_API_KEY. */
  NOTIFY_FROM?: string
  /** Base URL of the FinestSites app (e.g. https://app.finestsites.io). */
  APP_URL: string
}

// ─── Content-Type Map ─────────────────────────────────────────────────────────

const CT: Record<string, string> = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8', js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8', json: 'application/json',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject', mp4: 'video/mp4', webm: 'video/webm',
  xml: 'application/xml', txt: 'text/plain', pdf: 'application/pdf',
}

function ct(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return CT[ext] ?? 'application/octet-stream'
}

// ─── Template Engine ──────────────────────────────────────────────────────────

type Data = Record<string, string>

// ─── Template engine (depth-counting, nested loops + conditionals) ────────────
// Mirrors src/lib/utils/template-engine.ts so Worker-rendered HTML and Vercel
// preview HTML match exactly. Keep these two files in sync — any change to one
// must be ported to the other.

type Item = Record<string, string>

function htmlEscape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function evalCondition(tag: 'if' | 'unless', cond: string, data: Data, stack: Item[]): boolean {
  let key = cond
  let expected: string | null = null
  const eq = cond.indexOf('=')
  if (eq !== -1) { key = cond.substring(0, eq).trim(); expected = cond.substring(eq + 1).trim() }
  let val = ''
  if (key.startsWith('this.')) val = (stack[stack.length - 1]?.[key.substring(5)] ?? '').toString().trim()
  else if (key.startsWith('../')) val = (stack[stack.length - 2]?.[key.substring(3)] ?? '').toString().trim()
  else val = (data[key] ?? '').toString().trim()
  let result: boolean
  if (expected !== null) result = val === expected.trim()
  else result = val !== '' && val !== 'false' && val !== '0'
  if (tag === 'unless') result = !result
  return result
}

function evalConditionalBlocks(html: string, data: Data, stack: Item[]): string {
  let out = ''
  let cursor = 0
  const OPEN_RE = /\{\{#(if|unless)\s+([^}]+)\}\}/g
  while (cursor < html.length) {
    OPEN_RE.lastIndex = cursor
    const m = OPEN_RE.exec(html)
    if (!m) { out += html.substring(cursor); break }
    out += html.substring(cursor, m.index)
    const tag = m[1] as 'if' | 'unless'
    const cond = m[2].trim()
    const openLen = m[0].length
    const bodyStart = m.index + openLen
    let depth = 1, scan = bodyStart, bodyEnd = -1, closeTokenLen = 0
    while (scan < html.length && depth > 0) {
      let nextOpenPos = -1, nextOpenLen = 0
      let probe = scan
      while (probe < html.length) {
        const t = html.indexOf('{{#', probe)
        if (t === -1) break
        const slice = html.substring(t, t + 12)
        const om = slice.match(/^\{\{#(if|unless)\s/)
        if (om) {
          const tagEnd = html.indexOf('}}', t)
          if (tagEnd === -1) { probe = t + 3; continue }
          nextOpenPos = t
          nextOpenLen = tagEnd + 2 - t
          break
        }
        probe = t + 3
      }
      const ci = html.indexOf('{{/if}}', scan)
      const cu = html.indexOf('{{/unless}}', scan)
      const candidates: Array<{ pos: number; what: 'open' | 'ci' | 'cu' }> = []
      if (nextOpenPos !== -1) candidates.push({ pos: nextOpenPos, what: 'open' })
      if (ci !== -1) candidates.push({ pos: ci, what: 'ci' })
      if (cu !== -1) candidates.push({ pos: cu, what: 'cu' })
      if (candidates.length === 0) break
      candidates.sort((a, b) => a.pos - b.pos)
      const next = candidates[0]
      if (next.what === 'open') { depth++; scan = next.pos + nextOpenLen }
      else {
        depth--
        if (depth === 0) { bodyEnd = next.pos; closeTokenLen = next.what === 'ci' ? 7 : 11; break }
        scan = next.pos + (next.what === 'ci' ? 7 : 11)
      }
    }
    if (bodyEnd === -1) { out += m[0]; cursor = bodyStart; continue }
    const body = html.substring(bodyStart, bodyEnd)
    const keep = evalCondition(tag, cond, data, stack)
    if (keep) out += evalConditionalBlocks(body, data, stack)
    cursor = bodyEnd + closeTokenLen
  }
  return out
}

const OPEN_EACH_RE = /\{\{#each\s+([\w.]+)\}\}/g

function resolveArray(key: string, data: Data, stack: Item[]): Item[] {
  let raw: string | undefined
  if (key.startsWith('this.')) raw = stack[stack.length - 1]?.[key.substring(5)]
  else raw = data[key]
  if (!raw) return []
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : [] }
  catch { return [] }
}

function processLoops(html: string, data: Data, stack: Item[]): string {
  let out = ''
  let cursor = 0
  OPEN_EACH_RE.lastIndex = 0
  while (cursor < html.length) {
    OPEN_EACH_RE.lastIndex = cursor
    const m = OPEN_EACH_RE.exec(html)
    if (!m) { out += html.substring(cursor); break }
    out += html.substring(cursor, m.index)
    const key = m[1]
    const bodyStart = m.index + m[0].length
    let depth = 1, scan = bodyStart, bodyEnd = -1
    while (scan < html.length && depth > 0) {
      const nextOpen = html.indexOf('{{#each', scan)
      const nextClose = html.indexOf('{{/each}}', scan)
      if (nextClose === -1) break
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++
        const tagEnd = html.indexOf('}}', nextOpen)
        scan = tagEnd === -1 ? html.length : tagEnd + 2
      } else {
        depth--
        if (depth === 0) { bodyEnd = nextClose; break }
        scan = nextClose + 9
      }
    }
    if (bodyEnd === -1) { out += m[0]; cursor = bodyStart; continue }
    const inner = html.substring(bodyStart, bodyEnd)
    const closeEnd = bodyEnd + 9
    const items = resolveArray(key, data, stack)
    out += items.map((item, idx) => {
      const newStack = [...stack, item]
      let chunk = processLoops(inner, data, newStack)
      chunk = evalConditionalBlocks(chunk, data, newStack)
      chunk = chunk.replace(/\{\{\{this\.(\w+)\}\}\}/g, (_m, field: string) => String(item[field] ?? ''))
      chunk = chunk.replace(/\{\{this\.(\w+)\}\}/g, (_m, field: string) => htmlEscape(item[field] ?? ''))
      chunk = chunk.replace(/\{\{@index\}\}/g, String(idx + 1))
      chunk = chunk.replace(/\{\{\.\.\/(\w+)\}\}/g, (_m, field: string) => {
        const parent = stack[stack.length - 1]
        return htmlEscape(parent?.[field] ?? '')
      })
      return chunk
    }).join('')
    cursor = closeEnd
    OPEN_EACH_RE.lastIndex = cursor
  }
  return out
}

/**
 * Compute the flat DE + EN HTML for the About-me greeting. Templates render
 * `{{{about_intro_de_html}}}` / `{{{about_intro_en_html}}}` with zero
 * conditionals so the parser never has to walk deeply nested {{#unless}}.
 *
 * Storage format for user-typed intros: every word wrapped in *asterisks*
 * becomes an accent-highlighted span. Free-form text without markers falls
 * back to the last whitespace-separated token so pre-existing values still
 * look intentional.
 */
function computeAboutIntro(data: Data): { about_intro_de_html: string; about_intro_en_html: string } {
  const raw = (data.about_intro || '').trim()
  const isDuo = (data.partner_modus || '').trim() === 'duo' || (data.team_modus || '').trim() === 'team'
  const vorname = (data.vorname || '').trim() || 'Daniel'
  const vorname2 = ((data.vorname2 || '').trim() || (data.partner_vorname || '').trim())

  if (raw) {
    const html = wrapAccentMarkers(raw)
    return { about_intro_de_html: html, about_intro_en_html: html }
  }

  if (isDuo && vorname2) {
    const nameHtml = `${htmlEscape(vorname)} &amp; ${htmlEscape(vorname2)}`
    return {
      about_intro_de_html: `Hi, wir sind <span class="accent">${nameHtml}.</span>`,
      about_intro_en_html: `Hi, we're <span class="accent">${nameHtml}.</span>`,
    }
  }

  const nameHtml = `<span class="accent">${htmlEscape(vorname)}.</span>`
  return {
    about_intro_de_html: `Hi, ich bin ${nameHtml}`,
    about_intro_en_html: `Hi, I'm ${nameHtml}`,
  }
}

function wrapAccentMarkers(text: string): string {
  const escaped = htmlEscape(text)
  const marked = escaped.replace(/\*([^*\s][^*]*?)\*/g, '<span class="accent">$1</span>')
  if (marked !== escaped) return marked
  const m = escaped.match(/^(.*?)(\s+)(\S+)$/)
  if (!m) return `<span class="accent">${escaped}</span>`
  return `${m[1]}${m[2]}<span class="accent">${m[3]}</span>`
}

/**
 * Templates name the two-person mode in two ways:
 *   partner_modus=duo  + vorname2 / nachname2 / profilbild2          (Wellpreneur, cellRESET)
 *   team_modus=team    + partner_vorname / partner_nachname / partner_profilbild   (Optimalset)
 * Shared pages (legal notice, privacy) only know the first form, so the second is mirrored
 * into it. Values the template already has are never overwritten.
 */
function applyDuoAliases(data: Data): void {
  if ((data.team_modus || '').trim() !== 'team') return
  data.partner_modus = data.partner_modus || 'duo'
  data.vorname2 = data.vorname2 || data.partner_vorname || ''
  data.nachname2 = data.nachname2 || data.partner_nachname || ''
  data.profilbild2 = data.profilbild2 || data.partner_profilbild || ''
}

function render(html: string, data: Data, rawKeys: Set<string> = new Set()): string {
  applyDuoAliases(data)
  for (const key of Object.keys(data)) {
    if (/whatsapp/i.test(key) && typeof data[key] === 'string') data[key] = normalizeWhatsAppNumber(data[key])
  }
  const intros = computeAboutIntro(data)
  data.about_intro_de_html = intros.about_intro_de_html
  data.about_intro_en_html = intros.about_intro_en_html

  html = rewriteSocialHrefs(html, data)
  html = processLoops(html, data, [])
  html = evalConditionalBlocks(html, data, [])
  // {{{key}}} triple-brace raw substitution (for stored HTML, e.g. richtext)
  html = html.replace(/\{\{\{\s*([\w]+)\s*\}\}\}/g, (_m, k: string) => {
    const v = data[k]
    return v !== undefined && v !== null ? String(v) : ''
  })
  // Simple {{key}} → HTML-escaped; roh nur für Richtext-Schlüssel (…_html, …_html_en, intro, intro_en).
  // Muss mit src/lib/utils/template-engine.ts (RAW_KEY_RE) übereinstimmen.
  const simple = (chunk: string, inScript: boolean) => chunk.replace(/\{\{([^#/{}][^{}]*)\}\}/g, (_, k) => {
    const key = k.trim(); const v = data[key]
    if (v === undefined || v === null) return ''
    if (rawKeys.has(key) || RAW_KEY_RE.test(key)) return String(v)
    return inScript ? jsEscape(String(v)) : htmlEscape(String(v))
  })
  html = html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_m, open: string, body: string, close: string) => open + simple(body, true) + close)
    .split(/(<script\b[^>]*>[\s\S]*?<\/script>)/gi)
    .map((part, i) => i % 2 === 1 ? part : simple(part, false))
    .join('')
  // Safety net: drop leftover control tokens so they never leak into output
  html = html
    .replace(/\{\{\s*\/\s*(?:each|if|unless)\s*\}\}/g, '')
    .replace(/\{\{\s*#\s*(?:each|if|unless)[^}]*\}\}/g, '')
    .replace(/\{\{\s*this\.[^}]*\}\}/g, '')
  return html
}

// ─── Site Metadata Lookup ─────────────────────────────────────────────────────

export interface SiteMeta {
  siteId: string
  templateId: string
  r2BasePath: string
  /** Werbung & Tracking des Besitzers (nur IDs) — fehlt, wenn nicht eingerichtet */
  tracking?: PublicTrackingConfig
}

// In-memory copy of site meta per Worker instance (same 60 s lifetime as the KV entry).
// One page view is dozens of requests (every image needs the meta for its R2 path) —
// this answers them without touching KV or the app. It also keeps working when KV is
// unavailable (daily limit reached): without it every single asset request would call
// the app API.
const META_MEMO_MS = 60_000
const metaMemo = new Map<string, { value: SiteMeta | '__offline__'; expires: number }>()

function rememberMeta(cacheKey: string, value: SiteMeta | '__offline__'): void {
  if (metaMemo.size > 2000) metaMemo.clear()
  metaMemo.set(cacheKey, { value, expires: Date.now() + META_MEMO_MS })
}

// ─── Customer's own domain → site ─────────────────────────────────────────────
// Lookup order: this instance's memory → KV (`custom:{hostname}`) → app API (database).
// KV is only a cache: if the entry is missing or KV is unavailable, the database decides.
// Negative answers are remembered too, so ordinary template subdomains cost at most one
// extra app call per instance every few minutes.
type CustomSite = { username: string; templateDomain: string }
const CUSTOM_MEMO_MS = 5 * 60_000
const customMemo = new Map<string, { value: CustomSite | null; expires: number }>()

async function resolveCustomDomain(hostname: string, env: Env): Promise<CustomSite | null> {
  const memo = customMemo.get(hostname)
  if (memo && memo.expires > Date.now()) return memo.value
  const remember = (value: CustomSite | null, ms = CUSTOM_MEMO_MS) => {
    if (customMemo.size > 2000) customMemo.clear()
    customMemo.set(hostname, { value, expires: Date.now() + ms })
    return value
  }

  const cached = await kvGet(env, `custom:${hostname}`)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as CustomSite
      if (parsed.username && parsed.templateDomain) return remember(parsed)
    } catch { /* corrupt entry → ask the app */ }
  }

  try {
    const res = await fetch(
      `${env.APP_URL}/api/worker/custom-domain?hostname=${encodeURIComponent(hostname)}`,
      { headers: { 'x-worker-secret': env.WORKER_SECRET } },
    )
    if (res.status === 404) return remember(null)
    // App not reachable / error: don't remember for long, try again soon
    if (!res.ok) return remember(null, 20_000)
    const site = await res.json() as CustomSite
    if (!site.username || !site.templateDomain) return remember(null)
    // Best effort: put it into KV so other instances skip the app call
    await kvPut(env, `custom:${hostname}`, JSON.stringify(site))
    return remember(site)
  } catch {
    return remember(null, 20_000)
  }
}

// Returns null if the site doesn't exist, or '__offline__' if it exists but isn't published
async function getSiteMeta(username: string, domain: string, env: Env): Promise<SiteMeta | '__offline__' | null> {
  const cacheKey = `meta:${username}:${domain}`
  const memo = metaMemo.get(cacheKey)
  if (memo && memo.expires > Date.now()) return memo.value

  const cached = await kvGet(env, cacheKey)

  // Offline sentinel — site was explicitly taken offline
  if (cached === '__offline__') { rememberMeta(cacheKey, '__offline__'); return '__offline__' }

  if (cached) {
    try {
      const parsed = JSON.parse(cached) as SiteMeta
      rememberMeta(cacheKey, parsed)
      return parsed
    } catch { /* stale/corrupt cache, fall through */ }
  }

  // Fetch from the FinestSites app API (PostgreSQL-backed)
  const res = await fetch(
    `${env.APP_URL}/api/worker/site-meta?username=${encodeURIComponent(username)}&domain=${encodeURIComponent(domain)}`,
    { headers: { 'x-worker-secret': env.WORKER_SECRET } }
  )
  if (!res.ok) return null

  const meta = await res.json() as SiteMeta & { offline?: boolean }
  // Site exists but is not published (unpublished, or suspended for an open
  // payment) → cache the offline state briefly and show the offline page.
  if (meta.offline) {
    rememberMeta(cacheKey, '__offline__')
    await kvPut(env, cacheKey, '__offline__', { expirationTtl: 60 })
    return '__offline__'
  }
  if (!meta.r2BasePath) return null

  // Cache for 60 seconds so repeated requests are fast
  rememberMeta(cacheKey, meta)
  await kvPut(env, cacheKey, JSON.stringify(meta), { expirationTtl: 60 })
  return meta
}

// ─── Timing-safe string comparison (Web Crypto HMAC, CF Worker compatible) ────

async function timingSafeCompare(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode('fs-timing-key'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign('HMAC', key, enc.encode(a)),
    crypto.subtle.sign('HMAC', key, enc.encode(b)),
  ])
  const a8 = new Uint8Array(sigA), b8 = new Uint8Array(sigB)
  let diff = 0
  for (let i = 0; i < a8.length; i++) diff |= a8[i] ^ b8[i]
  return diff === 0
}

// ─── KV access (best effort) ──────────────────────────────────────────────────
// KV is only a cache here — the app API and R2 are the source of truth. KV has daily
// limits (free plan: 1,000 writes, 100,000 reads); when one is hit the operation throws
// ("KV put() limit exceeded for the day."). That must never take a customer site down:
// a failed write means "not cached", a failed read means "cache miss".

async function kvGet(env: Env, key: string): Promise<string | null> {
  try {
    return await env.KV_CACHE.get(key)
  } catch (err) {
    console.error('KV get failed (treated as cache miss):', key, err instanceof Error ? err.message : err)
    return null
  }
}

async function kvPut(env: Env, key: string, value: string, options?: KVNamespacePutOptions): Promise<void> {
  try {
    await env.KV_CACHE.put(key, value, options)
  } catch (err) {
    console.error('KV put failed (continuing uncached):', key, err instanceof Error ? err.message : err)
  }
}

async function kvDelete(env: Env, key: string): Promise<void> {
  try {
    await env.KV_CACHE.delete(key)
  } catch (err) {
    console.error('KV delete failed:', key, err instanceof Error ? err.message : err)
  }
}

// ─── KV Admin Handler ─────────────────────────────────────────────────────────

async function handleKvAdmin(request: Request, username: string, domain: string, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization') ?? ''
  if (!await timingSafeCompare(auth, `Bearer ${env.WORKER_SECRET}`)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await request.json() as { action?: string }
  const metaKey = `meta:${username}:${domain}`
  const renderedKey = `rendered:${username}:${domain}`
  metaMemo.delete(metaKey)

  if (body.action === 'purge') {
    await Promise.allSettled([
      kvDelete(env, metaKey),
      kvDelete(env, renderedKey),
    ])
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  if (body.action === 'offline') {
    await Promise.allSettled([
      // TTL-bound: the DB is the source of truth, KV only caches it
      kvPut(env, metaKey, '__offline__', { expirationTtl: 300 }),
      kvDelete(env, renderedKey),
    ])
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  return new Response('Bad Request', { status: 400 })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function hashIP(ip: string): Promise<string> {
  const encoded = new TextEncoder().encode(ip)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Pageview Tracking (fire-and-forget, Plausible-style) ─────────────────────
// Server-side analytics: every delivered HTML page fires one event to the app
// API via ctx.waitUntil(). Never blocks or breaks delivery — all errors are
// swallowed. The visitor is identified by a daily-rotating keyed hash; the raw
// IP is never sent or stored.

// Link-preview crawlers (WhatsApp, Telegram, Facebook external hit …) are bots.
// The Instagram IN-APP browser is a real visitor — its UA contains 'Instagram'
// but none of these patterns.
export const BOT_UA_RE = /bot|crawl|spider|slurp|preview|scan|fetch|monitor|lighthouse|headless|curl|wget|python|node-fetch|axios|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|pinterest|vkshare|skypeuripreview/i

// Pure, CF-runtime-free — unit-testable in plain Node.
export function parseUserAgent(ua: string): { device: string; browser: string; os: string | null } {
  const device = /iPad|Android(?!.*Mobile)/.test(ua) ? 'tablet'
    : /Mobi|iPhone|Android/.test(ua) ? 'mobile'
    : 'desktop'
  // Order matters: in-app browsers embed Chrome/Safari tokens, so check them first.
  const browser =
    ua.includes('Instagram') ? 'Instagram'
    : /FBAN|FBAV|FB_IAB/.test(ua) ? 'Facebook'
    : /TikTok|musical_ly|Bytedance/i.test(ua) ? 'TikTok'
    : /Edg\//.test(ua) ? 'Edge'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /OPR|Opera/.test(ua) ? 'Opera'
    : /FxiOS|Firefox/.test(ua) ? 'Firefox'
    : /CriOS|Chrome/.test(ua) ? 'Chrome'
    : /Safari/.test(ua) ? 'Safari'
    : 'Sonstige'
  const os =
    /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : null
  return { device, browser, os }
}

// Pure, CF-runtime-free — unit-testable in plain Node.
export function parseReferrer(referer: string | null, ownHost: string): { source: string | null; referrerHost: string | null } {
  if (!referer) return { source: 'direct', referrerHost: null }
  let refHost: string
  try {
    refHost = new URL(referer).hostname.toLowerCase()
  } catch {
    return { source: 'direct', referrerHost: null }
  }
  // Internal navigation (same host as the site itself) → no source
  if (refHost === ownHost.toLowerCase()) return { source: null, referrerHost: refHost }

  const is = (domain: string) => refHost === domain || refHost.endsWith(`.${domain}`)
  const source =
    is('instagram.com') ? 'instagram'
    : (is('facebook.com') || is('fb.com') || is('fb.me')) ? 'facebook'
    : (is('whatsapp.com') || is('wa.me')) ? 'whatsapp'
    : is('tiktok.com') ? 'tiktok'
    : (is('youtube.com') || is('youtu.be')) ? 'youtube'
    : /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(refHost) ? 'google'
    : is('bing.com') ? 'bing'
    : is('linktr.ee') ? 'linktree'
    : is('lnko.me') ? 'lnko'
    : (is('twitter.com') || is('x.com') || is('t.co')) ? 'twitter'
    : (is('t.me') || is('telegram.org') || is('telegram.me') || is('telegram.dog')) ? 'telegram'
    : 'other'
  return { source, referrerHost: refHost }
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Fire-and-forget pageview event. Only ever invoked from HTML delivery paths
 * (never for assets, /.finestsites/*, form posts, or error pages). Must be
 * wrapped in ctx.waitUntil() by the caller. Never throws.
 */
async function trackPageview(
  request: Request,
  url: URL,
  hostname: string,
  pathname: string,
  meta: SiteMeta,
  env: Env
): Promise<void> {
  try {
    if (request.method !== 'GET') return

    const ua = request.headers.get('user-agent')
    if (!ua || BOT_UA_RE.test(ua)) return

    // Skip browser prefetch/preview fetches — not real pageviews
    const purpose = `${request.headers.get('sec-purpose') ?? ''} ${request.headers.get('purpose') ?? ''}`.toLowerCase()
    if (purpose.includes('prefetch') || purpose.includes('preview')) return

    // Daily-rotating keyed visitor hash (Plausible principle) — the IP itself
    // is never sent anywhere.
    const ip = request.headers.get('cf-connecting-ip') ?? ''
    const day = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
    const visitorHash = await sha256Hex(`${env.WORKER_SECRET}|${day}|${ip}|${ua}|${hostname}`)

    const { device, browser, os } = parseUserAgent(ua)
    const { source, referrerHost } = parseReferrer(request.headers.get('referer'), hostname)
    const trim200 = (v: string | null): string | null => (v ? v.slice(0, 200) : null)
    const country = (request as Request & { cf?: { country?: string } }).cf?.country ?? null

    const event = {
      siteId: meta.siteId,
      templateId: meta.templateId,
      eventType: 'pageview',
      visitorHash,
      host: hostname,
      path: pathname,
      source,
      referrerHost,
      utmSource: trim200(url.searchParams.get('utm_source')),
      utmMedium: trim200(url.searchParams.get('utm_medium')),
      utmCampaign: trim200(url.searchParams.get('utm_campaign')),
      device,
      browser,
      os,
      country,
      meta: null,
    }

    await fetch(`${env.APP_URL}/api/worker/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': env.WORKER_SECRET,
      },
      body: JSON.stringify({ events: [event] }),
    })
  } catch (err) {
    // Tracking must never break delivery — swallow everything.
    console.error('trackPageview error:', err)
  }
}

// Injected into every delivered HTML page. Measures time until the page is
// first hidden (tab switch, navigation, close) and reports it once via
// sendBeacon — the only reliable delivery on unload, especially mobile.
const BEACON_SNIPPET = `<script data-fs-beacon>(function(){var t0=Date.now(),sent=0;function send(){if(sent)return;sent=1;var d=Math.round((Date.now()-t0)/1e3);if(d<3||d>1800)return;try{navigator.sendBeacon('/.finestsites/e',JSON.stringify({d:d,p:location.pathname}))}catch(e){}}document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')send()});addEventListener('pagehide',send)})();</script>`

/** Werbe-Tracking anhängen — nur wenn eingerichtet, nicht auf Rechtsseiten, nicht für Bots/„nicht mitzählen“. */
function finalizeHtml(html: string, pathname: string, request: Request, meta: SiteMeta): string {
  return shouldInject(pathname, request, meta) ? injectTracking(html, meta) : html
}

function injectBeacon(html: string): string {
  if (html.includes('data-fs-beacon')) return html
  return html.includes('</body>')
    ? html.replace('</body>', `${BEACON_SNIPPET}</body>`)
    : html + BEACON_SNIPPET
}

/**
 * Fire-and-forget duration event sent by the beacon on page hide. Same
 * visitor hash recipe as trackPageview so events can be correlated per
 * visitor and day. Seconds live in meta. Never throws.
 */
async function trackDuration(
  rawBody: string,
  request: Request,
  hostname: string,
  meta: SiteMeta,
  env: Env
): Promise<void> {
  try {
    const ua = request.headers.get('user-agent')
    if (!ua || BOT_UA_RE.test(ua)) return

    let body: { d?: unknown; p?: unknown } | null = null
    try {
      body = JSON.parse(rawBody)
    } catch {
      return
    }
    const seconds = typeof body?.d === 'number' ? Math.round(body.d) : NaN
    if (!Number.isFinite(seconds) || seconds < 3 || seconds > 1800) return
    const path = typeof body?.p === 'string' && body.p.startsWith('/') ? body.p.slice(0, 200) : '/'

    const ip = request.headers.get('cf-connecting-ip') ?? ''
    const day = new Date().toISOString().slice(0, 10)
    const visitorHash = await sha256Hex(`${env.WORKER_SECRET}|${day}|${ip}|${ua}|${hostname}`)
    const { device, browser, os } = parseUserAgent(ua)
    const country = (request as Request & { cf?: { country?: string } }).cf?.country ?? null

    const event = {
      siteId: meta.siteId,
      templateId: meta.templateId,
      eventType: 'duration',
      visitorHash,
      host: hostname,
      path,
      source: null,
      referrerHost: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      device,
      browser,
      os,
      country,
      meta: { seconds },
    }

    await fetch(`${env.APP_URL}/api/worker/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': env.WORKER_SECRET,
      },
      body: JSON.stringify({ events: [event] }),
    })
  } catch (err) {
    console.error('trackDuration error:', err)
  }
}

// ─── Email Notification (fire-and-forget) ─────────────────────────────────────

async function sendSubmissionEmail(
  env: Env,
  meta: SiteMeta,
  formName: string,
  formData: Record<string, string>,
  siteUrl: string | null,
): Promise<void> {
  if (!env.RESEND_API_KEY) return

  try {
    // Load user email + form schema from the FinestSites app API
    const infoRes = await fetch(
      `${env.APP_URL}/api/worker/site-info?siteId=${meta.siteId}&templateId=${meta.templateId}&formName=${encodeURIComponent(formName)}`,
      { headers: { 'x-worker-secret': env.WORKER_SECRET } }
    )
    if (!infoRes.ok) return
    const info = await infoRes.json() as { userEmail: string | null; formSchema: { title: string; fields: Array<{key:string;label:string}>; emailNotificationEnabled: boolean } | null }

    const accountEmail = info.userEmail
    const schema = info.formSchema

    // Empfänger ausschließlich aus unseren Daten: die vom Nutzer im Editor hinterlegte
    // Benachrichtigungs-Adresse (email_benachrichtigung), sonst die Konto-E-Mail.
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    let siteRecipient: string | null = null
    try {
      const sdRes = await fetch(`${env.APP_URL}/api/worker/site-data?siteId=${meta.siteId}`, { headers: { 'x-worker-secret': env.WORKER_SECRET } })
      if (sdRes.ok) {
        const rows = await sdRes.json() as { fieldKey: string; fieldValue: string | null }[]
        const hit = rows.find(r => r.fieldKey === 'email_benachrichtigung' && r.fieldValue && EMAIL_RE.test(r.fieldValue.trim()))
        siteRecipient = hit?.fieldValue?.trim() ?? null
      }
    } catch { /* fällt auf die Konto-E-Mail zurück */ }
    const recipient = siteRecipient ?? accountEmail
    if (!recipient) return

    if (schema && !schema.emailNotificationEnabled) return

    // Ohne Schema keinen Request-String als Titel verwenden
    const formTitle = schema?.title ?? 'Kontaktformular'
    const fieldMap = Object.fromEntries((schema?.fields ?? []).map(f => [f.key, f.label]))
    const appUrl = (env.APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')
    const year = new Date().getFullYear()

    // Prettify raw field keys when no schema label is available
    const prettyKey = (key: string): string => {
      const map: Record<string, string> = {
        name: 'Name', fullname: 'Name', vorname: 'Vorname', nachname: 'Nachname',
        email: 'E-Mail', telefon: 'Telefon', phone: 'Telefon',
        nachricht: 'Nachricht', message: 'Nachricht', betreff: 'Betreff',
        subject: 'Betreff', hintergrund: 'Hintergrund', ziele: 'Ziele',
        interesse: 'Interesse', zeit: 'Verfügbare Zeit',
        kontaktweg: 'Bevorzugter Kontaktweg', laendervorwahl: 'Ländervorwahl',
        vorwahl: 'Ländervorwahl', unternehmen: 'Unternehmen', firma: 'Firma',
        company: 'Unternehmen', website: 'Website', adresse: 'Adresse',
        address: 'Adresse', stadt: 'Stadt', city: 'Stadt', plz: 'PLZ',
        land: 'Land', country: 'Land', kommentar: 'Kommentar', comment: 'Kommentar',
        anrede: 'Anrede', geburtsdatum: 'Geburtsdatum', geburtstag: 'Geburtstag',
        beruf: 'Beruf', branche: 'Branche', erfahrung: 'Erfahrung', motivation: 'Motivation',
      }
      return map[key.toLowerCase()] ?? key.replace(/[_-]+/g, ' ')
    }

    const entries = Object.entries(formData)
    const rows = entries
      .map(([k, v], i) => {
        const isLast = i === entries.length - 1
        const label = htmlEscape(fieldMap[k] ?? prettyKey(k))
        const value = htmlEscape(v).replace(/\n/g, '<br>') || '—'
        const border = isLast ? '' : 'border-bottom:1px solid #E5E7EB;'
        return `<tr><td style="padding:10px 16px;${border}width:40%;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:10px 16px;${border}font-size:14px;color:#111827;line-height:1.5;vertical-align:top;">${value}</td></tr>`
      })
      .join('')

    const isVital = typeof formData.vitaltyp === 'string' && formData.vitaltyp.trim() !== ''
    const bodyBlock = isVital ? vitalprofilMailBody(formData) : `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;background:#F9FAFB;border-radius:12px;border:1px solid #E5E7EB;border-collapse:separate;border-spacing:0;">${rows}</table>`
    const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Neue Anfrage: ${htmlEscape(formTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td align="center" style="padding-bottom:28px;">
            <img src="${appUrl}/logos/logo-black.svg" alt="FinestSites" height="22" style="height:22px;width:auto;display:block;"/>
          </td>
        </tr>
        <tr>
          <td style="background:#FFFFFF;border-radius:20px;padding:40px;border:1px solid #E5E7EB;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.02em;">Neue Anfrage erhalten</h1>
            <p style="margin:0 0 6px;font-size:15px;color:#374151;line-height:1.65;">Über dein Formular <strong>${htmlEscape(formTitle)}</strong> ist eine neue Anfrage eingegangen.</p>
            ${siteUrl ? `<p style="margin:0 0 24px;font-size:13px;color:#6B7280;"><a href="${siteUrl}" style="color:#6B7280;text-decoration:underline;">${siteUrl.replace(/^https?:\/\//, '')}</a></p>` : '<p style="margin:0 0 24px;"></p>'}
            ${bodyBlock}
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#111827;border-radius:99px;">
                  <a href="${appUrl}/submissions" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:99px;">Alle Anfragen ansehen →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 0 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">© ${year} FinestSites &nbsp;·&nbsp; <a href="mailto:support@finestsites.de" style="color:#9CA3AF;text-decoration:underline;">Support</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.NOTIFY_FROM || 'FinestSites <anfragen@finestsites.io>',
        to: [recipient],
        subject: isVital ? `Vitalprofil von ${formData.name || 'Unbekannt'}: ${formData.vitaltyp}` : `Neue Anfrage: ${formTitle}`,
        html,
      }),
    })
    // Visible in `wrangler tail` — a silent failure here means a customer misses a lead
    if (!res.ok) console.error('Form notification failed:', res.status, (await res.text()).slice(0, 300))
  } catch {
    // Fire-and-forget — never block or crash the response
  }
}

/**
 * Vitalprofil result mail: contact first, then the profile as cards and the five
 * areas with their four answers. Keys come from the template's payload():
 * name, email, telefon, kontaktweg, interesse, nachricht, vitaltyp, vitallevel,
 * staerke, hebel, wuensche, antriebsmotive, budget_pro_tag, bereich_* (score line +
 * one "Aussage: Antwort" per line), sprache, einwilligung.
 */
function vitalprofilMailBody(d: Record<string, string>): string {
  const esc = (v: string | undefined) => htmlEscape(v ?? '')
  const h2 = (t: string) => `<p style="margin:0 0 8px;font-size:11.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;">${t}</p>`
  const row = (label: string, value: string | undefined, last = false) => value && value.trim()
    ? `<tr><td style="padding:9px 14px;${last ? '' : 'border-bottom:1px solid #E5E7EB;'}width:38%;font-size:13px;color:#6B7280;vertical-align:top;">${label}</td><td style="padding:9px 14px;${last ? '' : 'border-bottom:1px solid #E5E7EB;'}font-size:14px;color:#111827;font-weight:500;">${esc(value).replace(/\n/g, '<br>')}</td></tr>`
    : ''
  const box = (inner: string) => `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 22px;background:#F9FAFB;border-radius:12px;border:1px solid #E5E7EB;border-collapse:separate;border-spacing:0;">${inner}</table>`

  const emailRow = d.email && d.email.trim()
    ? `<tr><td style="padding:9px 14px;border-bottom:1px solid #E5E7EB;width:38%;font-size:13px;color:#6B7280;vertical-align:top;">E-Mail</td><td style="padding:9px 14px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#111827;font-weight:500;"><a href="mailto:${esc(d.email)}" style="color:#111827;">${esc(d.email)}</a></td></tr>`
    : ''
  const contact = box(row('Name', d.name) + emailRow + row('Telefon', d.telefon) + row('Kontaktweg', d.kontaktweg) + row('Interesse', d.interesse) + row('Nachricht', d.nachricht, true))

  const tile = (label: string, value: string | undefined) => `<td width="50%" style="padding:0 6px 12px 0;vertical-align:top;"><div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;padding:12px 14px;"><p style="margin:0 0 3px;font-size:11.5px;color:#6B7280;">${label}</p><p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${esc(value) || '—'}</p></div></td>`
  const profile = `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 10px;border-collapse:separate;border-spacing:0;"><tr>${tile('Vital-Typ', d.vitaltyp)}${tile('Vitallevel', d.vitallevel)}</tr><tr>${tile('Stärke', d.staerke)}${tile('Größter Hebel', d.hebel)}</tr></table>`
    + box(row('Wünsche', d.wuensche) + row('Antriebsmotive', d.antriebsmotive) + row('Wohlbefinden pro Tag', d.budget_pro_tag, true))

  const areas: Array<[string, string, string]> = [
    ['bereich_ernaehrung', 'Ernährung & Trinken', '#2FA877'], ['bereich_tag', 'Tagesstruktur & Pausen', '#3B86D8'],
    ['bereich_schlaf', 'Schlaf & Abschalten', '#6E5BD6'], ['bereich_bewegung', 'Bewegung & Fitness', '#E4664A'],
    ['bereich_ausgleich', 'Ausgleich & Zeit für dich', '#E0A030'],
  ]
  const areaCards = areas.map(([key, label, color]) => {
    const raw = d[key] ?? ''
    if (!raw.trim()) return ''
    const lines = raw.split('\n')
    const score = lines.shift() ?? ''
    const pct = parseInt((score.match(/(\d+)\s*%/) ?? [])[1] ?? '0', 10)
    const answers = lines.map(l => { const i = l.indexOf(':'); const q = i > -1 ? l.slice(0, i) : l; const a = i > -1 ? l.slice(i + 1).trim() : ''
      return `<tr><td style="padding:5px 0;font-size:13px;color:#374151;">${esc(q)}</td><td align="right" style="padding:5px 0 5px 12px;font-size:13px;color:#111827;font-weight:500;white-space:nowrap;">${esc(a)}</td></tr>` }).join('')
    return `<div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;padding:14px 16px;margin:0 0 10px;">
      <table cellpadding="0" cellspacing="0" width="100%"><tr><td style="font-size:14px;font-weight:600;color:#111827;">${label}</td><td align="right" style="font-size:13px;color:#6B7280;">${esc(score)}</td></tr></table>
      <div style="height:6px;border-radius:6px;background:#F3F4F6;margin:8px 0 10px;"><div style="height:6px;border-radius:6px;width:${Math.max(4, Math.min(100, pct))}%;background:${color};"></div></div>
      <table cellpadding="0" cellspacing="0" width="100%">${answers}</table>
    </div>`
  }).join('')

  const meta = `<p style="margin:14px 0 0;font-size:12px;color:#9CA3AF;line-height:1.6;">Sprache: ${esc(d.sprache) || '—'} · Einwilligung (Art. 9 DSGVO): ${esc(d.einwilligung) || '—'}</p>`
  return `${h2('Kontakt')}${contact}${h2('Vitalprofil')}${profile}${h2('Die fünf Bereiche')}${areaCards}${meta}<div style="height:18px;"></div>`
}

const RAW_KEY_RE = /(_html|_html_en)$|^(intro|bio|about_me_html)(_en)?$/
// JS-String-Escaping für {{key}} innerhalb von <script> (kein Ausbruch aus Strings oder </script>)
function jsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/</g, '\\x3C').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

// ─── Pfad-Policy ──────────────────────────────────────────────────────────────
// Scanner fragen /.git/config, /env, /setup/, /wp-admin … ab. Solche Pfade bekommen
// ein knappes 404 (kein Seiten-HTML, kein Pageview), damit weder Analytics noch
// App-API dafür Arbeit leisten. /.finestsites/* und /.well-known/* bleiben unberührt.
const SCANNER_PATH_RE = /^\/(?:env|setup|api|feed|rss|admin|administrator|wp-admin|wp-content|wp-includes|wp-json|wp-login\.php|xmlrpc\.php|phpmyadmin|pma|vendor|cgi-bin|config|configuration|backup|backups|db|database|dump|server-status|server-info|_profiler|actuator|console|telescope|graphql|debug|test|tmp|old|login|owa|autodiscover|ecp|remote|manager|solr|jenkins|aws|s3|credentials|secrets)(?:\/|$)/i
function isBlockedPath(pathname: string): boolean {
  if (pathname.startsWith('/.finestsites/') || pathname.startsWith('/.well-known/')) return false
  if (/\/\./.test(pathname)) return true           // jede Dotfile-/Dotdir-Komponente (.git, .env, .svn, .DS_Store …)
  if (/\.(php|asp|aspx|jsp|cgi|pl|sh|bak|sql|zip|tar|gz|rar|7z|log|ini|yml|yaml|json|xml|txt)$/i.test(pathname) && !/^\/(robots\.txt|sitemap\.xml|manifest\.json|site\.webmanifest)$/i.test(pathname)) return true
  return SCANNER_PATH_RE.test(pathname)
}
// SPA-Fallback (Pfade ohne Dateiendung → index.html) nur für einfache Slugs wie /testevent
const SPA_SLUG_RE = /^\/[a-z0-9][a-z0-9_-]{0,80}\/?$/i
function plain404(): Response {
  return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}
function shouldTrack(pathname: string): boolean { return !pathname.startsWith('/.well-known/') }

// ─── Security-Header für ausgelieferte Seiten ─────────────────────────────────
const HTML_SEC_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "frame-ancestors 'self' https://app.finestsites.io https://finestsites.io",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
}
function htmlHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ...HTML_SEC_HEADERS, ...extra }
}

// ─── Form Submission Handler ──────────────────────────────────────────────────

async function handleFormSubmission(request: Request, pathname: string, meta: SiteMeta, env: Env, ctx: ExecutionContext, hostname: string): Promise<Response> {
  const formName = pathname.split('/').filter(Boolean).pop() ?? 'default'

  // Formularname nur als kurzer Slug (steht im DB-Datensatz und im Mail-Betreff)
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/i.test(formName)) {
    return new Response(JSON.stringify({ error: 'Ungültiges Formular.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  // Größenlimits: 64 KB Body, 60 Felder, 64 Zeichen je Schlüssel, 5.000 Zeichen je Wert
  const MAX_BODY = 65536, MAX_FIELDS = 60, MAX_KEY = 64, MAX_VALUE = 5000
  const declared = parseInt(request.headers.get('content-length') ?? '0', 10)
  if (declared > MAX_BODY) {
    return new Response(JSON.stringify({ error: 'Anfrage zu groß.' }), { status: 413, headers: { 'Content-Type': 'application/json' } })
  }

  let formData: Record<string, string> = {}
  let redirectUrl: string | null = null
  let honeypot = false
  let eventId: string | null = null   // Ereignis-Nummer fürs Werbe-Tracking (vom Script gesetzt)
  let pageUrl: string | null = null   // Seite inkl. utm_* beim Absenden
  // `_recipient` aus dem Request wird bewusst ignoriert: der Empfänger wird in
  // sendSubmissionEmail aus den Seitendaten (email_benachrichtigung) bzw. dem Konto
  // bestimmt. Sonst wäre das Endpoint ein offener Mail-Relay.
  const take = (key: string, raw: unknown) => {
    if (key === '_redirect') { redirectUrl = String(raw ?? ''); return }
    if (key === '_event_id') { const v = String(raw ?? ''); if (/^[A-Za-z0-9_-]{8,64}$/.test(v)) eventId = v; return }
    if (key === '_page') { const v = String(raw ?? ''); if (/^https?:\/\/[^\s]{1,500}$/.test(v)) pageUrl = v; return }
    if (key === '_honeypot') { if (String(raw ?? '').trim() !== '') honeypot = true; return }
    if (key.startsWith('_')) return // andere Systemfelder (inkl. _recipient) verwerfen
    if (Object.keys(formData).length >= MAX_FIELDS) return
    if (!/^[\w.:-]{1,64}$/.test(key) || key.length > MAX_KEY) return
    const v = typeof raw === 'string' ? raw : (raw == null ? '' : String(raw))
    formData[key] = v.length > MAX_VALUE ? v.slice(0, MAX_VALUE) : v
  }

  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const fd = await request.formData()
    for (const [key, value] of fd.entries()) take(key, typeof value === 'string' ? value : '')
  } else if (contentType.includes('application/json')) {
    const text = await request.text()
    if (text.length > MAX_BODY) {
      return new Response(JSON.stringify({ error: 'Anfrage zu groß.' }), { status: 413, headers: { 'Content-Type': 'application/json' } })
    }
    let body: unknown = null
    try { body = JSON.parse(text) } catch { body = null }
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      for (const [k, v] of Object.entries(body as Record<string, unknown>)) take(k, v)
    }
  }

  if (Object.keys(formData).length === 0) {
    return new Response(JSON.stringify({ error: 'Keine Daten empfangen.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Rate limit via KV (5 submissions per IP per 10min)
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? ''
  const rateLimitKey = `rate:${meta.siteId}:${ip}`
  const rateCount = parseInt(await kvGet(env, rateLimitKey) ?? '0')
  if (rateCount >= 5) {
    return new Response(JSON.stringify({ error: 'Zu viele Anfragen. Bitte warte 10 Minuten.' }), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    })
  }
  await kvPut(env, rateLimitKey, String(rateCount + 1), { expirationTtl: 600 })

  const ipHash = ip ? await hashIP(ip) : null

  // Save to our PostgreSQL via the app API
  const saveRes = await fetch(`${env.APP_URL}/api/worker/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-worker-secret': env.WORKER_SECRET,
    },
    body: JSON.stringify({
      userSiteId: meta.siteId,
      formName,
      data: formData,
      submitterIpHash: ipHash,
      isSpam: honeypot,
    }),
  })

  if (!saveRes.ok) {
    return new Response(JSON.stringify({ error: 'Speichern fehlgeschlagen.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fire-and-forget email notification (only for non-spam)
  let duplicate = false
  if (!honeypot) {
    const siteUrl = `https://${hostname}`
    ctx.waitUntil(sendSubmissionEmail(env, meta, formName, formData, siteUrl))

    // Werbe-Tracking: Anfrage als „lead“ in die eigene Statistik (eindeutig je Ereignis-Nummer),
    // und nur mit Einwilligung serverseitig an Meta/TikTok — mit derselben Nummer wie im Browser.
    if (meta.tracking && !isNoTrack(request)) {
      const leadId = eventId ?? `srv-${crypto.randomUUID()}`
      const sourceUrl = pageUrl ?? siteUrl
      duplicate = await recordEvent(env, meta, hostname, request, 'lead', sourceUrl, leadId, { form: formName })
      if (!duplicate && hasMarketingConsent(request)) {
        ctx.waitUntil(sendServerEvent(env, meta, request, { name: 'Lead', eventId: leadId, sourceUrl, formData }))
      }
      eventId = leadId
    }
  }

  // Response
  const acceptsJson = request.headers.get('accept')?.includes('application/json')
  if (acceptsJson) {
    return new Response(JSON.stringify({ success: true, ...(eventId ? { event_id: eventId, duplicate } : {}) }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // Nur relative Pfade (kein "//evil.tld"), immer auf den eigenen Host aufgelöst
  if (redirectUrl && /^\/(?!\/)/.test(redirectUrl) && redirectUrl.length < 512) {
    return Response.redirect(`https://${hostname}${redirectUrl}`, 302)
  }

  return new Response(successPage(), { headers: htmlHeaders() })
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    const url = new URL(request.url)
    // Resolve the effective hostname:
    // 1. When called via workers.dev (proxied from Vercel middleware), the actual custom domain
    //    is passed in X-Forwarded-Host because workers.dev rejects a mismatched Host header.
    // 2. When invoked directly via the *.womenplus.io/* route, the Host header is authoritative.
    const isWorkersDevRequest = url.hostname.endsWith('.workers.dev')
    const hostname = (
      (isWorkersDevRequest && request.headers.get('x-forwarded-host'))
        ? request.headers.get('x-forwarded-host')!
        : (request.headers.get('host') ?? url.hostname)
    ).split(':')[0].toLowerCase()
    const pathname = url.pathname

    // Health check (works on any hostname)
    if (pathname === '/.finestsites/health') {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Demo endpoint — serves a pre-rendered template by slug for testing on
    // any device without setting up the template's actual domain/zone yet.
    // Push the rendered HTML to KV under `demo:{slug}` (24h TTL).
    if (pathname.startsWith('/.finestsites/demo/')) {
      const slug = pathname.replace('/.finestsites/demo/', '').replace(/\/$/, '')
      const html = await kvGet(env, `demo:${slug}`)
      if (html) {
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
        })
      }
      return new Response('Demo not found', { status: 404 })
    }

    // ── Resolve username + domain ─────────────────────────────────────────────
    // First check custom domain KV (e.g. www.meine-domain.de → { username, templateDomain })
    // This must happen BEFORE subdomain parsing to avoid false matches.
    let username: string
    let domain: string

    const customSite = await resolveCustomDomain(hostname, env)
    if (customSite) {
      username = customSite.username
      domain = customSite.templateDomain
    } else {
      // Fall back to subdomain pattern: username.template-domain.tld
      const parts = hostname.split('.')
      if (parts.length < 3) {
        return new Response('Not found', { status: 404 })
      }
      username = parts[0]
      domain = parts.slice(1).join('.')
    }

    // KV admin — called by Vercel on publish/unpublish (no Cloudflare API token needed)
    if (pathname === '/.finestsites/kv' && request.method === 'POST') {
      return handleKvAdmin(request, username, domain, env)
    }

    try {
      const meta = await getSiteMeta(username, domain, env)

      // Site explicitly taken offline
      if (meta === '__offline__') {
        return new Response(offlinePage(username, domain), {
          status: 410,
          headers: htmlHeaders({ 'Cache-Control': 'no-store' }),
        })
      }

      // Site not found / never published
      if (!meta) {
        return new Response(notFoundPage(username, domain), {
          status: 404,
          headers: htmlHeaders({ 'Cache-Control': 'no-store' }),
        })
      }

      // ── Scanner-/Dotfile-Pfade ───────────────────────────────────────────
      if (isBlockedPath(pathname)) return plain404()

      // ── Form submission ──────────────────────────────────────────────────
      if (request.method === 'POST' && pathname.startsWith('/.finestsites/forms/')) {
        return handleFormSubmission(request, pathname, meta, env, ctx, hostname)
      }

      // ── Werbe-Tracking: Kontakt-Klick / Einwilligung (sendBeacon) ───────
      if (request.method === 'POST' && pathname === '/.finestsites/t') {
        return handleTrackingBeacon(request, meta, env, ctx, hostname)
      }
      // ── „Mein Gerät nicht mitzählen“ (Link aus den Einstellungen) ───────
      if (request.method === 'GET' && pathname === '/.finestsites/notrack') {
        return handleNoTrack(url)
      }

      // ── Duration beacon (sendBeacon on page hide) ────────────────────────
      if (request.method === 'POST' && pathname === '/.finestsites/e') {
        // Body must be read before the response is returned — afterwards the
        // request stream is no longer readable inside waitUntil.
        const beaconBody = await request.text().catch(() => '')
        ctx.waitUntil(trackDuration(beaconBody, request, hostname, meta, env))
        return new Response(null, { status: 204 })
      }

      // ── Legal pages (impressum, datenschutz) ─────────────────────────────
      // Rendered inline from Worker code — zero R2 files needed.
      // Adding a new template = one line in LEGAL_DESIGNS. Legal text change = one wrangler deploy.
      if (pathname === '/impressum' || pathname === '/datenschutz') {
        const pageDataRes = await fetch(
          `${env.APP_URL}/api/worker/site-data?siteId=${meta.siteId}`,
          { headers: { 'x-worker-secret': env.WORKER_SECRET } }
        )
        const pageRows = pageDataRes.ok
          ? await pageDataRes.json() as { fieldKey: string; fieldValue: string | null }[]
          : []
        const pageDataMap: Data = {}
        for (const r of pageRows) pageDataMap[r.fieldKey] = r.fieldValue ?? ''
        // Make impressum/datenschutz theme-aware based on site's farbthema placeholder
        const baseDesign = LEGAL_DESIGNS[domain] ?? DEFAULT_LEGAL_DESIGN
        const farbthema = (pageDataMap['farbthema'] as string) || 'blau'
        const themeAccents: Record<string, { accent: string; boxBg: string; boxBorder: string; logo: string }> = {
          blau:    { accent: '#2563EB', boxBg: '#EFF6FF', boxBorder: '#BFDBFE', logo: '#2563EB' },
          gruen:   { accent: '#1F5138', boxBg: '#E8F0EB', boxBorder: '#A5C4B0', logo: '#4A8564' },
          orange:  { accent: '#C2410C', boxBg: '#FFF1E0', boxBorder: '#FDBA74', logo: '#F97316' },
          skyblau: { accent: '#0284C7', boxBg: '#E0F2FE', boxBorder: '#BAE6FD', logo: '#38BDF8' },
        }
        const vitalAccents: Record<string, { accent: string; boxBg: string; boxBorder: string; logo: string }> = {
          gruen:   { accent: '#1F9D6B', boxBg: '#F3F7F4', boxBorder: '#DCF1E6', logo: '#1F9D6B' },
          orange:  { accent: '#E8842A', boxBg: '#FAF5EF', boxBorder: '#FBE8D7', logo: '#E8842A' },
          rot:     { accent: '#D9433B', boxBg: '#FAF3F2', boxBorder: '#FAE0DE', logo: '#D9433B' },
          blau:    { accent: '#3572DF', boxBg: '#F2F5FA', boxBorder: '#DFE9FB', logo: '#3572DF' },
          violett: { accent: '#7357D9', boxBg: '#F5F3FA', boxBorder: '#EAE5FA', logo: '#7357D9' },
          nacht:   { accent: '#3FCB9E', boxBg: '#F3F7F4', boxBorder: '#DCF1E6', logo: '#1F9D6B' },
        }
        const ta = domain === 'vitalprofil.net'
          ? (vitalAccents[farbthema] ?? vitalAccents.gruen)
          : (themeAccents[farbthema] ?? themeAccents.blau)
        const design = {
          ...baseDesign,
          accent: ta.accent,
          boxBg: ta.boxBg,
          boxBorder: ta.boxBorder,
          logoHtml: baseDesign.logoHtml.replace(/#[0-9A-Fa-f]{6}/g, ta.logo),
        }
        const legalHtml = pathname === '/impressum' ? renderImpressum(design) : renderDatenschutz(design, domain, meta.tracking)
        if (shouldTrack(pathname)) ctx.waitUntil(trackPageview(request, url, hostname, pathname, meta, env))
        return new Response(injectBeacon(render(legalHtml, pageDataMap)), {
          headers: htmlHeaders(),
        })
      }

      // ── Other dedicated static pages (agb …) ─────────────────────────────
      // Still served from R2 for flexibility.
      const STATIC_PAGES: Record<string, string> = { '/agb': 'agb.html' }
      const dedicatedPageFile = STATIC_PAGES[pathname]
      if (dedicatedPageFile) {
        const pageObj = await env.R2_BUCKET.get(`${meta.r2BasePath}/${dedicatedPageFile}`)
        if (pageObj) {
          const pageHtml = await pageObj.text()
          const pageDataRes = await fetch(
            `${env.APP_URL}/api/worker/site-data?siteId=${meta.siteId}`,
            { headers: { 'x-worker-secret': env.WORKER_SECRET } }
          )
          const pageRows = pageDataRes.ok
            ? await pageDataRes.json() as { fieldKey: string; fieldValue: string | null }[]
            : []
          const pageDataMap: Data = {}
          for (const r of pageRows) pageDataMap[r.fieldKey] = r.fieldValue ?? ''
          if (shouldTrack(pathname)) ctx.waitUntil(trackPageview(request, url, hostname, pathname, meta, env))
          return new Response(finalizeHtml(injectBeacon(render(pageHtml, pageDataMap)), pathname, request, meta), {
            headers: htmlHeaders(),
          })
        }
        // No dedicated page found in R2 — fall through to SPA routing
      }

      // ── Static assets ────────────────────────────────────────────────────
      // SPA routing: paths without a file extension (e.g. /testevent, /event-2)
      // fall through to the rendered HTML below — the template's JS handles the
      // page switch via location.pathname. Only paths with an explicit file
      // extension (.css, .png, .woff2 …) are served from R2.
      const assetPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '')
      const hasFileExt = /\.[a-zA-Z0-9]+$/.test(assetPath)
      const isHtml = assetPath === 'index.html' || assetPath.endsWith('.html') || !hasFileExt
      // Unbekannte HTML-Pfade: nur "/" und einfache SPA-Slugs rendern, alles andere 404
      if (isHtml && pathname !== '/' && assetPath !== 'index.html' && !SPA_SLUG_RE.test(pathname) && !pathname.startsWith('/.well-known/')) return plain404()

      if (!isHtml && assetPath) {
        const r2Key = `${meta.r2BasePath}/${assetPath}`
        const rangeHeader = request.headers.get('Range')

        if (rangeHeader && rangeHeader.startsWith('bytes=')) {
          // Range request — required for MP4 video seeking in browsers
          const head = await env.R2_BUCKET.head(r2Key)
          if (!head) return new Response('Asset not found', { status: 404 })
          const size = head.size
          const [startStr, endStr] = rangeHeader.slice(6).split('-')
          const start = Math.max(0, parseInt(startStr, 10) || 0)
          const end = Math.min(size - 1, endStr ? parseInt(endStr, 10) : size - 1)
          const length = end - start + 1
          const rangeAsset = await env.R2_BUCKET.get(r2Key, { range: { offset: start, length } })
          if (!rangeAsset) return new Response('Asset not found', { status: 404 })
          return new Response(rangeAsset.body, {
            status: 206,
            headers: {
              'Content-Type': ct(assetPath),
              'X-Content-Type-Options': 'nosniff',
              'Content-Range': `bytes ${start}-${end}/${size}`,
              'Content-Length': String(length),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=31536000, immutable',
              'Access-Control-Allow-Origin': '*',
            },
          })
        }

        const asset = await env.R2_BUCKET.get(r2Key)
        if (asset) {
          return new Response(asset.body, {
            headers: {
              'Content-Type': ct(assetPath),
              'X-Content-Type-Options': 'nosniff',
              'Content-Length': String(asset.size),
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'public, max-age=31536000, immutable',
              'Access-Control-Allow-Origin': '*',
            },
          })
        }
        return new Response('Asset not found', { status: 404 })
      }

      // ── Render HTML ──────────────────────────────────────────────────────
      const renderCacheKey = `rendered:${username}:${domain}`
      const cachedHtml = await kvGet(env, renderCacheKey)
      if (cachedHtml) {
        if (shouldTrack(pathname)) ctx.waitUntil(trackPageview(request, url, hostname, pathname, meta, env))
        return new Response(finalizeHtml(injectBeacon(cachedHtml), pathname, request, meta), {
          headers: htmlHeaders({ 'X-Cache': 'HIT' }),
        })
      }

      const r2Object = await env.R2_BUCKET.get(`${meta.r2BasePath}/index.html`)
      if (!r2Object) return new Response('Template nicht gefunden', { status: 500 })
      const templateHtml = await r2Object.text()

      const dataRes = await fetch(
        `${env.APP_URL}/api/worker/site-data?siteId=${meta.siteId}`,
        { headers: { 'x-worker-secret': env.WORKER_SECRET } }
      )
      const rows = dataRes.ok ? await dataRes.json() as { fieldKey: string; fieldValue: string | null; html?: boolean }[] : []
      const dataMap: Data = {}
      // html: true markiert Richtext-Felder laut Template-Schema → werden roh ausgegeben
      const rawKeys = new Set<string>()
      for (const r of rows) { dataMap[r.fieldKey] = r.fieldValue ?? ''; if (r.html) rawKeys.add(r.fieldKey) }

      let renderedHtml = render(templateHtml, dataMap, rawKeys)

      // "Made with FinestSites" im Footer: immer auf die Startseite mit dem Empfehlungslink
      // des Seitenbesitzers (finestsites.io/?ref=username, gleicher Link wie im Affiliate-Bereich)
      const refLink = `https://finestsites.io/?ref=${encodeURIComponent(username)}`
      renderedHtml = renderedHtml
        .replace(/>Made with FinestSites</g, `>Made with <a href="${refLink}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">FinestSites</a><`)
        .replace(/href="https:\/\/finestsites\.(?:io|de)\/?"/g, `href="${refLink}"`)

      // Inject hero image as og:image when the template has no og:image set.
      // Prefers data keys containing "hero", "bg", "bild", or "background".
      const ogMatch = renderedHtml.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i)
      if (!ogMatch || !ogMatch[1]) {
        const imageKeys = Object.keys(dataMap).filter(k => {
          const v = dataMap[k]
          return v && /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(v)
        })
        const heroKey = imageKeys.find(k => /hero|bg|bild|background|header/i.test(k)) ?? imageKeys[0]
        const heroImageUrl = heroKey ? dataMap[heroKey] : null
        if (heroImageUrl) {
          const safeUrl = heroImageUrl.replace(/"/g, '&quot;')
          if (ogMatch) {
            renderedHtml = renderedHtml.replace(
              ogMatch[0],
              `<meta property="og:image" content="${safeUrl}"`
            )
          } else {
            renderedHtml = renderedHtml.replace(
              /<head>/i,
              `<head><meta property="og:image" content="${safeUrl}" />`
            )
          }
        }
      }

      renderedHtml = injectBeacon(renderedHtml)
      await kvPut(env, renderCacheKey, renderedHtml, { expirationTtl: 60 })

      if (shouldTrack(pathname)) ctx.waitUntil(trackPageview(request, url, hostname, pathname, meta, env))
      // Tracking-Block erst hier, nach dem Cache-Put: das gecachte HTML bleibt ohne Pixel,
      // damit geänderte Einstellungen (Meta alle 60 s frisch) ohne Purge greifen.
      return new Response(finalizeHtml(renderedHtml, pathname, request, meta), {
        headers: htmlHeaders(),
      })

    } catch (err) {
      console.error('Worker error:', err)
      return new Response('Internal Server Error', { status: 500 })
    }
  },
}

// ─── Legal Page System ────────────────────────────────────────────────────────
// One entry per template domain. New template = add one object here.
// Legal text change = update once, deploy once. Zero R2 files needed.

interface LegalDesign {
  accent: string
  bg: string
  text: string
  muted: string
  faint: string
  divider: string
  boxBg: string
  boxBorder: string
  navBg: string
  font: string
  fontUrl: string | null
  logoHtml: string
  navHeight: number
}

const DEFAULT_LEGAL_DESIGN: LegalDesign = {
  accent: '#16a34a', bg: '#ffffff', text: '#111111', muted: '#444444',
  faint: '#888888', divider: '#f0f0f0', boxBg: '#f8fdf9', boxBorder: '#c8edd4',
  navBg: 'rgba(255,255,255,0.95)',
  font: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  fontUrl: null, logoHtml: 'FinestSites', navHeight: 56,
}

const LEGAL_DESIGNS: Record<string, LegalDesign> = {
  'dailyoptimal.de': {
    accent: '#5fcc8a', bg: '#ffffff', text: '#111111', muted: '#333333',
    faint: '#999999', divider: '#f0f0f0', boxBg: '#f8fdf9', boxBorder: '#c8edd4',
    navBg: 'rgba(255,255,255,0.95)',
    font: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif',
    fontUrl: null,
    logoHtml: 'Daily<span style="color:#5fcc8a">Optimal</span>', navHeight: 56,
  },
  'myevnt.io': {
    accent: '#7C3AED', bg: '#0A0A0A', text: '#FFFFFF', muted: 'rgba(255,255,255,0.75)',
    faint: 'rgba(255,255,255,0.35)', divider: 'rgba(255,255,255,0.07)',
    boxBg: 'rgba(124,58,237,0.07)', boxBorder: 'rgba(124,58,237,0.22)',
    navBg: 'rgba(10,10,10,0.85)',
    font: "'Geist',system-ui,-apple-system,sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap',
    logoHtml: 'My<span style="color:#7C3AED">Evnt</span>', navHeight: 56,
  },
  'lnko.me': {
    accent: '#0A0A0A', bg: '#ffffff', text: '#0A0A0A', muted: 'rgba(10,10,10,0.72)',
    faint: 'rgba(10,10,10,0.35)', divider: 'rgba(10,10,10,0.07)',
    boxBg: '#F7F7F7', boxBorder: 'rgba(10,10,10,0.09)',
    navBg: 'rgba(255,255,255,0.92)',
    font: "'Inter',system-ui,-apple-system,sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    logoHtml: 'lnko<span style="color:rgba(10,10,10,0.35)">.me</span>', navHeight: 52,
  },
  'womenplus.io': {
    accent: '#e11d48', bg: '#ffffff', text: '#111111', muted: '#444444',
    faint: '#888888', divider: '#f0f0f0', boxBg: '#fff1f2', boxBorder: '#fecdd3',
    navBg: 'rgba(255,255,255,0.95)',
    font: "'Inter',system-ui,-apple-system,sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    logoHtml: 'Women<span style="color:#e11d48">Plus</span>', navHeight: 56,
  },
  'vitalprofil.net': {
    accent: '#1F9D6B', bg: '#FFFFFF', text: '#1B1B19', muted: '#5A5B57',
    faint: '#8E8F8A', divider: '#E7E6E0', boxBg: '#F3F7F4', boxBorder: '#DCF1E6',
    navBg: 'rgba(255,255,255,0.92)',
    font: "'Geist',system-ui,-apple-system,sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap',
    logoHtml: 'Vital<span style="color:#1F9D6B">profil</span>', navHeight: 54,
  },
  'wellpreneur.io': {
    accent: '#2563EB', bg: '#ffffff', text: '#0A1120', muted: '#374151',
    faint: '#9CA3AF', divider: '#E5E7EB', boxBg: '#EFF6FF', boxBorder: '#BFDBFE',
    navBg: 'rgba(255,255,255,0.95)',
    font: "'Manrope',system-ui,-apple-system,sans-serif",
    fontUrl: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap',
    logoHtml: 'Well<span style="color:#2563EB">preneur</span>', navHeight: 56,
  },
}

function legalStyles(d: LegalDesign): string {
  return `<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:${d.bg};color:${d.text};font-family:${d.font};font-size:15px;line-height:1.75;min-height:100vh;display:flex;flex-direction:column;-webkit-font-smoothing:antialiased}
nav.top-nav{position:sticky;top:0;z-index:100;height:${d.navHeight}px;background:${d.navBg};backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid ${d.divider};display:flex;align-items:center;padding:0 24px}
.logo{font-size:17px;font-weight:700;color:${d.text};text-decoration:none;letter-spacing:-0.02em}
main{flex:1;width:100%;max-width:680px;margin:0 auto;padding:48px 24px 80px}
.back-link{display:inline-block;font-size:13px;color:${d.faint};text-decoration:none;margin-bottom:32px;transition:color 0.15s}
.back-link:hover{color:${d.muted}}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${d.accent};margin-bottom:12px}
h1{font-size:clamp(24px,4vw,34px);font-weight:800;color:${d.text};line-height:1.15;margin-bottom:8px;letter-spacing:-0.02em}
.page-subtitle{color:${d.muted};margin-bottom:48px}
hr.divider{border:none;border-top:1px solid ${d.divider};margin:40px 0}
h2{font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${d.faint};margin-bottom:16px}
p{color:${d.muted};margin-bottom:16px}
p:last-child{margin-bottom:0}
.highlight-box{background:${d.boxBg};border:1px solid ${d.boxBorder};border-radius:14px;padding:20px 24px;margin:16px 0 20px}
.highlight-box p{margin-bottom:4px;color:${d.muted}}
.highlight-box p:last-child{margin-bottom:0}
a{color:${d.accent};text-decoration:none}
a:hover{text-decoration:underline}
strong{color:${d.text}}
.footnote{font-size:13px;color:${d.faint};margin-top:48px}
html[data-lang="en"] .l-de,html[data-lang="de"] .l-en{display:none!important}
.legal-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:32px}
.legal-topbar .back-link{margin-bottom:0}
.lang-switch{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:9999px;background:${d.boxBg};border:1px solid ${d.boxBorder};flex-shrink:0}
.lang-opt{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:none;border-radius:9999px;background:transparent;color:${d.faint};font-family:inherit;font-size:12px;font-weight:700;letter-spacing:0.04em;cursor:pointer;transition:background 0.2s,color 0.2s}
.lang-opt svg{width:14px;height:14px;border-radius:50%;display:block;flex-shrink:0}
html[data-lang="de"] .lang-opt[data-lang="de"],html[data-lang="en"] .lang-opt[data-lang="en"]{background:${d.accent};color:#fff}
.binding-note{background:${d.boxBg};border:1px solid ${d.boxBorder};border-left:3px solid ${d.accent};border-radius:10px;padding:14px 18px;margin-bottom:40px;font-size:13px;color:${d.muted}}
footer{border-top:1px solid ${d.divider};padding:20px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
footer .copyright{font-size:13px;color:${d.faint}}
footer nav.foot-nav{display:flex;gap:20px}
footer nav.foot-nav a{font-size:13px;color:${d.faint};text-decoration:none;transition:color 0.15s}
footer nav.foot-nav a:hover{color:${d.muted}}
@media(max-width:480px){main{padding:32px 16px 64px}nav.top-nav{padding:0 16px}footer{padding:20px 16px;flex-direction:column;align-items:flex-start}}
</style>`
}

function legalHead(title: string, d: LegalDesign): string {
  const fontLink = d.fontUrl
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="${d.fontUrl}" rel="stylesheet">`
    : ''
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>${title}</title>
<script>(function(){var l;try{l=localStorage.getItem('fs-lang')}catch(e){}if(l!=='de'&&l!=='en'){l=(navigator.language||'de').toLowerCase().indexOf('de')===0?'de':'en'}document.documentElement.setAttribute('data-lang',l);document.documentElement.setAttribute('lang',l)})();</script>
${fontLink}
${legalStyles(d)}
</head>`
}

const FLAG_DE_SVG = `<svg viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="6.67" y="0" fill="#000"/><rect width="20" height="6.67" y="6.67" fill="#DD0000"/><rect width="20" height="6.66" y="13.34" fill="#FFCE00"/></svg>`
const FLAG_EN_SVG = `<svg viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" fill="#012169"/><path d="M0 0 L20 20 M20 0 L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0 L20 20 M20 0 L0 20" stroke="#C8102E" stroke-width="2"/><path d="M10 0 V20 M0 10 H20" stroke="#fff" stroke-width="6"/><path d="M10 0 V20 M0 10 H20" stroke="#C8102E" stroke-width="3.5"/></svg>`

function legalTopbarHtml(): string {
  return `<div class="legal-topbar">
<a class="back-link" href="/">&#8592; <span class="l-de">Zurück</span><span class="l-en">Back</span></a>
<div class="lang-switch" role="group" aria-label="Sprache / Language">
<button type="button" class="lang-opt" data-lang="de" onclick="fsSetLang('de')" aria-label="Deutsch">${FLAG_DE_SVG}<span>DE</span></button>
<button type="button" class="lang-opt" data-lang="en" onclick="fsSetLang('en')" aria-label="English">${FLAG_EN_SVG}<span>EN</span></button>
</div>
</div>`
}

function legalLangScript(titleDe: string, titleEn: string): string {
  return `<script>function fsSetLang(l){try{localStorage.setItem('fs-lang',l)}catch(e){}document.documentElement.setAttribute('data-lang',l);document.documentElement.setAttribute('lang',l);document.title=l==='en'?'${titleEn}':'${titleDe}'}
if(document.documentElement.getAttribute('data-lang')==='en'){document.title='${titleEn}'}</script>`
}

function legalFooterHtml(): string {
  return `<footer>
<span class="copyright">&copy; ${new Date().getFullYear()} FinestSites</span>
<nav class="foot-nav">
<a href="/"><span class="l-de">Startseite</span><span class="l-en">Home</span></a>
<a href="/datenschutz"><span class="l-de">Datenschutz</span><span class="l-en">Privacy</span></a>
<a href="/impressum"><span class="l-de">Impressum</span><span class="l-en">Legal notice</span></a>
</nav>
</footer>`
}

function renderImpressum(d: LegalDesign): string {
  return `${legalHead('Impressum', d)}
<body>
<nav class="top-nav"><a class="logo" href="/">${d.logoHtml}</a></nav>
<main>
${legalTopbarHtml()}
<div class="l-de">
<div class="eyebrow">Rechtliches</div>
<h1>Impressum</h1>
<p class="page-subtitle">Angaben gem\u00E4\u00DF \u00A7 5 TMG</p>

<section>
<h2>Betreiber und Diensteanbieter</h2>
<p>Diese Website wird technisch betrieben und als Dienstleistung bereitgestellt durch:</p>
<div class="highlight-box">
<p><strong>Daniel Kurzeja &ndash; FinestSites</strong></p>
<p>Herrleinstr. 39</p>
<p>97437 Ha\u00DFfurt</p>
<p>Deutschland</p>
<p>Telefon: <a href="tel:+4915151005561">+49 151 51005561</a></p>
<p>E-Mail: <a href="mailto:hello@finestsites.io">hello@finestsites.io</a></p>
<p>USt-IdNr.: DE369220308</p>
</div>
<p>FinestSites stellt die technische Plattform bereit und ist Verantwortlicher im Sinne des \u00A7 5 TMG.</p>
</section>

<hr class="divider">

<section>
<h2>Inhaltlich verantwortlich (\u00A7 18 Abs. 2 MStV)</h2>
<div class="highlight-box">
<p><strong>Daniel Kurzeja &ndash; FinestSites</strong></p>
<p>Herrleinstr. 39, 97437 Ha\u00DFfurt, Deutschland</p>
</div>
<p>FinestSites ist inhaltlich verantwortlich f\u00FCr die auf dieser Website bereitgestellten Plattforminhalte (Struktur, Design, Texte).</p>
</section>

<hr class="divider">

<section>
<h2>Nutzergenerierte Inhalte</h2>
{{#unless partner_modus=duo}}<p>Diese Website wird im Rahmen des FinestSites-Dienstleistungsangebots f\u00FCr folgende Person betrieben:</p>{{/unless}}{{#if partner_modus=duo}}<p>Diese Website wird im Rahmen des FinestSites-Dienstleistungsangebots f\u00FCr folgende Personen betrieben:</p>{{/if}}
<div class="highlight-box">
{{#unless partner_modus=duo}}<p><strong>{{vorname}} {{nachname}}</strong></p>{{/unless}}{{#if partner_modus=duo}}<p><strong>{{vorname}} {{nachname}} &amp; {{vorname2}} {{nachname2}}</strong></p>{{/if}}
</div>
{{#unless partner_modus=duo}}<p>F\u00FCr eigene nutzergenerierte Inhalte dieser Person &ndash; insbesondere pers\u00F6nliche Erfahrungsberichte, Fotos und selbst hochgeladene Medien &ndash; ist {{vorname}} {{nachname}} gem\u00E4\u00DF \u00A7 7 Abs. 1 TMG selbst verantwortlich. FinestSites ist nicht verpflichtet, diese Inhalte vorab zu pr\u00FCfen.</p>{{/unless}}{{#if partner_modus=duo}}<p>F\u00FCr eigene nutzergenerierte Inhalte dieser Personen &ndash; insbesondere pers\u00F6nliche Erfahrungsberichte, Fotos und selbst hochgeladene Medien &ndash; sind {{vorname}} {{nachname}} und {{vorname2}} {{nachname2}} gem\u00E4\u00DF \u00A7 7 Abs. 1 TMG selbst verantwortlich. FinestSites ist nicht verpflichtet, diese Inhalte vorab zu pr\u00FCfen.</p>{{/if}}
</section>

<hr class="divider">

<section>
<h2>Haftung f\u00FCr Inhalte</h2>
<p>Als Diensteanbieter sind wir gem\u00E4\u00DF \u00A7 7 Abs. 1 TMG f\u00FCr eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach \u00A7\u00A7 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, \u00FCbermittelte oder gespeicherte fremde Informationen zu \u00FCberwachen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unber\u00FChrt. Eine diesbez\u00FCgliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung m\u00F6glich. Bei Bekanntwerden von Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.</p>
</section>

<hr class="divider">

<section>
<h2>Haftung f\u00FCr Links</h2>
<p>Unser Angebot kann Links zu externen Websites Dritter enthalten, auf deren Inhalte wir keinen Einfluss haben. F\u00FCr die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf m\u00F6gliche Rechtsverst\u00F6\u00DFe \u00FCberpr\u00FCft. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.</p>
</section>

<hr class="divider">

<section>
<h2>Urheberrecht</h2>
<p>Die durch FinestSites / Daniel Kurzeja erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Downloads und Kopien dieser Seite sind nur f\u00FCr den privaten, nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.</p>
</section>

<hr class="divider">

<section>
<h2>EU-Streitschlichtung</h2>
<p>Die Europ\u00E4ische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a>. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
</section>

<p class="footnote">Stand: Juli 2026</p>
</div>

<div class="l-en">
<div class="eyebrow">Legal</div>
<h1>Legal Notice</h1>
<p class="page-subtitle">Information pursuant to Section 5 of the German Telemedia Act (TMG)</p>
<div class="binding-note">This is a courtesy translation. The German version is legally binding.</div>

<section>
<h2>Operator and service provider</h2>
<p>This website is technically operated and provided as a service by:</p>
<div class="highlight-box">
<p><strong>Daniel Kurzeja &ndash; FinestSites</strong></p>
<p>Herrleinstr. 39</p>
<p>97437 Haßfurt</p>
<p>Germany</p>
<p>Phone: <a href="tel:+4915151005561">+49 151 51005561</a></p>
<p>Email: <a href="mailto:hello@finestsites.io">hello@finestsites.io</a></p>
<p>VAT ID: DE369220308</p>
</div>
<p>FinestSites provides the technical platform and is the responsible party within the meaning of Section 5 TMG.</p>
</section>

<hr class="divider">

<section>
<h2>Editorially responsible (Section 18 (2) MStV)</h2>
<div class="highlight-box">
<p><strong>Daniel Kurzeja &ndash; FinestSites</strong></p>
<p>Herrleinstr. 39, 97437 Haßfurt, Germany</p>
</div>
<p>FinestSites is editorially responsible for the platform content provided on this website (structure, design, texts).</p>
</section>

<hr class="divider">

<section>
<h2>User-generated content</h2>
{{#unless partner_modus=duo}}<p>This website is operated as part of the FinestSites service offering for the following person:</p>{{/unless}}{{#if partner_modus=duo}}<p>This website is operated as part of the FinestSites service offering for the following persons:</p>{{/if}}
<div class="highlight-box">
{{#unless partner_modus=duo}}<p><strong>{{vorname}} {{nachname}}</strong></p>{{/unless}}{{#if partner_modus=duo}}<p><strong>{{vorname}} {{nachname}} &amp; {{vorname2}} {{nachname2}}</strong></p>{{/if}}
</div>
{{#unless partner_modus=duo}}<p>For their own user-generated content, in particular personal testimonials, photos and self-uploaded media, {{vorname}} {{nachname}} is personally responsible in accordance with Section 7 (1) TMG. FinestSites is not obliged to review this content in advance.</p>{{/unless}}{{#if partner_modus=duo}}<p>For their own user-generated content, in particular personal testimonials, photos and self-uploaded media, {{vorname}} {{nachname}} and {{vorname2}} {{nachname2}} are personally responsible in accordance with Section 7 (1) TMG. FinestSites is not obliged to review this content in advance.</p>{{/if}}
</section>

<hr class="divider">

<section>
<h2>Liability for content</h2>
<p>As a service provider, we are responsible for our own content on these pages under general law in accordance with Section 7 (1) TMG. However, under Sections 8 to 10 TMG we are not obliged to monitor transmitted or stored third-party information. Obligations to remove or block the use of information under general law remain unaffected. Any such liability only arises from the moment we become aware of a specific legal violation. Upon becoming aware of such violations, we will remove the content in question immediately.</p>
</section>

<hr class="divider">

<section>
<h2>Liability for links</h2>
<p>Our website may contain links to external third-party websites over whose content we have no control. The respective provider or operator is always responsible for the content of linked pages. The linked pages were checked for possible legal violations at the time of linking. Upon becoming aware of legal violations, we will remove such links immediately.</p>
</section>

<hr class="divider">

<section>
<h2>Copyright</h2>
<p>The content and works created by FinestSites / Daniel Kurzeja on these pages are subject to German copyright law. Downloads and copies of this page are only permitted for private, non-commercial use. Where content on this page was not created by the operator, third-party copyrights are respected. Upon becoming aware of legal violations, we will remove such content immediately.</p>
</section>

<hr class="divider">

<section>
<h2>EU dispute resolution</h2>
<p>The European Commission provides a platform for online dispute resolution (ODR): <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a>. We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.</p>
</section>

<p class="footnote">Last updated: July 2026</p>
</div>
${legalLangScript('Impressum', 'Legal Notice')}
</main>
${legalFooterHtml()}
</body>
</html>`
}

/**
 * Vitalprofil (vitalprofil.net): the visitor answers 20 statements about daily habits. Evaluated
 * in the browser; sent only when the visitor submits the form with explicit consent. Because habit
 * data can count as health data (CJEU C-21/23), the section names Art. 9 (2) (a) and the categories.
 */
function vitalprofilSectionDe(): string {
  return `<section>
<h2>Vitalprofil (Selbsteinsch\u00E4tzung zu Alltagsgewohnheiten)</h2>
<p>Auf dieser Seite k\u00F6nnen Sie ein Vitalprofil erstellen: 20 Aussagen zu Ihren Alltagsgewohnheiten (Ern\u00E4hrung und Trinken, Tagesstruktur und Pausen, Schlaf und Abschalten, Bewegung, Ausgleich), optional Ihre W\u00FCnsche, Antriebsmotive und ein Tagesbudget. Die Auswertung erfolgt vollst\u00E4ndig in Ihrem Browser. Solange Sie Ihr Ergebnis nicht aktiv absenden, werden keine Antworten gespeichert oder \u00FCbertragen; der Zwischenstand liegt nur im Sitzungsspeicher Ihres Browsers und wird beim Schlie\u00DFen des Tabs gel\u00F6scht.</p>
<p>Wenn Sie am Ende das Formular \u201EBeratung anfragen\u201C absenden, werden Ihre Kontaktdaten (Name, E-Mail-Adresse, optional Telefonnummer, bevorzugter Kontaktweg, Nachricht) zusammen mit Ihren 20 Antworten, dem ermittelten Vital-Typ, Ihren W\u00FCnschen und Antriebsmotiven verschl\u00FCsselt an die FinestSites-Server \u00FCbertragen, im gesicherten Dashboard der betreibenden Person gespeichert und ihr per E-Mail zugestellt. Angaben zu Ihren Gewohnheiten k\u00F6nnen als Gesundheitsdaten im Sinne von Art. 9 DSGVO gelten. Die Verarbeitung erfolgt daher ausschlie\u00DFlich auf Grundlage Ihrer ausdr\u00FCcklichen Einwilligung (Art. 6 Abs. 1 lit. a und Art. 9 Abs. 2 lit. a DSGVO), die Sie im Formular per H\u00E4kchen erteilen. Zeitpunkt und Wortlaut der Einwilligung werden mitgespeichert.</p>
<p>Zweck ist ausschlie\u00DFlich die von Ihnen angefragte pers\u00F6nliche Beratung durch die betreibende Person. Die Daten werden nicht an Dritte weitergegeben und nicht f\u00FCr Newsletter oder Werbung verwendet. FinestSites verarbeitet die Daten als Auftragsverarbeiter (Art. 28 DSGVO) im Auftrag der betreibenden Person. Sie k\u00F6nnen Ihre Einwilligung jederzeit mit Wirkung f\u00FCr die Zukunft widerrufen und die L\u00F6schung verlangen, per E-Mail an die im Impressum genannte Adresse. Die Daten werden gel\u00F6scht, sobald die Beratung abgeschlossen ist und keine gesetzliche Aufbewahrungspflicht entgegensteht.</p>
<p>Das Vitalprofil ist eine Selbsteinsch\u00E4tzung Ihrer Gewohnheiten. Es stellt keine Diagnose, ersetzt keine \u00E4rztliche Beratung und enth\u00E4lt keine Produktempfehlung.</p>
</section>

<hr class="divider">

`
}
function vitalprofilSectionEn(): string {
  return `<section>
<h2>Vital profile (self-assessment of everyday habits)</h2>
<p>On this site you can create a vital profile: 20 statements about your everyday habits (food and hydration, daily structure and breaks, sleep and winding down, movement, balance), optionally your wishes, motives and a daily budget. The evaluation takes place entirely in your browser. Unless you actively submit your result, no answers are stored or transmitted; the interim state is kept only in your browser's session storage and is deleted when the tab is closed.</p>
<p>If you submit the \u201CRequest consultation\u201D form at the end, your contact details (name, email address, optionally phone number, preferred contact method, message) are transmitted in encrypted form to the FinestSites servers together with your 20 answers, the determined vitality type, your wishes and motives, stored in the operator's secured dashboard and delivered to the operator by email. Information about your habits may constitute health data within the meaning of Art. 9 GDPR. Processing therefore takes place exclusively on the basis of your explicit consent (Art. 6 (1) (a) and Art. 9 (2) (a) GDPR), which you give by ticking the box in the form. The time and wording of the consent are stored as well.</p>
<p>The sole purpose is the personal consultation you requested from the operator. The data is not shared with third parties and not used for newsletters or advertising. FinestSites processes the data as a processor (Art. 28 GDPR) on behalf of the operator. You can withdraw your consent at any time with effect for the future and request deletion by emailing the address given in the legal notice. The data is deleted once the consultation has been completed and no statutory retention obligation applies.</p>
<p>The vital profile is a self-assessment of your habits. It does not constitute a diagnosis, does not replace medical advice and contains no product recommendation.</p>
</section>

<hr class="divider">

`
}

function renderDatenschutz(d: LegalDesign, domain = '', tracking?: PublicTrackingConfig): string {
  const vital = domain === 'vitalprofil.net'
  return `${legalHead('Datenschutzerkl\u00E4rung', d)}
<body>
<nav class="top-nav"><a class="logo" href="/">${d.logoHtml}</a></nav>
<main>
${legalTopbarHtml()}
<div class="l-de">
<div class="eyebrow">Rechtliches</div>
<h1>Datenschutz&shy;erkl\u00E4rung</h1>
<p class="page-subtitle">Informationen gem\u00E4\u00DF Art. 13 DSGVO</p>

<section>
<h2>Verantwortlicher (Art. 4 Nr. 7 DSGVO)</h2>
<div class="highlight-box">
<p><strong>Daniel Kurzeja &ndash; FinestSites</strong></p>
<p>Herrleinstr. 39</p>
<p>97437 Ha\u00DFfurt</p>
<p>Deutschland</p>
<p>E-Mail: <a href="mailto:hello@finestsites.io">hello@finestsites.io</a></p>
<p>Telefon: <a href="tel:+4915151005561">+49 151 51005561</a></p>
</div>
</section>

<hr class="divider">

<section>
<h2>Hosting &amp; Infrastruktur</h2>
<p>Diese Website wird \u00FCber die FinestSites-Plattform betrieben. Die technische Infrastruktur liegt auf Servern in der EU (Hetzner Online GmbH, Deutschland). Beim Abruf der Website werden durch den Browser automatisch folgende Daten \u00FCbermittelt: IP-Adresse, Datum und Uhrzeit, aufgerufene URL, Browser und Betriebssystem. Diese Daten werden ausschlie\u00DFlich zur technischen Bereitstellung der Website verarbeitet und nicht dauerhaft gespeichert (Art. 6 Abs. 1 lit. f DSGVO).</p>
</section>

<hr class="divider">

${privacySectionDe(tracking)}

<hr class="divider">

${vital ? vitalprofilSectionDe() : ''}<section>
<h2>Kontaktformular</h2>
<p>Wenn Sie das Kontaktformular auf dieser Seite nutzen, werden Ihre Angaben (z.\u202FB. Name, E-Mail-Adresse, Nachricht) verschl\u00FCsselt an die FinestSites-Server \u00FCbertragen und in unserem gesicherten Dashboard gespeichert. Sie werden ausschlie\u00DFlich zur Bearbeitung Ihrer Anfrage verwendet und nicht an Dritte weitergegeben.</p>
<p>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung) bzw. Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Beantwortung von Anfragen). Die Daten werden gel\u00F6scht, sobald Ihre Anfrage abschlie\u00DFend bearbeitet wurde und keine gesetzliche Aufbewahrungspflicht entgegensteht.</p>
</section>

<hr class="divider">

<section>
<h2>Eingebettete Inhalte</h2>
<p>Diese Website kann eingebettete Inhalte (z.\u202FB. Schriftarten von Google Fonts) enthalten. Beim Laden dieser Inhalte wird Ihre IP-Adresse an den jeweiligen Anbieter \u00FCbertragen. Dies geschieht auf Basis von Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem einwandfrei funktionierenden Erscheinungsbild der Website).</p>
</section>

<hr class="divider">

<section>
<h2>Ihre Rechte</h2>
<p><strong>Auskunft</strong> (Art. 15 DSGVO) &ndash; Sie k\u00F6nnen Auskunft \u00FCber die von uns verarbeiteten Daten verlangen.</p>
<p><strong>Berichtigung</strong> (Art. 16 DSGVO) &ndash; Sie k\u00F6nnen die Berichtigung unrichtiger Daten verlangen.</p>
<p><strong>L\u00F6schung</strong> (Art. 17 DSGVO) &ndash; Sie k\u00F6nnen die L\u00F6schung Ihrer Daten verlangen, sofern keine gesetzliche Aufbewahrungspflicht besteht.</p>
<p><strong>Einschr\u00E4nkung</strong> (Art. 18 DSGVO) &ndash; Sie k\u00F6nnen die Einschr\u00E4nkung der Verarbeitung verlangen.</p>
<p><strong>Widerspruch</strong> (Art. 21 DSGVO) &ndash; Sie k\u00F6nnen der Verarbeitung auf Basis berechtigter Interessen widersprechen.</p>
<p><strong>Daten\u00FCbertragbarkeit</strong> (Art. 20 DSGVO) &ndash; Sie k\u00F6nnen Ihre Daten in einem strukturierten, maschinenlesbaren Format erhalten.</p>
<p>Zur Aus\u00FCbung Ihrer Rechte wenden Sie sich an: <a href="mailto:hello@finestsites.io">hello@finestsites.io</a></p>
</section>

<hr class="divider">

<section>
<h2>Beschwerderecht</h2>
<p>Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbeh\u00F6rde zu beschweren. Zust\u00E4ndig ist das Bayerische Landesamt f\u00FCr Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach, <a href="https://www.lda.bayern.de" target="_blank" rel="noopener noreferrer">www.lda.bayern.de</a>.</p>
</section>

<hr class="divider">

<section>
<h2>EU-Streitschlichtung</h2>
<p>Die Europ\u00E4ische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a>. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
</section>

<p class="footnote">Stand: Juli 2026</p>
</div>

<div class="l-en">
<div class="eyebrow">Legal</div>
<h1>Privacy Policy</h1>
<p class="page-subtitle">Information pursuant to Art. 13 GDPR</p>
<div class="binding-note">This is a courtesy translation. The German version is legally binding.</div>

<section>
<h2>Controller (Art. 4 No. 7 GDPR)</h2>
<div class="highlight-box">
<p><strong>Daniel Kurzeja &ndash; FinestSites</strong></p>
<p>Herrleinstr. 39</p>
<p>97437 Haßfurt</p>
<p>Germany</p>
<p>Email: <a href="mailto:hello@finestsites.io">hello@finestsites.io</a></p>
<p>Phone: <a href="tel:+4915151005561">+49 151 51005561</a></p>
</div>
</section>

<hr class="divider">

<section>
<h2>Hosting &amp; infrastructure</h2>
<p>This website is operated on the FinestSites platform. The technical infrastructure runs on servers within the EU (Hetzner Online GmbH, Germany). When you visit the website, your browser automatically transmits the following data: IP address, date and time, requested URL, browser and operating system. This data is processed solely to technically deliver the website and is not stored permanently (Art. 6 (1) (f) GDPR).</p>
</section>

<hr class="divider">

${privacySectionEn(tracking)}

<hr class="divider">

${vital ? vitalprofilSectionEn() : ''}<section>
<h2>Contact form</h2>
<p>If you use the contact form on this site, your details (e.g. name, email address, message) are transmitted to the FinestSites servers in encrypted form and stored in our secured dashboard. They are used exclusively to process your inquiry and are not shared with third parties.</p>
<p>Legal basis: Art. 6 (1) (b) GDPR (steps prior to entering into a contract) or Art. 6 (1) (f) GDPR (legitimate interest in responding to inquiries). The data is deleted once your inquiry has been fully processed and no statutory retention obligation applies.</p>
</section>

<hr class="divider">

<section>
<h2>Embedded content</h2>
<p>This website may contain embedded content (e.g. fonts from Google Fonts). When this content is loaded, your IP address is transmitted to the respective provider. This is done on the basis of Art. 6 (1) (f) GDPR (legitimate interest in a properly functioning appearance of the website).</p>
</section>

<hr class="divider">

<section>
<h2>Your rights</h2>
<p><strong>Access</strong> (Art. 15 GDPR): you can request information about the data we process.</p>
<p><strong>Rectification</strong> (Art. 16 GDPR): you can request the correction of inaccurate data.</p>
<p><strong>Erasure</strong> (Art. 17 GDPR): you can request the deletion of your data, provided no statutory retention obligation applies.</p>
<p><strong>Restriction</strong> (Art. 18 GDPR): you can request that processing be restricted.</p>
<p><strong>Objection</strong> (Art. 21 GDPR): you can object to processing based on legitimate interests.</p>
<p><strong>Data portability</strong> (Art. 20 GDPR): you can receive your data in a structured, machine-readable format.</p>
<p>To exercise your rights, contact: <a href="mailto:hello@finestsites.io">hello@finestsites.io</a></p>
</section>

<hr class="divider">

<section>
<h2>Right to lodge a complaint</h2>
<p>You have the right to lodge a complaint with a data protection supervisory authority. The competent authority is the Bavarian State Office for Data Protection Supervision (BayLDA), Promenade 18, 91522 Ansbach, Germany, <a href="https://www.lda.bayern.de" target="_blank" rel="noopener noreferrer">www.lda.bayern.de</a>.</p>
</section>

<hr class="divider">

<section>
<h2>EU dispute resolution</h2>
<p>The European Commission provides a platform for online dispute resolution (ODR): <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a>. We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.</p>
</section>

<p class="footnote">Last updated: July 2026</p>
</div>
${legalLangScript('Datenschutzerklärung', 'Privacy Policy')}
</main>
${legalFooterHtml()}
</body>
</html>`
}

// ─── HTML Templates ───────────────────────────────────────────────────────────

const LOGO_BLACK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620.04 126"><defs><style>.cls-1{fill:#1a1a1a;}</style></defs><g><g><path class="cls-1" d="M82.71,34.42A9.75,9.75,0,0,1,73,24.7a9.5,9.5,0,0,1,2.85-6.91,9.56,9.56,0,0,1,11.77-1.54,10.79,10.79,0,0,1,3.63,3.54A9.13,9.13,0,0,1,92.6,24.7a9.29,9.29,0,0,1-2.9,6.86A9.57,9.57,0,0,1,82.71,34.42Z"/><rect class="cls-1" x="75.12" y="45.18" width="14.84" height="70.01"/><path class="cls-1" d="M137.84,43.13A32.81,32.81,0,0,1,151.27,46,25.08,25.08,0,0,1,162,55.2q4.22,6.25,4.22,16.33v43.66h-15V74.43q0-10.41-4.86-15.14a17.19,17.19,0,0,0-12.53-4.73,18.25,18.25,0,0,0-9.68,2.85,22.7,22.7,0,0,0-7.63,7.85,21.56,21.56,0,0,0-3,11.3v38.63H98.7v-70h14.83V57.63c.51-1.94,1.91-4,4.18-6.31a28.8,28.8,0,0,1,8.7-5.8A27.44,27.44,0,0,1,137.84,43.13Z"/><path class="cls-1" d="M238.89,59.59A29.91,29.91,0,0,0,227,47.44a35.87,35.87,0,0,0-17.94-4.31q-11.26,0-19.23,4.78a31.45,31.45,0,0,0-12.15,13,40.18,40.18,0,0,0-4.18,18.46A42,42,0,0,0,178,99a32.52,32.52,0,0,0,12.66,13.4q8.22,4.8,19.48,4.81a51.58,51.58,0,0,0,14.16-1.67,29.31,29.31,0,0,0,9.85-4.73,31.05,31.05,0,0,0,6.86-7.16l-7.25-9a23.13,23.13,0,0,1-4.18,4.81,25.1,25.1,0,0,1-7.46,4.61A28.43,28.43,0,0,1,211,106.06,25.23,25.23,0,0,1,198.13,103a20.07,20.07,0,0,1-7.89-8.28,25.9,25.9,0,0,1-2.73-11.52h55.34c.06-.45.11-1.25.18-2.42s.08-2,.08-2.43Q243.11,67.44,238.89,59.59ZM188,72a21.81,21.81,0,0,1,2.47-7.89,18.34,18.34,0,0,1,6.71-7c3-1.93,7.06-2.91,12.05-2.91,4.84,0,8.68,1,11.52,3A17.79,17.79,0,0,1,227,64.36,20,20,0,0,1,229,72Z"/><path class="cls-1" d="M276.91,43.13a44.51,44.51,0,0,1,10.19,1.11,46.45,46.45,0,0,1,8.19,2.64,23.35,23.35,0,0,1,4.9,2.73L294.31,59a24.36,24.36,0,0,0-6.14-3.45,24.68,24.68,0,0,0-9.89-1.92A20.48,20.48,0,0,0,268.13,56,7.4,7.4,0,0,0,264,62.74c0,3,1.44,5.3,4.31,7a40.47,40.47,0,0,0,11.55,4.3,59.08,59.08,0,0,1,10.87,3.67,21.42,21.42,0,0,1,8.23,6.35q3.15,4.05,3.16,10.79a20.09,20.09,0,0,1-2.56,10.45,19.6,19.6,0,0,1-6.91,6.9,32.52,32.52,0,0,1-9.72,3.8A50.51,50.51,0,0,1,272,117.23a47.64,47.64,0,0,1-11.69-1.32,41.43,41.43,0,0,1-8.74-3.15,29.86,29.86,0,0,1-5.16-3.2L252.27,99a28.16,28.16,0,0,0,7.29,4.52,26.68,26.68,0,0,0,11.55,2.39q7.17,0,11.6-3A9.15,9.15,0,0,0,287.14,95,8.15,8.15,0,0,0,285,89.09a15.43,15.43,0,0,0-5.71-3.58,65.15,65.15,0,0,0-7.85-2.39,55.26,55.26,0,0,1-8-2.47,29.65,29.65,0,0,1-7.08-4,18.1,18.1,0,0,1-5.07-6,17.52,17.52,0,0,1-1.88-8.32A15,15,0,0,1,253.29,52a24.68,24.68,0,0,1,10.06-6.61A38.91,38.91,0,0,1,276.91,43.13Z"/><path class="cls-1" d="M305.46,45.18h13.73V15.06H334V45.18h18v12.7H334V92.5q0,6.15,2.17,9a6.94,6.94,0,0,0,5.84,2.9,9.06,9.06,0,0,0,5-1.19c1.2-.8,3.64-2.31,3.87-2.6l5.52,11c-.34.28-2.62,1.68-4.1,2.47a26.45,26.45,0,0,1-5.71,2.13,31.64,31.64,0,0,1-8.19.94,19.6,19.6,0,0,1-13.69-5q-5.49-5-5.5-15.81V57.88H305.46Z"/><path class="cls-1" d="M391.62,43.13a44.58,44.58,0,0,1,10.19,1.11A46.6,46.6,0,0,1,410,46.88a23.22,23.22,0,0,1,4.91,2.73L409,59a24,24,0,0,0-6.14-3.45A24.61,24.61,0,0,0,393,53.62,20.44,20.44,0,0,0,382.84,56a7.4,7.4,0,0,0-4.18,6.78c0,3,1.43,5.3,4.3,7a40.55,40.55,0,0,0,11.56,4.3,59.34,59.34,0,0,1,10.87,3.67,21.49,21.49,0,0,1,8.23,6.35q3.15,4.05,3.15,10.79a20.18,20.18,0,0,1-2.55,10.45,19.6,19.6,0,0,1-6.91,6.9,32.52,32.52,0,0,1-9.72,3.8,50.53,50.53,0,0,1-10.92,1.19A47.56,47.56,0,0,1,375,115.91a41.22,41.22,0,0,1-8.74-3.15,29.86,29.86,0,0,1-5.16-3.2L367,99a27.81,27.81,0,0,0,7.29,4.52,26.68,26.68,0,0,0,11.55,2.39q7.17,0,11.6-3A9.17,9.17,0,0,0,401.85,95a8.15,8.15,0,0,0-2.13-5.89A15.52,15.52,0,0,0,394,85.51a65.71,65.71,0,0,0-7.85-2.39,54.5,54.5,0,0,1-8-2.47,29.46,29.46,0,0,1-7.08-4,18.1,18.1,0,0,1-5.07-6,17.52,17.52,0,0,1-1.88-8.32A15,15,0,0,1,368,52a24.68,24.68,0,0,1,10.06-6.61A38.91,38.91,0,0,1,391.62,43.13Z"/><path class="cls-1" d="M430.83,34.42a9.75,9.75,0,0,1-9.72-9.72A9.5,9.5,0,0,1,424,17.79a9.56,9.56,0,0,1,11.77-1.54,10.79,10.79,0,0,1,3.63,3.54,9.13,9.13,0,0,1,1.36,4.91,9.29,9.29,0,0,1-2.9,6.86A9.57,9.57,0,0,1,430.83,34.42Z"/><rect class="cls-1" x="423.24" y="45.18" width="14.84" height="70.01"/><path class="cls-1" d="M444.58,45.18h13.73V15.06h14.75V45.18h18v12.7h-18V92.5q0,6.15,2.17,9a6.94,6.94,0,0,0,5.84,2.9,9.06,9.06,0,0,0,5-1.19,12.8,12.8,0,0,0,2.14-1.62l5.88,10.91a20.28,20.28,0,0,1-2.73,1.62,26.45,26.45,0,0,1-5.71,2.13,31.59,31.59,0,0,1-8.19.94,19.56,19.56,0,0,1-13.68-5q-5.51-5-5.5-15.81V57.88H444.58Z"/><path class="cls-1" d="M557.46,59.59A29.91,29.91,0,0,0,545.6,47.44a35.89,35.89,0,0,0-18-4.31q-11.25,0-19.23,4.78a31.52,31.52,0,0,0-12.15,13,40.3,40.3,0,0,0-4.18,18.46A42.09,42.09,0,0,0,496.53,99a32.61,32.61,0,0,0,12.67,13.4q8.2,4.8,19.47,4.81a51.4,51.4,0,0,0,14.15-1.67,29,29,0,0,0,9.85-4.73,30.48,30.48,0,0,0,6.87-7.16l-7.24-9a23.44,23.44,0,0,1-4.18,4.81,25.23,25.23,0,0,1-7.46,4.61,28.5,28.5,0,0,1-11,1.92A25.2,25.2,0,0,1,516.7,103a20.07,20.07,0,0,1-7.89-8.28,25.64,25.64,0,0,1-2.73-11.52h55.34c.05-.45.11-1.25.18-2.42s.08-2,.08-2.43Q561.68,67.44,557.46,59.59ZM506.59,72a21.42,21.42,0,0,1,2.47-7.89,18.31,18.31,0,0,1,6.7-7c3-1.93,7.06-2.91,12.06-2.91,4.84,0,8.67,1,11.52,3a17.84,17.84,0,0,1,6.17,7.16,19.88,19.88,0,0,1,2,7.68Z"/><path class="cls-1" d="M594.89,43.13a44.64,44.64,0,0,1,10.19,1.11,46.6,46.6,0,0,1,8.18,2.64,23.09,23.09,0,0,1,4.9,2.73L612.28,59a24.17,24.17,0,0,0-6.14-3.45,24.64,24.64,0,0,0-9.89-1.92A20.5,20.5,0,0,0,586.1,56a7.42,7.42,0,0,0-4.18,6.78c0,3,1.44,5.3,4.31,7a40.47,40.47,0,0,0,11.55,4.3,59.44,59.44,0,0,1,10.88,3.67,21.57,21.57,0,0,1,8.23,6.35Q620,88.15,620,94.89a20.09,20.09,0,0,1-2.56,10.45,19.57,19.57,0,0,1-6.9,6.9,32.48,32.48,0,0,1-9.73,3.8,50.51,50.51,0,0,1-10.91,1.19,47.5,47.5,0,0,1-11.68-1.32,41.22,41.22,0,0,1-8.74-3.15,29.86,29.86,0,0,1-5.16-3.2L570.24,99a28.16,28.16,0,0,0,7.29,4.52,26.73,26.73,0,0,0,11.56,2.39q7.15,0,11.59-3A9.16,9.16,0,0,0,605.12,95,8.15,8.15,0,0,0,603,89.09a15.48,15.48,0,0,0-5.72-3.58,65,65,0,0,0-7.84-2.39,55,55,0,0,1-8-2.47,29.58,29.58,0,0,1-7.07-4,18.13,18.13,0,0,1-5.08-6,17.52,17.52,0,0,1-1.87-8.32A15.08,15.08,0,0,1,571.26,52a24.71,24.71,0,0,1,10.07-6.61A38.91,38.91,0,0,1,594.89,43.13Z"/><path class="cls-1" d="M18.33,126a18.31,18.31,0,0,1-9.26-2.58c-6.17-3.73-9.36-10.86-9-17.94C.87,85.92,14.13,77.23,28.63,71.84c-.06-2.72-.13-5.61-.21-8.9A59.28,59.28,0,0,1,1,64.07L3.75,50.56a46.28,46.28,0,0,0,24.32-2c-.07-3.32-.14-6.67-.19-10,0-1.3-.07-2.62-.12-4-.23-6.6-.49-14.08,2-21.06C32.77,5,40.25-.32,48.8,0S64.16,6.18,66.48,14.88c2.45,9.17-1,17.83-4.32,23.48a52.69,52.69,0,0,1-20.09,19c.09,3.38.17,6.76.26,10.14a88,88,0,0,0,14.31-5.26q2.56-1.24,5-2.69,2.59,4.47,5.21,8.9l1.76,3a84.83,84.83,0,0,1-21.4,9c-1.57.45-3.09.89-4.56,1.33.09,3.45.19,7.11.32,11.45.31,10.12-2.9,22.3-11.48,28.5A22.28,22.28,0,0,1,18.33,126ZM29,86.59c-9.35,4.18-14.77,9.59-15.2,19.49-.1,2.34.65,4.53,1.88,5.42a4.81,4.81,0,0,0,3.19.72c8.6-.72,10.52-12.46,10.33-18.56C29.13,91.1,29.06,88.78,29,86.59Zm19.08-72.8c-1.87,0-4.2,1.14-5.34,4.37-1.6,4.51-1.39,10.33-1.19,16,.05,1.43.1,2.84.12,4.22,0,.91,0,1.83,0,2.74a36.14,36.14,0,0,0,8.55-9.72c1.63-2.77,4.17-8.12,2.89-12.91-.77-2.86-2.55-4.56-4.9-4.65Z"/></g></g></svg>`

function sharedStyles(): string {
  return `<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem}
.card{background:#fff;border-radius:24px;padding:2.5rem 2rem 2rem;max-width:420px;width:100%;text-align:center;box-shadow:0 2px 16px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.04)}
.logo-wrap{margin-bottom:1.75rem}
.logo-wrap a{display:inline-block}
.logo-svg{height:26px;width:auto;display:block}
.sep{height:1px;background:#F1F5F9;margin:0 0 1.75rem}
.icon-wrap{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.1rem}
h1{font-size:1.2rem;font-weight:700;color:#111;margin-bottom:.4rem;letter-spacing:-0.02em}
.url{display:inline-block;background:#F8FAFC;color:#64748B;font-family:ui-monospace,SFMono-Regular,monospace;font-size:.72rem;padding:.2rem .65rem;border-radius:6px;margin:.6rem 0 .9rem;border:1px solid #E2E8F0}
p{color:#6B7280;font-size:.85rem;line-height:1.65;margin-bottom:1.5rem}
.cta{display:inline-flex;align-items:center;gap:7px;padding:.65rem 1.4rem;background:#1a1a1a;color:#fff;border-radius:12px;text-decoration:none;font-weight:600;font-size:.85rem}
.cta:hover{background:#333}
.footer{margin-top:1.5rem;font-size:.72rem;color:#CBD5E1}
.footer a{color:#94A3B8;text-decoration:none}
/* 404-specific */
.card-nf{padding:0;overflow:hidden}
.card-nf video{width:100%;display:block;max-height:220px;object-fit:cover}
.card-nf .body{padding:1.75rem 1.75rem 1.75rem;text-align:center}
.card-nf h1{font-size:1.25rem;font-weight:800;color:#111;margin-bottom:.6rem;letter-spacing:-0.025em}
.card-nf p{color:#6B7280;font-size:.875rem;line-height:1.6;margin-bottom:1.5rem}
.card-nf .cta{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:.85rem 1.5rem;background:#1a1a1a;color:#fff;border-radius:14px;text-decoration:none;font-weight:700;font-size:.95rem;letter-spacing:-0.01em;transition:background .15s}
.card-nf .cta:hover{background:#333}
.card-nf .powered{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:1.5rem}
.card-nf .powered span{font-size:.72rem;color:#9CA3AF;letter-spacing:.02em}
.card-nf .powered a{display:flex;align-items:center;text-decoration:none}
.card-nf .powered svg{height:16px;width:auto;display:block}
@media(max-width:480px){
  body{padding:1rem;align-items:flex-end;justify-content:flex-end;background:#fff}
  .card-nf{border-radius:28px 28px 0 0;max-width:100%;box-shadow:none;border:none}
  .card-nf video{max-height:52vw}
  .card-nf .body{padding:1.5rem 1.25rem 2rem}
}
</style>`
}

function successPage(): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Danke!</title>${sharedStyles()}</head><body>
<div class="card">
  <div class="logo-wrap"><a href="https://finestsites.com">${LOGO_BLACK}</a></div>
  <div class="sep"></div>
  <div class="icon-wrap" style="background:#F0FDF4">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
  </div>
  <h1>Vielen Dank!</h1>
  <p>Deine Nachricht wurde erfolgreich übermittelt.</p>
  <a href="javascript:history.back()" class="cta">← Zurück zur Seite</a>
</div>
</body></html>`
}

function offlinePage(username: string, domain: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seite offline – FinestSites</title>${sharedStyles()}</head><body>
<div class="card">
  <div class="logo-wrap"><a href="https://finestsites.com">${LOGO_BLACK}</a></div>
  <div class="sep"></div>
  <div class="icon-wrap" style="background:#FEF3C7">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="#D97706"/></svg>
  </div>
  <h1>Diese Seite ist offline</h1>
  <div class="url">${username}.${domain}</div>
  <p>Der Inhaber hat diese Webseite vorübergehend deaktiviert.<br>Sie ist momentan nicht öffentlich zugänglich.</p>
  <a href="https://finestsites.com" class="cta">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
    Eigene Webseite erstellen
  </a>
  <p class="footer">Powered by <a href="https://finestsites.com">FinestSites</a></p>
</div>
</body></html>`
}

function notFoundPage(_username: string, _domain: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seite nicht gefunden – FinestSites</title>${sharedStyles()}</head><body>
<div class="card card-nf">
  <video autoplay loop muted playsinline preload="auto">
    <source src="https://app.finestsites.io/404-loop.mp4" type="video/mp4">
  </video>
  <div class="body">
    <h1>Diese Seite wurde nicht gefunden</h1>
    <p>Diese Webseite existiert noch nicht oder wurde deaktiviert.</p>
    <a href="https://app.finestsites.io/register" class="cta">Eigene Webseite erstellen</a>
    <div class="powered">
      <span>Powered by</span>
      <a href="https://finestsites.com" title="FinestSites">${LOGO_BLACK}</a>
    </div>
  </div>
</div>
</body></html>`
}
