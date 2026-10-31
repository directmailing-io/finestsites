/**
 * Links auf app.finestsites.io (aus E-Mails, Nachrichten, Browser) → passender App-Bildschirm.
 *
 * Nur diese Bereiche zeigt die App selbst (iPhone: dieselbe Liste in apple-app-site-association auf dem Server).
 * Alles andere auf app.finestsites.io (Login, Passwort, Zahlung, Einstellungen, Onboarding) öffnet die App im
 * Browser-Fenster (Custom Tab / Safari-Fenster) und bleibt auf dem Startbildschirm – Android leitet wegen
 * pathPrefix '/' (app.config.ts) alle Pfade an die App.
 */
import { openInBrowser } from './links';

export const APP_LINK_HOST = 'app.finestsites.io';
export const APP_LINK_PREFIXES = ['/dashboard', '/sites', '/submissions', '/support', '/chats', '/neuigkeiten'] as const;

const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const id = (s: string | null | undefined) => (s && ID_RE.test(s) ? s : null);

/** Web-Pfad → App-Pfad; null, wenn der Link nicht in die App gehört. */
export function appPathForWebPath(pathname: string, search = ''): string | null {
  const seg = pathname.split('/').filter(Boolean);
  const q = new URLSearchParams(search);
  switch (seg[0]) {
    case undefined:
    case 'dashboard':
      return '/sites';
    case 'sites': {
      if (!seg[1]) return '/sites';
      if (seg[1] === 'new') return '/sites/new';
      const s = id(seg[1]);
      if (!s) return '/sites';
      return seg[2] === 'edit' ? `/editor/${s}` : `/sites/${s}`;
    }
    case 'submissions': {
      const s = id(seg[1]) ?? id(q.get('id'));
      return s ? `/inbox/${s}` : '/inbox';
    }
    case 'support': {
      const s = id(seg[1]);
      return s ? `/help/${s}` : '/help';
    }
    case 'chats': {
      const s = id(seg[1]);
      return s ? `/chats/${s}` : '/chats';
    }
    case 'neuigkeiten': {
      const s = id(seg[1]);
      return s ? `/account/news/${s}` : '/account/news';
    }
    default:
      return null;
  }
}

/**
 * Für expo-router (+native-intent): volle https-Adresse von app.finestsites.io → App-Pfad (unbekannt → Start).
 * Alles andere (finestsites://…, schon interne Pfade) bleibt unverändert.
 */
export function redirectWebLink(path: string): string {
  if (!/^https?:\/\//i.test(path)) {
    // Manche Android-Versionen reichen nur den Pfad weiter: Web-Pfade, die es in der App so nicht gibt, umbiegen
    const [p, s = ''] = path.split('?');
    if (/^\/(dashboard|submissions|support|neuigkeiten)(\/|$)/.test(p) || /^\/sites\/[^/]+\/edit\/?$/.test(p)) {
      return appPathForWebPath(p, s) ?? '/';
    }
    return path;
  }
  try {
    const u = new URL(path);
    if (u.hostname !== APP_LINK_HOST) return path;
    const mapped = appPathForWebPath(u.pathname, u.search);
    if (mapped) return mapped;
    // Kein App-Bildschirm dafür (z. B. Passwort zurücksetzen): im Browser-Fenster öffnen. Ein Custom Tab
    // läuft nicht über die App-Links, es entsteht also keine Schleife.
    void openInBrowser(u.toString()).catch(() => {});
    return '/';
  } catch {
    return '/';
  }
}
