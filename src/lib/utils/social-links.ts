/**
 * Social- und WhatsApp-Links für Templates.
 *
 * Geteilt zwischen App (template-engine.ts) und Cloudflare-Worker
 * (cloudflare-worker/src/index.ts importiert diese Datei) — darum ohne Abhängigkeiten.
 *
 * Problem: Templates bauen Links unterschiedlich ("{{instagram}}", "https://www.instagram.com/{{instagram_url}}/",
 * "https://wa.me/{{whatsapp_number}}"), gespeichert sind aber mal komplette Links, mal nur der
 * Benutzername, mal eine Telefonnummer mit Leerzeichen. Deshalb wird beim Rendern jedes href, das
 * einen Social-Platzhalter enthält, durch einen fertigen, gültigen Link ersetzt — egal was gespeichert ist.
 */

/**
 * WhatsApp links are built as https://wa.me/{number} and only work with digits:
 * country code + number, no "+", no spaces, no trunk zero. Stored values are not always
 * in that form (e.g. "+49 151 2025 2822" copied from the profile phone number), so every
 * WhatsApp value is normalised at render time — whatever was saved, the link works.
 *   "+49 15120252822"       → 4915120252822
 *   "+49 016096692800"      → 4916096692800   (trunk zero after the country code dropped)
 *   "+49 +49 151 70241573"  → 4915170241573
 *   "0151 1234567"          → 491511234567    (national format: assumed German)
 * Full URLs (https://wa.me/…) are left untouched.
 */
export function normalizeWhatsAppNumber(raw: string): string {
  const v = (raw || '').trim()
  if (!v || /^https?:/i.test(v)) return v
  const spaced = v.match(/^(?:\+\d{1,4}\s+)*\+(\d{1,4})\s+(.*)$/)
  if (spaced) return spaced[1] + spaced[2].replace(/\D/g, '').replace(/^0+/, '')
  const digits = v.replace(/\D/g, '')
  if (v.startsWith('+')) return digits
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return '49' + digits.slice(1)
  return digits
}

type Platform = 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'linkedin' | 'telegram'

const PROFILE: Record<Exclude<Platform, 'whatsapp'>, { host: RegExp; profile: (h: string) => string; search: (q: string) => string }> = {
  instagram: {
    host: /(^|\.)instagram\.com$/,
    profile: h => `https://www.instagram.com/${h}/`,
    search: q => `https://www.instagram.com/explore/search/keyword/?q=${q}`,
  },
  facebook: {
    host: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/,
    profile: h => `https://www.facebook.com/${h}`,
    search: q => `https://www.facebook.com/search/top?q=${q}`,
  },
  tiktok: {
    host: /(^|\.)tiktok\.com$/,
    profile: h => `https://www.tiktok.com/@${h}`,
    search: q => `https://www.tiktok.com/search/user?q=${q}`,
  },
  youtube: {
    host: /(^|\.)(youtube\.com|youtu\.be)$/,
    profile: h => `https://www.youtube.com/@${h}`,
    search: q => `https://www.youtube.com/results?search_query=${q}`,
  },
  linkedin: {
    host: /(^|\.)linkedin\.com$/,
    profile: h => `https://www.linkedin.com/in/${h}`,
    search: q => `https://www.linkedin.com/search/results/people/?keywords=${q}`,
  },
  telegram: {
    host: /(^|\.)(t\.me|telegram\.me)$/,
    profile: h => `https://t.me/${h}`,
    search: q => `https://t.me/${q.replace(/%20/g, '')}`,
  },
}

/** Plattform aus dem Platzhalter-Namen (instagram_url, partner_whatsapp_number, …). */
export function platformFromKey(key: string): Platform | null {
  const k = key.toLowerCase()
  if (k.includes('whatsapp')) return 'whatsapp'
  for (const p of Object.keys(PROFILE) as (keyof typeof PROFILE)[]) if (k.includes(p)) return p
  return null
}

// Nur echte Links zählen — "weigl.michi" ist ein Instagram-Name, keine Domain
const looksLikeUrl = (v: string) =>
  /^https?:\/\//i.test(v) || /^www\./i.test(v) ||
  /^([a-z0-9-]+\.)*(instagram\.com|facebook\.com|fb\.com|fb\.me|tiktok\.com|youtube\.com|youtu\.be|linkedin\.com|t\.me|telegram\.me|wa\.me|whatsapp\.com)(\/|$)/i.test(v)

/**
 * Macht aus einem gespeicherten Wert einen funktionierenden Link.
 *   instagram "https://instagram.com/anna"  → https://instagram.com/anna   (vollständige Links bleiben)
 *   instagram "anna" / "@anna"              → https://www.instagram.com/anna/
 *   facebook  "https://facebook.com/Ulla Hildebrandt" → Facebook-Suche nach "Ulla Hildebrandt"
 *   whatsapp  "+49 151 2345678"             → https://wa.me/491512345678
 * Leerer Wert → ''.
 */
export function socialLink(platform: Platform, raw: string): string {
  const v = (raw || '').trim()
  if (!v) return ''

  if (platform === 'whatsapp') {
    if (looksLikeUrl(v) && !/\s/.test(v)) return /^https?:\/\//i.test(v) ? v : `https://${v}`
    const digits = normalizeWhatsAppNumber(v)
    return digits ? `https://wa.me/${digits}` : ''
  }

  const cfg = PROFILE[platform]
  // "https://instagram.com/https://www.instagram.com/anna" (Link in den Benutzernamen kopiert) → innerer Link
  const nested = v.slice(1).search(/https?:\/\//i)
  if (nested >= 0) return socialLink(platform, v.slice(nested + 1))
  const handle = v.replace(/^@+/, '')

  if (looksLikeUrl(handle)) {
    let url: URL
    try {
      url = new URL(/^https?:\/\//i.test(handle) ? handle : `https://${handle}`)
    } catch {
      return cfg.search(encodeURIComponent(handle))
    }
    url.protocol = 'https:'
    url.hostname = url.hostname.toLowerCase()
    let path = url.pathname
    try { path = decodeURIComponent(path) } catch { /* keep encoded */ }
    // "https://facebook.com/Ulla Hildebrandt" — Name statt Benutzername: zur Suche statt ins Leere
    if (/\s/.test(path.trim()) && cfg.host.test(url.hostname)) {
      const name = path.replace(/^\/+(in\/|@)?/, '').replace(/\/+$/, '').trim()
      return cfg.search(encodeURIComponent(name))
    }
    return url.href
  }

  if (/\s/.test(handle)) return cfg.search(encodeURIComponent(handle))
  return cfg.profile(encodeURIComponent(handle).replace(/%2F/gi, '/'))
}

/**
 * Ersetzt in href-Attributen jeden Social-/WhatsApp-Platzhalter samt fest eingebautem Präfix
 * (z. B. "https://www.instagram.com/{{instagram_url}}/") durch einen eigenen Platzhalter mit dem
 * fertigen Link. Läuft vor der normalen Platzhalter-Ersetzung; `data` bekommt die Links unter
 * `__link_{key}`. Anhänge wie "?text=Hallo%20{{vorname}}" bei WhatsApp bleiben erhalten.
 */
export function rewriteSocialHrefs(html: string, data: Record<string, unknown>): string {
  return html.replace(
    /href="([^"{]*)\{\{\s*([A-Za-z0-9_]+)\s*\}\}([^"]*)"/g,
    (match, prefix: string, key: string, suffix: string) => {
      const platform = platformFromKey(key)
      if (!platform) return match
      if (prefix && !/^https?:\/\//i.test(prefix)) return match // tel:, mailto: …
      const linkKey = `__link_${key}`
      if (!(linkKey in data)) {
        const value = data[key]
        data[linkKey] = typeof value === 'string' ? socialLink(platform, value) : ''
      }
      const link = String(data[linkKey])
      // Query-Anhang (WhatsApp-Vorlagetext) nur an wa.me-Links hängen; "/" am Ende fällt weg
      // Platzhalter im Anhang URL-kodieren ("Hi%20{{vorname}}" mit "Thorsten Michael")
      const keep = suffix.startsWith('?') && /^https:\/\/wa\.me\/\d+$/.test(link)
        ? suffix.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_m, k: string) => encodeURIComponent(String(data[k] ?? '')))
        : ''
      return `href="{{${linkKey}}}${keep}"`
    },
  )
}
