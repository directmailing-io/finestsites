/**
 * GET /api/app/v1/notification-preferences — Push-Einstellungen (fehlende Zeile = Standardwerte)
 * PUT /api/app/v1/notification-preferences — Teilupdate { leads?, support?, account?, partner?, chat?, news?, quietHours?, timezone? }
 */
import { db } from '@/lib/db'
import { notificationPreferences } from '@/lib/db/schema'
import { appError, appJson, readJson, requireAppUser } from '@/lib/app-api/http'
import { NotificationPreferencesResponse, UpdateNotificationPreferencesRequest } from '@/lib/contracts/app-v1/preferences'
import { getPreferences, isValidTimezone } from '@/lib/push/preferences'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireAppUser(req, 'notification-preferences')
  if (auth.response) return auth.response
  return appJson(NotificationPreferencesResponse, await getPreferences(auth.user.id))
}

export async function PUT(req: Request) {
  const auth = await requireAppUser(req, 'notification-preferences', 30)
  if (auth.response) return auth.response
  const body = await readJson(req, UpdateNotificationPreferencesRequest)
  if (body.response) return body.response
  const u = body.data
  if (u.timezone !== undefined && !isValidTimezone(u.timezone)) return appError('VALIDATION_FAILED', 'Unbekannte Zeitzone.')

  const cur = await getPreferences(auth.user.id)
  const next = {
    leads: u.leads ?? cur.leads,
    support: u.support ?? cur.support,
    account: u.account ?? cur.account,
    partner: u.partner ?? cur.partner,
    chat: u.chat ?? cur.chat,
    news: u.news ?? cur.news,
    quietHours: {
      enabled: u.quietHours?.enabled ?? cur.quietHours.enabled,
      start: u.quietHours?.start ?? cur.quietHours.start,
      end: u.quietHours?.end ?? cur.quietHours.end,
    },
    timezone: u.timezone ?? cur.timezone,
  }
  const values = {
    leads: next.leads,
    support: next.support,
    account: next.account,
    partner: next.partner,
    chat: next.chat,
    news: next.news,
    quietHoursEnabled: next.quietHours.enabled,
    quietStartHour: next.quietHours.start,
    quietEndHour: next.quietHours.end,
    timezone: next.timezone,
    updatedAt: new Date(),
  }
  await db.insert(notificationPreferences).values({ userId: auth.user.id, ...values })
    .onConflictDoUpdate({ target: notificationPreferences.userId, set: values })

  return appJson(NotificationPreferencesResponse, next)
}
