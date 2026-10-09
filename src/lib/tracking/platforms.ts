/**
 * Server-seitige Übertragung an die Werbeplattformen.
 * Wird von der App (Test-Knopf) UND vom Cloudflare-Worker (echte Ereignisse) benutzt —
 * darum nur fetch und reine Funktionen, keine Node-Module. Hashing liefert der Aufrufer.
 *
 * Ereignisse:  'PageView' | 'Contact' | 'Lead'
 * Dedup:       event_id ist in Browser und Server identisch → Plattform zählt einmal.
 */

export type TrackingEventName = 'PageView' | 'Contact' | 'Lead'

export interface ServerEvent {
  name: TrackingEventName
  eventId: string
  /** Sekunden seit 1970 (Serverzeit beim Speichern) */
  time: number
  sourceUrl: string
  ip?: string | null
  userAgent?: string | null
  /** Meta-Cookies / Klick-IDs aus dem Browser (nur mit Einwilligung) */
  fbp?: string | null
  fbc?: string | null
  ttclid?: string | null
  /** bereits gehashte Kontaktdaten (SHA-256 hex, normalisiert) */
  emailHash?: string | null
  phoneHash?: string | null
  firstNameHash?: string | null
  lastNameHash?: string | null
  country?: string | null
  testCode?: string | null
}

export interface SendResult { ok: boolean; error?: string; received?: number }

/** Normalisierung vor dem Hashen — so, wie Meta und TikTok es verlangen. */
export function normalizeEmail(v: string): string { return v.trim().toLowerCase() }
export function normalizeName(v: string): string { return v.trim().toLowerCase().replace(/\s+/g, ' ') }
/** Telefonnummer als reine Ziffern mit Ländervorwahl (deutsche Nummern ohne + → 49…). */
export function normalizePhone(v: string): string {
  const t = v.trim()
  const spaced = t.match(/^(?:\+\d{1,4}\s+)*\+(\d{1,4})\s+(.*)$/)
  if (spaced) return spaced[1] + spaced[2].replace(/\D/g, '').replace(/^0+/, '')
  const digits = t.replace(/\D/g, '')
  if (t.startsWith('+')) return digits
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return '49' + digits.slice(1)
  return digits
}

/** Kontaktfelder aus einem Formular herausfinden — Templates benennen sie unterschiedlich. */
export function pickContactFields(data: Record<string, string>): { email?: string; phone?: string; firstName?: string; lastName?: string } {
  const out: { email?: string; phone?: string; firstName?: string; lastName?: string } = {}
  for (const [k, v] of Object.entries(data)) {
    const key = k.toLowerCase()
    const val = String(v ?? '').trim()
    if (!val) continue
    if (!out.email && (key.includes('mail')) && /@/.test(val)) out.email = val
    else if (!out.phone && /(telefon|phone|tel|handy|whatsapp|mobil)/.test(key) && /\d{5,}/.test(val)) out.phone = val
    else if (!out.firstName && /(vorname|firstname|first_name)/.test(key)) out.firstName = val
    else if (!out.lastName && /(nachname|lastname|last_name)/.test(key)) out.lastName = val
    else if (!out.firstName && /^(name|fullname|full_name)$/.test(key)) {
      const [first, ...rest] = val.split(/\s+/)
      out.firstName = first
      if (rest.length) out.lastName = rest.join(' ')
    }
  }
  return out
}

const META_API = 'https://graph.facebook.com/v21.0'

export async function sendMetaEvent(pixelId: string, token: string, ev: ServerEvent): Promise<SendResult> {
  const userData: Record<string, unknown> = {}
  if (ev.ip) userData.client_ip_address = ev.ip
  if (ev.userAgent) userData.client_user_agent = ev.userAgent
  if (ev.fbp) userData.fbp = ev.fbp
  if (ev.fbc) userData.fbc = ev.fbc
  if (ev.emailHash) userData.em = [ev.emailHash]
  if (ev.phoneHash) userData.ph = [ev.phoneHash]
  if (ev.firstNameHash) userData.fn = [ev.firstNameHash]
  if (ev.lastNameHash) userData.ln = [ev.lastNameHash]
  if (ev.country) userData.country = [ev.country]

  const body: Record<string, unknown> = {
    data: [{
      event_name: ev.name,
      event_time: ev.time,
      event_id: ev.eventId,
      event_source_url: ev.sourceUrl,
      action_source: 'website',
      user_data: userData,
    }],
  }
  if (ev.testCode) body.test_event_code = ev.testCode

  try {
    const res = await fetch(`${META_API}/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({})) as { events_received?: number; error?: { message?: string; code?: number } }
    if (!res.ok || json.error) return { ok: false, error: metaErrorText(json.error) }
    return { ok: true, received: json.events_received ?? 0 }
  } catch (err) {
    return { ok: false, error: `Meta nicht erreichbar: ${err instanceof Error ? err.message : 'Netzwerkfehler'}` }
  }
}

/** Meta-Fehlercodes in Sätze, die ein Laie versteht und mit denen er etwas tun kann. */
function metaErrorText(error?: { message?: string; code?: number }): string {
  const code = error?.code
  const msg = error?.message ?? ''
  if (code === 190) return 'Zugriffsschlüssel ungültig oder abgelaufen. Bitte im Events Manager einen neuen erzeugen und hier eintragen.'
  if (code === 100 && /pixel|dataset|does not exist|Unsupported post request/i.test(msg)) return 'Pixel-ID nicht gefunden. Bitte prüfe die Datensatz-ID im Events Manager.'
  if (code === 200 || /permission/i.test(msg)) return 'Der Zugriffsschlüssel darf dieses Pixel nicht benutzen. Erzeuge den Schlüssel im Events Manager genau bei diesem Datensatz.'
  if (code === 4 || code === 17 || code === 32) return 'Meta nimmt gerade keine Ereignisse an (Limit erreicht). Wir versuchen es beim nächsten Ereignis wieder.'
  if (/test_event_code/i.test(msg)) return 'Test-Code nicht erkannt. Er steht im Events Manager unter „Ereignisse testen“ und sieht so aus: TEST12345.'
  return msg ? `Meta meldet: ${msg}` : 'Meta hat das Ereignis nicht angenommen.'
}

const TIKTOK_API = 'https://business-api.tiktok.com/open_api/v1.3/event/track/'
const TIKTOK_EVENT: Record<TrackingEventName, string> = { PageView: 'ViewContent', Contact: 'Contact', Lead: 'SubmitForm' }

export async function sendTikTokEvent(pixelId: string, token: string, ev: ServerEvent): Promise<SendResult> {
  const user: Record<string, unknown> = {}
  if (ev.ip) user.ip = ev.ip
  if (ev.userAgent) user.user_agent = ev.userAgent
  if (ev.ttclid) user.ttclid = ev.ttclid
  if (ev.emailHash) user.email = ev.emailHash
  if (ev.phoneHash) user.phone = ev.phoneHash
  const body: Record<string, unknown> = {
    event_source: 'web',
    event_source_id: pixelId,
    data: [{
      event: TIKTOK_EVENT[ev.name],
      event_time: ev.time,
      event_id: ev.eventId,
      user,
      page: { url: ev.sourceUrl },
    }],
  }
  if (ev.testCode) body.test_event_code = ev.testCode
  try {
    const res = await fetch(TIKTOK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Access-Token': token },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({})) as { code?: number; message?: string }
    if (!res.ok || (json.code !== undefined && json.code !== 0)) return { ok: false, error: tiktokErrorText(json.code, json.message) }
    return { ok: true, received: 1 }
  } catch (err) {
    return { ok: false, error: `TikTok nicht erreichbar: ${err instanceof Error ? err.message : 'Netzwerkfehler'}` }
  }
}

function tiktokErrorText(code?: number, msg?: string): string {
  if (code === 40105 || code === 40001 || /token/i.test(msg ?? '')) return 'TikTok-Zugriffstoken ungültig. Bitte im Ads Manager neu erzeugen und hier eintragen.'
  if (/pixel|event_source_id/i.test(msg ?? '')) return 'TikTok-Pixel-ID nicht gefunden. Bitte im Ads Manager unter Events prüfen.'
  return msg ? `TikTok meldet: ${msg}` : 'TikTok hat das Ereignis nicht angenommen.'
}
