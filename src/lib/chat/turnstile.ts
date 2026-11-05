/**
 * Cloudflare Turnstile für den Besucher-Chat (Daniel 05.11.2026): unsichtbare Prüfung, bevor ein NEUES
 * Gespräch beginnt. Das Widget holt das Token über die Prüfseite public/chat-widget/check.html auf
 * app.finestsites.io (ein Turnstile-Widget erlaubt nur wenige Hostnamen, Kundenseiten laufen auf vielen Domains)
 * und schickt es als `cf` mit der ersten Nachricht.
 *
 *   'ok'      bestanden
 *   'failed'  kein oder ungültiges Token → Gespräch wird still gestellt (unsichtbare Sperre, Betreiber kann freigeben)
 *   'skipped' Prüfung aus (TURNSTILE_SECRET_KEY fehlt) oder Cloudflare nicht erreichbar → wie bestanden (fail-open,
 *             ein Ausfall bei Cloudflare darf keine echten Anfragen schlucken)
 */
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TIMEOUT_MS = 4000

export type TurnstileResult = 'ok' | 'failed' | 'skipped'

export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY
}

export async function verifyTurnstile(token: unknown): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return 'skipped'
  if (typeof token !== 'string' || !token || token.length > 2048) return 'failed'
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return 'skipped'
    const j = await res.json() as { success?: boolean; 'error-codes'?: string[] }
    if (j.success) return 'ok'
    // Fehler auf unserer Seite (Schlüssel falsch o. ä.) nicht dem Besucher anlasten
    if ((j['error-codes'] ?? []).some(c => c === 'missing-input-secret' || c === 'invalid-input-secret' || c === 'internal-error')) {
      console.error('[chat/turnstile] verify config error:', j['error-codes'])
      return 'skipped'
    }
    return 'failed'
  } catch (err) {
    console.error('[chat/turnstile] verify failed:', err instanceof Error ? err.message : err)
    return 'skipped'
  }
}
