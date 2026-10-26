import { db } from '@/lib/db'
import { pushDevices, sessions } from '@/lib/db/schema'
import { and, inArray, max, or, like, sql, type SQL } from 'drizzle-orm'

/**
 * Nutzung der nativen FinestSites-App je Konto (Admin-Ansicht).
 *
 * Quellen, in dieser Reihenfolge:
 *  1. `push_devices` – jedes registrierte Gerät kennt Plattform + App-Version (`source: 'push'`).
 *  2. `sessions` (BetterAuth) – API-Aufrufe der App tragen einen User-Agent
 *     „FinestSites/<build> …“ (native Requests) bzw. „… FinestSitesApp/1“ (WebView).
 *     Liefert nur „installiert + zuletzt gesehen“ (`source: 'session'`).
 */
export type AppPlatform = 'ios' | 'android'

export interface AppUsage {
  installed: boolean
  platforms: AppPlatform[]
  appVersion: string | null
  /** ISO-Zeitstempel */
  lastSeenAt: string | null
  source: 'push' | 'session' | null
}

export const NO_APP_USAGE: AppUsage = {
  installed: false,
  platforms: [],
  appVersion: null,
  lastSeenAt: null,
  source: null,
}

/** User-Agent-Muster der nativen App (Requests) und der eingebetteten WebView. */
const APP_UA_NATIVE_PREFIX = 'FinestSites/%'
const APP_UA_WEBVIEW_MARKER = '%FinestSitesApp/%'

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null
  const date = d instanceof Date ? d : new Date(d)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * Zwei Aggregat-Abfragen (kein N+1): push_devices und sessions je `user_id` gruppiert.
 * Ohne `userIds` werden alle Konten berücksichtigt.
 */
export async function getAppUsageByUser(userIds?: string[]): Promise<Map<string, AppUsage>> {
  const result = new Map<string, AppUsage>()
  if (userIds && userIds.length === 0) return result

  const pushScope: SQL | undefined = userIds ? inArray(pushDevices.userId, userIds) : undefined
  const sessionUa = or(like(sessions.userAgent, APP_UA_NATIVE_PREFIX), like(sessions.userAgent, APP_UA_WEBVIEW_MARKER))
  const sessionScope: SQL | undefined = userIds ? and(sessionUa, inArray(sessions.userId, userIds)) : sessionUa

  const [pushRows, sessionRows] = await Promise.all([
    db
      .select({
        userId: pushDevices.userId,
        // Plattformen aller Geräte (auch deaktivierte – die App war installiert)
        platforms: sql<string[]>`array_agg(distinct ${pushDevices.platform})`,
        lastSeenAt: max(pushDevices.lastSeenAt),
        // Version des zuletzt gesehenen Geräts
        appVersion: sql<string | null>`(array_agg(${pushDevices.appVersion} order by ${pushDevices.lastSeenAt} desc nulls last))[1]`,
      })
      .from(pushDevices)
      .where(pushScope)
      .groupBy(pushDevices.userId),
    db
      .select({
        userId: sessions.userId,
        lastSeenAt: max(sessions.updatedAt),
      })
      .from(sessions)
      .where(sessionScope)
      .groupBy(sessions.userId),
  ])

  for (const row of pushRows) {
    const platforms = (row.platforms ?? [])
      .filter((p): p is AppPlatform => p === 'ios' || p === 'android')
      .sort()
    result.set(row.userId, {
      installed: true,
      platforms,
      appVersion: row.appVersion ?? null,
      lastSeenAt: toIso(row.lastSeenAt),
      source: 'push',
    })
  }

  for (const row of sessionRows) {
    const existing = result.get(row.userId)
    const sessionSeen = toIso(row.lastSeenAt)
    if (existing) {
      // Push-Daten bleiben führend; nur „zuletzt“ darf durch eine jüngere App-Sitzung aktualisiert werden
      if (sessionSeen && (!existing.lastSeenAt || sessionSeen > existing.lastSeenAt)) {
        existing.lastSeenAt = sessionSeen
      }
      continue
    }
    result.set(row.userId, {
      installed: true,
      platforms: [],
      appVersion: null,
      lastSeenAt: sessionSeen,
      source: 'session',
    })
  }

  return result
}

/** Nutzung eines einzelnen Kontos. */
export async function getAppUsageForUser(userId: string): Promise<AppUsage> {
  const map = await getAppUsageByUser([userId])
  return map.get(userId) ?? NO_APP_USAGE
}
