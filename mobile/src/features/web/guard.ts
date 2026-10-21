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

/** Nachrichten aus dem Web-Editor (window.ReactNativeWebView.postMessage). */
export type BridgeMessage =
  | { type: 'published'; siteId: string; url?: string; first?: boolean }
  | { type: 'publish-blocked'; code: string }
  | { type: 'save-state'; dirty: boolean }
  | { type: 'share'; url: string; title?: string }
  | { type: 'qr'; url: string; title?: string }
  | { type: 'open-url'; url: string }
  | { type: 'auth-required' }
  | { type: 'close' };

export function parseBridge(data: string): BridgeMessage | null {
  try {
    const m = JSON.parse(data) as { type?: unknown };
    if (!m || typeof m.type !== 'string') return null;
    const allowed = ['published', 'publish-blocked', 'save-state', 'share', 'qr', 'open-url', 'auth-required', 'close'];
    return allowed.includes(m.type) ? (m as BridgeMessage) : null;
  } catch {
    return null;
  }
}

/** Neutrale Texte, wenn Veröffentlichen nicht geht – nie ein Hinweis auf einen Kauf. */
export function publishBlockedText(code: string): { title: string; text: string } {
  switch (code) {
    case 'site_limit':
    case 'plan_required':
    case 'payment_issue':
      return {
        title: 'Veröffentlichen geht gerade nicht',
        text: 'Mit deinem Konto kann diese Seite gerade nicht veröffentlicht werden. Deine Änderungen sind gespeichert. Bei Fragen hilft dir der Support.',
      };
    case 'claimguard':
      return {
        title: 'Bitte prüfe deine Texte',
        text: 'ClaimGuard hat Aussagen gefunden, die so nicht erlaubt sind. Im Editor siehst du, welche Stellen du ändern solltest.',
      };
    case 'missing_fields':
      return { title: 'Es fehlen noch Angaben', text: 'Fülle die markierten Felder aus und versuche es dann nochmal.' };
    default:
      return { title: 'Veröffentlichen hat nicht geklappt', text: 'Deine Änderungen sind gespeichert. Bitte versuche es gleich nochmal.' };
  }
}
