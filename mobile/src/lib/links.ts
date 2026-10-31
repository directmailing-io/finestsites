import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { colors } from '@/theme/tokens';

import { API_BASE } from './config';

/** Bild-/Asset-Pfade vom Server (oft relativ, z. B. „/previews/x.jpg“) als volle Adresse. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return path.startsWith('/') ? `${API_BASE}${path}` : null;
}

/**
 * app.finestsites.io-Link, für den es keinen App-Bildschirm gibt (z. B. Passwort zurücksetzen): im Browser-Fenster
 * öffnen. Android: Der normale Custom Tab schickt einen VIEW-Intent, und den fängt wieder unsere App (bestätigter
 * App-Link für app.finestsites.io) → Endlosschleife (Emulator 31.10.2026, weißer Bildschirm). Deshalb den Browser
 * ausdrücklich per Paketname ansprechen; ohne Custom-Tab-Browser lieber gar nicht öffnen als im Kreis laufen.
 */
export async function openOutsideApp(url: string): Promise<boolean> {
  if (Platform.OS !== 'android') {
    await openInBrowser(url);
    return true;
  }
  try {
    const b = await WebBrowser.getCustomTabsSupportingBrowsersAsync();
    const browserPackage = b.preferredBrowserPackage ?? b.defaultBrowserPackage ?? b.browserPackages[0];
    if (!browserPackage) return false;
    await WebBrowser.openBrowserAsync(url, { browserPackage, controlsColor: colors.ink, enableBarCollapsing: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Live-Kundenseiten, Rechtstexte, „Passwort vergessen“: immer im Safari-Fenster
 * (SFSafariViewController). Werbe-Pixel der Kundenseiten laufen so nicht in der App.
 */
export async function openInBrowser(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url, {
      controlsColor: colors.ink,
      dismissButtonStyle: 'done',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      readerMode: false,
      enableBarCollapsing: true,
    });
  } catch {
    await Linking.openURL(url).catch(() => {});
  }
}

export function siteUrlOf(site: {
  status: string;
  username: string | null;
  custom_domain: string | null;
  custom_domain_status: string | null;
  templates: { domain: string } | null;
}) {
  const hasCustom = site.custom_domain_status === 'active' && !!site.custom_domain;
  const display = hasCustom ? site.custom_domain! : site.templates?.domain && site.username ? `${site.username}.${site.templates.domain}` : null;
  return {
    display,
    hasCustom,
    url: site.status === 'published' && display ? `https://${display}` : null,
  };
}

export async function canCall() {
  return Linking.canOpenURL('tel:+49').catch(() => false);
}

export const callUrl = (phone: string) => `tel:${phone}`;
export const whatsappUrl = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, '')}`;
export const mailUrl = (email: string, subject?: string) =>
  `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;

export async function openExternal(url: string) {
  await Linking.openURL(url).catch(() => {});
}
