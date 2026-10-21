/**
 * GET /api/app/v1/editor-handoff?ott=<Einmal-Schlüssel>&next=/sites/<id>/edit
 *
 * Übergabe App → Editor-WebView: Die App holt mit ihrem Bearer-Token einen Einmal-Schlüssel
 * (GET /api/auth/one-time-token/generate, 1 Minute gültig, nur gehasht gespeichert) und öffnet
 * diese Adresse im WebView. Hier wird der Schlüssel eingelöst (BetterAuth setzt das
 * Session-Cookie im WebView), das Cookie `fs_app=1` gesetzt (App-Modus im Web) und auf `next`
 * weitergeleitet.
 *
 * `next` nur aus einer Positivliste (relative Pfade), sonst /sites. Weiterleitung immer auf
 * NEXT_PUBLIC_APP_URL, nie auf Origin/Host der Anfrage.
 */
import { auth } from '@/lib/auth'
import { getClientIp, rateLimit } from '@/lib/security/request'
import { APP_MODE_COOKIE } from '@/lib/app-mode'
import { appUrl } from '@/lib/app-api/http'
import { EditorHandoffQuery } from '@/lib/contracts/app-v1/auth'
import { safeHandoffNext } from '@/lib/app-api/handoff'

export const dynamic = 'force-dynamic'

function errorPage(): Response {
  // Schlichte Seite im WebView; die App erkennt den Status 400 und bietet „Erneut öffnen“ an
  const html = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link abgelaufen</title></head>'
    + '<body style="font-family:-apple-system,system-ui,sans-serif;padding:32px;color:#111">'
    + '<h1 style="font-size:20px">Der Link ist abgelaufen</h1><p>Bitte schließe dieses Fenster und öffne den Editor erneut.</p></body></html>'
  return new Response(html, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-FS-Error': 'HANDOFF_INVALID' } })
}

export async function GET(req: Request) {
  if (!rateLimit('app-editor-handoff', getClientIp(req), 30, 60_000)) {
    return new Response('Zu viele Anfragen. Bitte warte kurz.', { status: 429, headers: { 'Cache-Control': 'no-store' } })
  }
  const sp = new URL(req.url).searchParams
  const q = EditorHandoffQuery.safeParse({ ott: sp.get('ott') ?? '', next: sp.get('next') ?? undefined })
  if (!q.success) return errorPage()

  let setCookies: string[] = []
  try {
    const result = await auth.api.verifyOneTimeToken({ body: { token: q.data.ott }, returnHeaders: true })
    setCookies = result.headers.getSetCookie()
  } catch {
    return errorPage()
  }
  if (setCookies.length === 0) return errorPage()

  const headers = new Headers({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
  headers.set('Location', `${appUrl()}${safeHandoffNext(q.data.next)}`)
  for (const c of setCookies) headers.append('Set-Cookie', c)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  headers.append('Set-Cookie', `${APP_MODE_COOKIE}=1; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`)
  // Ein evtl. vorhandenes Support-Zugriffs-Cookie gilt im App-WebView nie (eigene Sitzung des Nutzers)
  headers.append('Set-Cookie', `fs-impersonation=; Path=/; Max-Age=0; SameSite=Lax${secure}`)
  return new Response(null, { status: 302, headers })
}
