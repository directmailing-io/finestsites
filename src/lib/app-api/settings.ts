/**
 * App-Einstellungen aus app_settings (ohne Deploy änderbar, z. B. Notschalter je Bereich).
 *
 *   app_min_version_ios / app_latest_version_ios         (Standard 1.0.0)
 *   app_min_version_android / app_latest_version_android (Standard 1.0.0)
 *   app_feature_partner | app_feature_push | app_feature_editor | app_feature_support | app_feature_submissions
 *       'false' / '0' / 'off' = aus, alles andere (auch fehlend) = an
 *   app_maintenance_message   (leer = keine Wartung)
 *
 * Push hängt zusätzlich am globalen Schalter (src/lib/push/config.ts).
 */
import { readAppSettings, isPushEnabled } from '@/lib/push/config'
import type { AppFeatures } from '@/lib/contracts/app-v1/config'

const KEYS = [
  'app_min_version_ios', 'app_latest_version_ios',
  'app_min_version_android', 'app_latest_version_android',
  'app_feature_partner', 'app_feature_push', 'app_feature_editor', 'app_feature_support', 'app_feature_submissions',
  'app_maintenance_message',
] as const

const SEMVER = /^\d+\.\d+\.\d+$/
const DEFAULT_VERSION = '1.0.0'

function flag(v: string | undefined): boolean {
  if (v == null) return true
  return !['false', '0', 'off', 'no', 'aus'].includes(v.trim().toLowerCase())
}
function version(v: string | undefined): string {
  const t = (v ?? '').trim()
  return SEMVER.test(t) ? t : DEFAULT_VERSION
}

export type AppRuntimeSettings = {
  platforms: { ios: { minSupported: string; latest: string }; android: { minSupported: string; latest: string } }
  features: AppFeatures
  maintenanceMessage: string | null
}

const CACHE_MS = 30_000
let cache: { at: number; value: AppRuntimeSettings } | null = null

export async function getAppRuntimeSettings(): Promise<AppRuntimeSettings> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_MS) return cache.value
  let s: Record<string, string> = {}
  try { s = await readAppSettings([...KEYS]) } catch { s = {} }
  const pushOn = await isPushEnabled()
  const iosMin = version(s.app_min_version_ios)
  const andMin = version(s.app_min_version_android)
  const value: AppRuntimeSettings = {
    platforms: {
      ios: { minSupported: iosMin, latest: SEMVER.test(s.app_latest_version_ios ?? '') ? s.app_latest_version_ios!.trim() : iosMin },
      android: { minSupported: andMin, latest: SEMVER.test(s.app_latest_version_android ?? '') ? s.app_latest_version_android!.trim() : andMin },
    },
    features: {
      partnerProgram: flag(s.app_feature_partner),
      push: pushOn && flag(s.app_feature_push),
      editor: flag(s.app_feature_editor),
      support: flag(s.app_feature_support),
      submissions: flag(s.app_feature_submissions),
    },
    maintenanceMessage: (s.app_maintenance_message ?? '').trim() || null,
  }
  cache = { at: now, value }
  return value
}
