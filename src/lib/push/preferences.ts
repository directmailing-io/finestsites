import { db } from '@/lib/db'
import { notificationPreferences, type NotificationPreference } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { DEFAULT_QUIET_HOURS, type QuietHours } from './quiet-hours'
import type { NotificationPreferences } from '@/lib/contracts/app-v1/preferences'
import type { PushCategory } from '@/lib/contracts/app-v1/push'

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  leads: true,
  support: true,
  account: true,
  partner: true,
  quietHours: { enabled: DEFAULT_QUIET_HOURS.enabled, start: DEFAULT_QUIET_HOURS.start, end: DEFAULT_QUIET_HOURS.end },
  timezone: DEFAULT_QUIET_HOURS.timezone,
}

export function rowToPreferences(row: NotificationPreference | null | undefined): NotificationPreferences {
  if (!row) return structuredClone(DEFAULT_PREFERENCES)
  return {
    leads: row.leads,
    support: row.support,
    account: row.account,
    partner: row.partner,
    quietHours: { enabled: row.quietHoursEnabled, start: row.quietStartHour, end: row.quietEndHour },
    timezone: row.timezone,
  }
}

export function categoryAllowed(p: NotificationPreferences, c: PushCategory): boolean {
  return !!p[c]
}

export function quietHoursOf(p: NotificationPreferences): QuietHours {
  return { ...p.quietHours, timezone: p.timezone }
}

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const row = await db.query.notificationPreferences.findFirst({ where: eq(notificationPreferences.userId, userId) })
  return rowToPreferences(row)
}

export async function getPreferencesMap(userIds: string[]): Promise<Map<string, NotificationPreferences>> {
  const map = new Map<string, NotificationPreferences>()
  if (userIds.length === 0) return map
  const rows = await db.select().from(notificationPreferences).where(inArray(notificationPreferences.userId, userIds))
  for (const r of rows) map.set(r.userId, rowToPreferences(r))
  for (const id of userIds) if (!map.has(id)) map.set(id, rowToPreferences(null))
  return map
}

export function isValidTimezone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }); return true } catch { return false }
}
