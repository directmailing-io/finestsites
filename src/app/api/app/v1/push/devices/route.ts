/**
 * Push-Geräte der App.
 *   POST   { token, platform, appVersion?, osVersion?, deviceModel?, locale? } → anmelden (idempotent)
 *   PATCH  { token, enabled?, appVersion?, osVersion?, locale? }               → aktualisieren
 *   DELETE { token }                                                            → abmelden (vor dem Logout)
 *
 * Ein Token gehört immer genau einem Nutzer: Meldet sich auf demselben Gerät jemand anderes an,
 * wandert das Token zum neuen Konto (sonst bekäme das alte Konto die Mitteilungen des neuen).
 * Registrieren ist auch bei abgeschaltetem Versand erlaubt (es wird nur nichts gesendet).
 */
import { db } from '@/lib/db'
import { pushDevices } from '@/lib/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { appError, appJson, readJson, requireAppUser } from '@/lib/app-api/http'
import { DeleteDeviceRequest, DeviceResponse, RegisterDeviceRequest, UpdateDeviceRequest } from '@/lib/contracts/app-v1/push'
import { OkBody } from '@/lib/contracts/app-v1/errors'
import { PUSH_LIMITS } from '@/lib/push/config'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireAppUser(req, 'push-devices', 20)
  if (auth.response) return auth.response
  const userId = auth.user.id
  const body = await readJson(req, RegisterDeviceRequest)
  if (body.response) return body.response
  const d = body.data
  const now = new Date()

  const [row] = await db.insert(pushDevices).values({
    userId,
    expoToken: d.token,
    platform: d.platform,
    appVersion: d.appVersion ?? null,
    osVersion: d.osVersion ?? null,
    deviceModel: d.deviceModel ?? null,
    locale: d.locale ?? null,
    enabled: true,
    lastSeenAt: now,
  }).onConflictDoUpdate({
    target: pushDevices.expoToken,
    set: {
      userId,
      platform: d.platform,
      appVersion: d.appVersion ?? null,
      osVersion: d.osVersion ?? null,
      deviceModel: d.deviceModel ?? null,
      locale: d.locale ?? null,
      enabled: true,
      disabledReason: null,
      lastSeenAt: now,
      updatedAt: now,
    },
  }).returning({ id: pushDevices.id, platform: pushDevices.platform, enabled: pushDevices.enabled })

  // Höchstens N aktive Geräte je Nutzer – die am längsten nicht gesehenen werden abgeschaltet
  const active = await db.select({ id: pushDevices.id }).from(pushDevices)
    .where(and(eq(pushDevices.userId, userId), eq(pushDevices.enabled, true)))
    .orderBy(asc(pushDevices.lastSeenAt))
  const excess = active.length - PUSH_LIMITS.maxDevicesPerUser
  for (const old of active.slice(0, Math.max(0, excess))) {
    if (old.id === row.id) continue
    await db.update(pushDevices).set({ enabled: false, disabledReason: 'limit', updatedAt: now }).where(eq(pushDevices.id, old.id))
  }

  return appJson(DeviceResponse, { id: row.id, platform: row.platform as 'ios' | 'android', enabled: row.enabled }, { status: 201 })
}

export async function PATCH(req: Request) {
  const auth = await requireAppUser(req, 'push-devices', 20)
  if (auth.response) return auth.response
  const body = await readJson(req, UpdateDeviceRequest)
  if (body.response) return body.response
  const d = body.data
  const now = new Date()

  const set: Partial<typeof pushDevices.$inferInsert> = { lastSeenAt: now, updatedAt: now }
  if (d.appVersion !== undefined) set.appVersion = d.appVersion
  if (d.osVersion !== undefined) set.osVersion = d.osVersion
  if (d.locale !== undefined) set.locale = d.locale
  if (d.enabled !== undefined) { set.enabled = d.enabled; set.disabledReason = d.enabled ? null : 'user' }

  const [row] = await db.update(pushDevices).set(set)
    .where(and(eq(pushDevices.expoToken, d.token), eq(pushDevices.userId, auth.user.id)))
    .returning({ id: pushDevices.id, platform: pushDevices.platform, enabled: pushDevices.enabled })
  if (!row) return appError('NOT_FOUND')
  return appJson(DeviceResponse, { id: row.id, platform: row.platform as 'ios' | 'android', enabled: row.enabled })
}

export async function DELETE(req: Request) {
  const auth = await requireAppUser(req, 'push-devices', 20)
  if (auth.response) return auth.response
  const body = await readJson(req, DeleteDeviceRequest)
  if (body.response) return body.response
  // Nur eigene Geräte; unbekanntes Token = trotzdem ok (idempotent, verrät nichts)
  await db.delete(pushDevices).where(and(eq(pushDevices.expoToken, body.data.token), eq(pushDevices.userId, auth.user.id)))
  return appJson(OkBody, { ok: true })
}
