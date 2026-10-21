import { AppBridgeMessage } from '@/api/contracts/bridge';
import type { PublishErrorCode } from '@/api/types';
import { APP_HOST } from '@/lib/config';

/**
 * Navigationsregeln für die WebView (Editor, Werbung & Tracking).
 *
 * - erlaubt: app.finestsites.io (außer Kauf-Pfade), Vorschau-Unterrahmen, about:/data:/blob:
 * - gesperrt (nichts passiert): Tarif/Zahlung/Registrieren, Stripe Checkout/Billing,
 *   die Startseite finestsites.io (dort stehen Preise)
 * - alles andere: im Safari-Fenster öffnen
 */
export type GuardDecision = 'allow' | 'block' | 'external';

const BLOCKED_PATHS = [/^\/billing(\/|$)/, /^\/onboarding\/plan(\/|$)/, /^\/register(\/|$)/, /^\/api\/billing(\/|$)/, /^\/preise(\/|$)/, /^\/pricing(\/|$)/];
const BLOCKED_HOSTS = ['checkout.stripe.com', 'billing.stripe.com', 'buy.stripe.com', 'pay.stripe.com'];
// Marketing-Seite: nur Rechtstexte dürfen raus (im Safari-Fenster), alles andere bleibt zu
const MARKETING_HOSTS = ['finestsites.io', 'www.finestsites.io', 'finestsites.de', 'www.finestsites.de'];
const MARKETING_ALLOWED = [/^\/impressum/, /^\/datenschutz/, /^\/agb/];

export function decide(rawUrl: string, isTopFrame: boolean): GuardDecision {
  if (/^(about:|data:|blob:)/.test(rawUrl)) return 'allow';
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return 'block';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    // tel:, mailto:, whatsapp: usw. → Betriebssystem
    return /^(tel|mailto|sms):$/.test(url.protocol) ? 'external' : 'block';
  }
  if (BLOCKED_HOSTS.includes(url.host)) return 'block';
  if (url.host === APP_HOST) {
    if (BLOCKED_PATHS.some(r => r.test(url.pathname))) return 'block';
    if (url.pathname === '/settings' && /tab=(zahlung|rechnungen)/.test(url.search)) return 'block';
    return 'allow';
  }
  // Unterrahmen (Live-Vorschau der Seite im Editor, Bilder, Videos) laden
  if (!isTopFrame) return 'allow';
  if (MARKETING_HOSTS.includes(url.host)) return MARKETING_ALLOWED.some(r => r.test(url.pathname)) ? 'external' : 'block';
  return 'external';
}

/**
 * Nachrichten aus dem Web-Editor (window.ReactNativeWebView.postMessage). Form = Server-Vertrag
 * src/lib/contracts/app-v1/bridge.ts (Absender src/lib/app-mode/shared.ts). Alles andere wird verworfen.
 */
export type BridgeMessage = AppBridgeMessage;

export function parseBridge(data: string): BridgeMessage | null {
  try {
    const parsed = AppBridgeMessage.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Neutrale Texte, wenn Veröffentlichen nicht geht – nie ein Hinweis auf einen Kauf. */
export function publishBlockedText(code: PublishErrorCode | string): { title: string; text: string } {
  switch (code) {
    case 'SUBSCRIPTION_REQUIRED':
    case 'PAYMENT_PENDING':
      return {
        title: 'Veröffentlichen geht gerade nicht',
        text: 'Mit deinem Konto kann diese Seite gerade nicht veröffentlicht werden. Deine Änderungen sind gespeichert. Bei Fragen hilft dir der Support.',
      };
    case 'PLAN_LIMIT_REACHED':
      return {
        title: 'Veröffentlichen geht gerade nicht',
        text: 'Mit deinem Konto sind schon so viele Seiten online wie möglich. Nimm eine andere Seite offline, dann kannst du diese veröffentlichen. Deine Änderungen sind gespeichert.',
      };
    case 'COMPLIANCE_BLOCKED':
    case 'COMPLIANCE_REQUIRED':
      return {
        title: 'Bitte prüfe deine Texte',
        text: 'ClaimGuard hat Aussagen gefunden, die so nicht erlaubt sind, oder deine Texte sind noch nicht geprüft. Im Editor siehst du, welche Stellen du ändern solltest.',
      };
    case 'IMPRESSUM_REQUIRED':
      return { title: 'Es fehlen noch Angaben', text: 'Fülle zuerst dein Impressum aus und versuche es dann nochmal.' };
    case 'CONSENT_REQUIRED':
      return { title: 'Bitte zuerst bestätigen', text: 'Bestätige im Editor die Hinweise zu deinen Inhalten und versuche es dann nochmal.' };
    default:
      return { title: 'Veröffentlichen hat nicht geklappt', text: 'Deine Änderungen sind gespeichert. Bitte versuche es gleich nochmal.' };
  }
}
