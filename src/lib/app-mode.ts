/**
 * App-Modus: Erkennt Anfragen aus der nativen FinestSites-App (Expo, iPhone/iPad, später Android).
 *
 * Kennzeichen (jedes reicht):
 *   - Cookie `fs_app=1`             → gesetzt von /api/app/v1/editor-handoff im WebView der App
 *   - Header `X-FS-Client: ios|android` → jede native Anfrage der App
 *   - User-Agent enthält `FinestSitesApp/` → WebView-Kennung (iPad-WKWebView meldet sich sonst als Mac)
 *
 * Bewusst NICHT über Gerätenamen/Plattform-Raten: ein Browser ohne diese Kennzeichen ist immer „Web“,
 * damit sich für bestehende Web-Nutzer nichts ändert.
 *
 * Reine Funktionen ohne Next-/DB-Importe (auch in Edge-Middleware und Skripten nutzbar).
 */

export const APP_MODE_COOKIE = 'fs_app'
export const APP_CLIENT_HEADER = 'x-fs-client'
export const APP_UA_MARKER = 'FinestSitesApp/'

export type AppPlatform = 'ios' | 'android'

const COOKIE_RE = /(?:^|;\s*)fs_app=1(?:\s*;|\s*$)/

type HeaderSource = { get(name: string): string | null } | null | undefined

/** Plattform aus dem Header `X-FS-Client` (nur ios|android, alles andere = null). */
export function appClientPlatform(headers: HeaderSource): AppPlatform | null {
  const v = headers?.get(APP_CLIENT_HEADER)?.trim().toLowerCase()
  return v === 'ios' || v === 'android' ? v : null
}

/**
 * Native App-Anfrage (Header oder User-Agent), OHNE das WebView-Cookie.
 * Wird z. B. für die Ausgabe des Bearer-Tokens bei der Anmeldung genutzt.
 */
export function isAppClientHeaders(headers: HeaderSource): boolean {
  if (!headers) return false
  if (appClientPlatform(headers)) return true
  const ua = headers.get('user-agent') ?? ''
  return ua.includes(APP_UA_MARKER)
}

/** true, wenn die Anfrage aus der App kommt (nativ oder aus dem Editor-WebView der App). */
export function isAppRequestHeaders(headers: HeaderSource): boolean {
  if (!headers) return false
  if (isAppClientHeaders(headers)) return true
  const cookie = headers.get('cookie') ?? ''
  return COOKIE_RE.test(cookie)
}

export function isAppRequest(req: Request): boolean {
  return isAppRequestHeaders(req.headers)
}

/** Antwort für Kauf-/Abo-Schnittstellen, die in der App gesperrt sind (Apple 3.1.1 / 3.1.3(f)). */
export const APP_PURCHASE_DISABLED = 'APP_PURCHASE_DISABLED' as const

export function appPurchaseDisabledResponse(): Response {
  return Response.json(
    { code: APP_PURCHASE_DISABLED, message: 'In der App nicht verfügbar.' },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  )
}

/**
 * Einzeiler für Kauf-Routen: `const blocked = blockPurchaseInApp(req); if (blocked) return blocked`.
 * Für Browser-Anfragen immer null → Verhalten unverändert.
 */
export function blockPurchaseInApp(req: Request): Response | null {
  return isAppRequest(req) ? appPurchaseDisabledResponse() : null
}
