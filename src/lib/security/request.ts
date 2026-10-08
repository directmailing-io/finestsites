import { timingSafeEqual } from 'node:crypto'

/**
 * Client-IP hinter Cloudflare + Caddy. `cf-connecting-ip` ist vertrauenswürdig, weil der
 * Origin nur aus Cloudflare-Netzen erreichbar ist (ufw, Port 443). Fallback: der LETZTE
 * Eintrag in X-Forwarded-For (vom eigenen Proxy angehängt), nie der erste (vom Client setzbar).
 */
export function getClientIp(req: Request): string | null {
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }
  return req.headers.get('x-real-ip')?.trim() || null
}

/** Konstantzeit-Vergleich für Secrets/Bearer-Token (auch bei ungleicher Länge ohne Early-Exit-Leak). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b)
  if (ba.length !== bb.length) {
    // gleich lange Dummy-Operation, damit die Länge nicht über das Timing durchsickert
    timingSafeEqual(bb, bb)
    return false
  }
  return timingSafeEqual(ba, bb)
}

/**
 * Einfacher In-Memory-Limiter pro Prozess (PM2-Cluster: Limit gilt je Instanz, also
 * praktisch ×2). Für harte Garantien KV/DB verwenden – hier geht es um Brute-Force- und
 * Flooding-Bremsen auf Login, Registrierung, Passwort-Reset.
 */
const buckets = new Map<string, { count: number; reset: number }>()
export function rateLimit(bucket: string, key: string | null, limit: number, windowMs: number): boolean {
  const k = `${bucket}:${key ?? 'unknown'}`
  const now = Date.now()
  const cur = buckets.get(k)
  if (!cur || cur.reset < now) { buckets.set(k, { count: 1, reset: now + windowMs }); return true }
  cur.count += 1
  if (buckets.size > 50_000) for (const [bk, bv] of buckets) if (bv.reset < now) buckets.delete(bk)
  return cur.count <= limit
}
