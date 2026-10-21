import * as Application from 'expo-application';
import { Platform } from 'react-native';

/** Einziger Server der App. Kein Hostinger, kein Vercel: app.finestsites.io (Hetzner). */
export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? 'https://app.finestsites.io').replace(/\/$/, '');
export const APP_HOST = new URL(API_BASE).host;

/** EXPO_PUBLIC_API_MOCK=1: alle Anfragen gehen an Beispieldaten im Speicher, nichts an den Server. */
export const MOCK = process.env.EXPO_PUBLIC_API_MOCK === '1';

export const APP_VERSION = Application.nativeApplicationVersion ?? '1.0.0';
export const BUILD_NUMBER = Application.nativeBuildVersion ?? '0';
export const CLIENT = Platform.OS === 'android' ? 'android' : 'ios';

/** Kennung im User-Agent der WebView, an der der Server den App-Modus erkennt (zusätzlich zum Cookie). */
export const WEBVIEW_UA_SUFFIX = 'FinestSitesApp/1';

/** Rückweg nach der Stripe-Einrichtung (Apple-Anmeldefenster schließt sich bei diesem Schema). */
export const CONNECT_RETURN_URL = 'finestsites://partner/connect-return';

/** Öffentliche Seiten, die die App im Safari-Fenster öffnet (keine Kaufseiten). */
export const WEB_LINKS = {
  forgotPassword: `${API_BASE}/forgot-password`,
  impressum: 'https://finestsites.io/impressum',
  datenschutz: 'https://finestsites.io/datenschutz',
  agb: 'https://finestsites.io/agb',
} as const;

/** Inaktivität, nach der Face ID beim Zurückkehren wieder gefragt wird. */
export const LOCK_GRACE_MS = 5 * 60 * 1000;
