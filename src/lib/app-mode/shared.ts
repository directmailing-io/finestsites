/**
 * App-Modus: Das Web-Dashboard läuft eingebettet in der nativen FinestSites-App (WebView).
 *
 * Erkennung ausschließlich über das Cookie `fs_app=1` (gesetzt von der Übergabe-Route des Backends).
 * Nicht über den User-Agent: WKWebView auf dem iPad meldet sich als Mac.
 * Ohne Cookie bleibt alles exakt wie im normalen Browser.
 *
 * Diese Datei ist client- und serverseitig nutzbar (kein next/headers-Import).
 */
export const APP_MODE_COOKIE = 'fs_app'
export const APP_MODE_VALUE = '1'

/** Liest das App-Modus-Cookie im Browser (nur wenn es nicht httpOnly gesetzt ist). */
export function readAppModeCookie(): boolean {
  if (typeof document === 'undefined') return false
  try {
    return document.cookie.split(';').some(c => c.trim() === `${APP_MODE_COOKIE}=${APP_MODE_VALUE}`)
  } catch {
    return false
  }
}

/**
 * Nachrichten an die native App (react-native-webview: `window.ReactNativeWebView.postMessage`).
 * Jede Nachricht ist ein JSON-String mit einem `type`.
 */
export type AppBridgeMessage =
  | { type: 'published'; siteId: string; url: string; firstTime: boolean }
  | { type: 'publish-blocked'; code: string }
  | { type: 'save-state'; state: 'saving' | 'saved' | 'error' }
  | { type: 'share'; url: string }
  | { type: 'qr'; url: string }
  | { type: 'open-url'; url: string }
  | { type: 'auth-required' }
  | { type: 'dirty'; value: boolean; unpublished?: boolean }
  | { type: 'close' }

// Typ-Abgleich mit dem App-Vertrag (src/lib/contracts/app-v1/bridge.ts): bricht den Build, sobald
// beide auseinanderlaufen. Nur Typen, nichts davon landet im ausgelieferten Code.
type BridgeEquals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type BridgeAssert<T extends true> = T
export type _AppBridgeContractCheck = BridgeAssert<BridgeEquals<AppBridgeMessage, import('@/lib/contracts/app-v1/bridge').AppBridgeMessage>>

type RNWebViewWindow = Window & { ReactNativeWebView?: { postMessage: (msg: string) => void } }

/** true, wenn die native Brücke vorhanden ist (also wirklich in der App-WebView). */
export function hasAppBridge(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (window as RNWebViewWindow).ReactNativeWebView?.postMessage === 'function'
}

/**
 * Schickt eine Nachricht an die App. Gibt false zurück, wenn keine Brücke da ist
 * (z. B. Cookie im normalen Browser gesetzt) – dann greift der Aufrufer auf das Web-Verhalten zurück.
 */
export function postToApp(msg: AppBridgeMessage): boolean {
  if (!hasAppBridge()) return false
  try {
    ;(window as RNWebViewWindow).ReactNativeWebView!.postMessage(JSON.stringify(msg))
    return true
  } catch {
    return false
  }
}

type FsAppWindow = Window & { __FS_APP__?: { caps?: unknown } }

/**
 * Fähigkeiten der App (von ihr vor dem Laden in `window.__FS_APP__.caps` gesetzt). Ältere App-Versionen
 * kennen z. B. 'close' nicht – dann bleibt deren eigene Kopfzeile zuständig.
 */
export function appHasCap(cap: string): boolean {
  if (typeof window === 'undefined') return false
  const caps = (window as FsAppWindow).__FS_APP__?.caps
  return Array.isArray(caps) && caps.includes(cap)
}

/** Relative Pfade (z. B. `/settings`) für die App zu absoluten URLs machen. */
export function absoluteUrl(url: string): string {
  if (typeof window === 'undefined') return url
  try { return new URL(url, window.location.origin).href } catch { return url }
}

/** Neutrale Texte, wenn das Veröffentlichen in der App am Konto scheitert (keine Tarife, Preise oder Kauf-Links). */
export const APP_PUBLISH_BLOCKED_TEXT: Record<string, string> = {
  SUBSCRIPTION_REQUIRED: 'Diese Seite kann mit deinem Konto gerade nicht veröffentlicht werden. Deine Inhalte sind gespeichert.',
  PLAN_LIMIT_REACHED: 'Mit deinem Konto sind schon so viele Seiten online wie möglich. Nimm eine andere Seite offline, dann kannst du diese veröffentlichen. Deine Inhalte sind gespeichert.',
  PAYMENT_PENDING: 'Bei deinem Konto ist gerade etwas offen. Sobald das geklärt ist, gehen deine Seiten automatisch wieder online. Deine Inhalte sind gespeichert.',
}
