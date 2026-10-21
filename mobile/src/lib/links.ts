import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { colors } from '@/theme/tokens';

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
