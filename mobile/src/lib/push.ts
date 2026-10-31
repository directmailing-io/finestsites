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
import { useLock } from './lock';
import { deleteSecure, getSecure, KEYS, setSecure } from './secure';

/**
 * Gerade sichtbares Besucher-Gespräch (gesetzt vom Thread-Bildschirm, solange er fokussiert und die App
 * im Vordergrund ist). Zweite Schicht neben dem Server (der lässt den Push weg, wenn das Gespräch in den
 * letzten 20 s abgerufen wurde): kommt die Mitteilung trotzdem an, erscheint kein Banner und kein Ton –
 * die Nachricht steht ja schon auf dem Bildschirm. Andere Mitteilungen bleiben unverändert.
 */
let activeChatConversationId: string | null = null;

export function setActiveChatConversation(id: string | null) {
  activeChatConversationId = id;
}

export function getActiveChatConversation(): string | null {
  return activeChatConversationId;
}

/** Ist die Mitteilung eine Chat-Nachricht zu dem Gespräch, das der Nutzer gerade vor sich hat? */
export function isForVisibleChat(data: unknown): boolean {
  if (!activeChatConversationId) return false;
  const d = (data ?? {}) as { type?: unknown; conversationId?: unknown };
  if (d.type !== 'chat_message' || d.conversationId !== activeChatConversationId) return false;
  // Hinter der Face-ID-Sperre ist das Gespräch nicht zu sehen → Banner wie gewohnt
  const lock = useLock.getState();
  return !(lock.enabled && lock.locked);
}

Notifications.setNotificationHandler({
  handleNotification: async notification =>
    isForVisibleChat(notification.request.content.data)
      ? { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: true }
      : { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true },
});

/**
 * Android-Kanäle (Einstellungen → Apps → FinestSites → Benachrichtigungen). Der Server schickt als
 * channelId die Kategorie (src/lib/push/drain.ts); ohne passenden Kanal zeigt Android die Mitteilung
 * nicht an. Namen wie in Mehr → Einstellungen → Mitteilungen. „default“ bleibt als Rückfallebene.
 */
const ANDROID_CHANNELS: { id: string; name: string; description: string }[] = [
  { id: 'leads', name: 'Anfragen', description: 'Neue Anfragen über deine Webseiten' },
  { id: 'support', name: 'Support', description: 'Antworten vom FinestSites-Team' },
  { id: 'account', name: 'Konto und Webseiten', description: 'Domains, Veröffentlichungen und Hinweise zu deinem Konto' },
  { id: 'partner', name: 'Partnerprogramm', description: 'Neuigkeiten zu deinen Empfehlungen' },
  { id: 'chat', name: 'Besucher-Chat', description: 'Nachrichten von Besuchern deiner Webseiten' },
  { id: 'news', name: 'Neuigkeiten', description: 'Neue Funktionen und Vorlagen' },
  { id: 'default', name: 'Mitteilungen', description: 'Sonstige Mitteilungen' },
];

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    ANDROID_CHANNELS.map(c =>
      Notifications.setNotificationChannelAsync(c.id, {
        name: c.name,
        description: c.description,
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C3AED',
      }).catch(() => null),
    ),
  );
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

const ALLOWED_ROUTES = ['/inbox', '/help', '/chats', '/sites', '/account', '/account/news'];
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Ziel einer Mitteilung (Push-`data` bzw. `data` aus /api/app/v1/notifications).
 * Der Server schickt `url: finestsites://submissions/<id> | support/<id> | chats/<id> | sites/<id> | news/<id> | account | affiliate`
 * (src/lib/push/triggers.ts, src/lib/news/service.ts). Nur App-interne Pfade, externe Links werden nie geöffnet.
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
      case 'news':
        // Tipp auf die Push-Mitteilung „Neuigkeit“ → direkt ins Detail (ohne id: die Liste)
        return withId('/account/news');
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
