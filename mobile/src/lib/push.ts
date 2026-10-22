/**
 * Push-Mitteilungen (Muster aus der FrankenBERATER-App, angepasst):
 *
 * - Android-Kanal wird VOR dem Token angelegt, sonst landen Mitteilungen im falschen Kanal.
 * - Anmeldung des Geräts ist idempotent: Server-Aufruf nur, wenn sich der Token geändert hat.
 * - Beim Abmelden wird das Gerät beim Server abgemeldet und der Merker gelöscht.
 * - Die Erlaubnis wird NICHT beim ersten Start abgefragt, sondern nach der ersten
 *   Veröffentlichung oder der ersten Support-Nachricht (Bildschirm „push-priming“).
 * - Keine Daten von Interessenten auf dem Sperrbildschirm: Inhalte kommen neutral vom Server.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import * as ep from '@/api/endpoints';

import { APP_VERSION, MOCK } from './config';
import { deleteSecure, getSecure, KEYS, setSecure } from './secure';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Mitteilungen',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7C3AED',
  });
}

export type PushPermission = 'granted' | 'denied' | 'undetermined';

export async function getPushPermission(): Promise<PushPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

export async function requestPushPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/**
 * Meldet dieses Gerät beim Server an, falls Push erlaubt ist. Sicher bei jedem App-Start.
 * Fragt NIE selbst nach der Erlaubnis.
 */
export async function registerPushDevice(): Promise<string | null> {
  if (MOCK || !Device.isDevice) return null;
  if ((await getPushPermission()) !== 'granted') return null;
  await ensureAndroidChannel();
  const pid = projectId();
  if (!pid) return null; // EAS-Projekt noch nicht verknüpft

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId: pid })).data;
  } catch {
    return null;
  }
  const cached = await getSecure(KEYS.pushToken);
  if (cached === token) return token;

  try {
    await ep.registerPushDevice({
      token,
      platform: Platform.OS === 'android' ? 'android' : 'ios',
      appVersion: APP_VERSION.slice(0, 32),
      osVersion: Device.osVersion?.slice(0, 32) ?? undefined,
      // Modell (z. B. „iPhone 16“), nie den vom Nutzer vergebenen Gerätenamen
      deviceModel: Device.modelName?.slice(0, 80) ?? undefined,
      locale: deviceLocale(),
    });
    await setSecure(KEYS.pushToken, token);
    return token;
  } catch {
    return null;
  }
}

function deviceLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale?.slice(0, 16) || undefined;
  } catch {
    return undefined;
  }
}

/** Beim Abmelden: Gerät beim Server abmelden, Merker löschen, Badge auf 0. */
export async function unregisterPushDevice(): Promise<void> {
  const token = await getSecure(KEYS.pushToken);
  if (token && !MOCK) await ep.unregisterPushDevice(token).catch(() => {});
  await deleteSecure(KEYS.pushToken);
  await Notifications.setBadgeCountAsync(0).catch(() => false);
}

export async function setBadge(count: number) {
  await Notifications.setBadgeCountAsync(Math.max(0, count)).catch(() => false);
}

const ALLOWED_ROUTES = ['/inbox', '/help', '/chats', '/sites', '/account'];
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Ziel einer Mitteilung (Push-`data` bzw. `data` aus /api/app/v1/notifications).
 * Der Server schickt `url: finestsites://submissions/<id> | support/<id> | chats/<id> | sites/<id> | account | affiliate`
 * (src/lib/push/triggers.ts). Nur App-interne Pfade, externe Links werden nie geöffnet.
 */
export function routeFromNotification(data: unknown): string | null {
  const d = (data ?? {}) as { url?: unknown; href?: unknown };
  if (typeof d.url === 'string' && d.url.startsWith('finestsites://')) {
    const [kind, id] = d.url.slice('finestsites://'.length).split(/[/?#]/);
    const withId = (base: string) => (id && ID_RE.test(id) ? `${base}/${id}` : base);
    switch (kind) {
      case 'submissions':
        return withId('/inbox');
      case 'support':
        return withId('/help');
      case 'chats':
        return withId('/chats');
      case 'sites':
        return withId('/sites');
      case 'affiliate':
        return '/account/partner';
      case 'account':
        return '/account';
      default:
        return null;
    }
  }
  const href = d.href;
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return null;
  return ALLOWED_ROUTES.some(p => href === p || href.startsWith(`${p}/`)) ? href : null;
}

/** Wurde der Hinweis „Mitteilungen erlauben?“ schon gezeigt? */
export async function shouldPrimePush(): Promise<boolean> {
  if (MOCK) return (await getSecure(KEYS.pushPrimed)) !== '1';
  if ((await getPushPermission()) !== 'undetermined') return false;
  return (await getSecure(KEYS.pushPrimed)) !== '1';
}

export async function markPushPrimed() {
  await setSecure(KEYS.pushPrimed, '1');
}
