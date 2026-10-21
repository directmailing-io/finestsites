/**
 * Push-Schalter und Ziel-Adressen.
 *
 * Versand ist nur an, wenn BEIDES gilt:
 *   - Umgebungsvariable PUSH_ENABLED === 'true'
 *   - app_settings.push_enabled === 'true' (Notschalter im laufenden Betrieb, ohne Deploy)
 * Sonst schreiben die Auslöser nichts (keine Zeilen) und der Cron sendet nichts.
 *
 * Außerhalb der Produktion wird exp.host nie angesprochen (nur eine lokale Test-Adresse über
 * PUSH_EXPO_URL / PUSH_EXPO_RECEIPTS_URL), außer PUSH_ALLOW_REAL_EXPO=true ist ausdrücklich gesetzt.
 */
import { db } from '@/lib/db'
import { appSettings } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'

export const PUSH_SETTING_KEY = 'push_enabled'

const DEFAULT_SEND_URL = 'https://exp.host/--/api/v2/push/send'
const DEFAULT_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts'

const CACHE_MS = 30_000
let cache: { at: number; value: boolean } | null = null

export function pushEnvEnabled(): boolean {
  return process.env.PUSH_ENABLED === 'true'
}

/** Liest einen oder mehrere app_settings-Schlüssel (fehlend = nicht im Ergebnis). */
export async function readAppSettings(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {}
  const rows = await db.select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings).where(inArray(appSettings.key, keys))
  const out: Record<string, string> = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

/** Versand an? Fehler beim Lesen (DB weg) = AUS. Ergebnis 30 s zwischengespeichert. */
export async function isPushEnabled(): Promise<boolean> {
  if (!pushEnvEnabled()) return false
  const now = Date.now()
  if (cache && now - cache.at < CACHE_MS) return cache.value
  let value = false
  try {
    const s = await readAppSettings([PUSH_SETTING_KEY])
    value = (s[PUSH_SETTING_KEY] ?? '').trim().toLowerCase() === 'true'
  } catch {
    value = false
  }
  cache = { at: now, value }
  return value
}

/** Nur für Tests: Zwischenspeicher leeren. */
export function resetPushEnabledCache(): void {
  cache = null
}

function guardUrl(url: string): string {
  const host = (() => { try { return new URL(url).hostname } catch { return '' } })()
  if (!host) throw new Error('push: ungültige Expo-Adresse')
  if (process.env.NODE_ENV !== 'production' && host === 'exp.host' && process.env.PUSH_ALLOW_REAL_EXPO !== 'true') {
    throw new Error('push: exp.host außerhalb der Produktion gesperrt (PUSH_EXPO_URL auf eine Test-Adresse setzen)')
  }
  return url
}

export function expoSendUrl(): string {
  return guardUrl(process.env.PUSH_EXPO_URL || DEFAULT_SEND_URL)
}

export function expoReceiptsUrl(): string {
  return guardUrl(process.env.PUSH_EXPO_RECEIPTS_URL || DEFAULT_RECEIPTS_URL)
}

/** Optionaler Expo-Zugriffsschlüssel („Enhanced Push Security“). */
export function expoAccessToken(): string | null {
  return process.env.EXPO_PUSH_ACCESS_TOKEN || null
}

/** Grenzen */
export const PUSH_LIMITS = {
  /** Mitteilungen je Nutzer und Stunde (Rest wird übersprungen) */
  perUserPerHour: 30,
  /** Expo nimmt höchstens 100 Nachrichten je Anfrage */
  chunkSize: 100,
  /** Empfangsbestätigungen höchstens 1000 IDs je Anfrage */
  receiptChunkSize: 300,
  /** Versuche, bevor eine Mitteilung als fehlgeschlagen gilt */
  maxAttempts: 5,
  /** Älter als das = nicht mehr senden */
  maxAgeHours: 24,
  /** Hängende 'processing'-Zeilen nach dieser Zeit wieder freigeben */
  staleLockMinutes: 10,
  /** Geräte je Nutzer (ältere werden abgeschaltet) */
  maxDevicesPerUser: 10,
} as const
