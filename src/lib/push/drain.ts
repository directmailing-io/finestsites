/**
 * Warteschlange abarbeiten (Cron /api/cron/push-drain, z. B. jede Minute) und
 * Empfangsbestätigungen prüfen (Cron /api/cron/push-receipts, z. B. alle 15 Minuten).
 *
 * Sicher mit mehreren Prozessen: Zeilen werden per FOR UPDATE SKIP LOCKED auf 'processing'
 * gesetzt; hängengebliebene Zeilen (Prozess-Neustart) gibt der nächste Lauf nach
 * PUSH_LIMITS.staleLockMinutes wieder frei. Nichts geht verloren, nichts kommt doppelt
 * (außer im seltenen Fall „Expo hat angenommen, Prozess stirbt vor dem Speichern“).
 */
import { db } from '@/lib/db'
import { pushDeliveries, pushDevices, pushOutbox } from '@/lib/db/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { isPushEnabled, PUSH_LIMITS } from './config'
import { badgeCountFor } from './badge'
import { categoryAllowed, getPreferencesMap, quietHoursOf } from './preferences'
import { isInQuietHours, nextAllowedTime } from './quiet-hours'
import { getExpoReceipts, sendExpoChunk, type ExpoMessage, type ExpoTicket } from './expo'
import type { PushCategory } from '@/lib/contracts/app-v1/push'

export type DrainStats = {
  disabled?: true
  claimed: number
  sent: number
  skipped: number
  deferred: number
  retried: number
  failed: number
  messages: number
  reclaimed: number
}

type ClaimedRow = {
  id: string
  user_id: string
  category: PushCategory
  type: string
  title: string
  body: string
  data: Record<string, unknown> | null
  attempts: number
  created_at: Date | string
}

const DEVICE_GONE = 'DeviceNotRegistered'

async function finish(id: string, set: Partial<typeof pushOutbox.$inferInsert>) {
  await db.update(pushOutbox).set({ lockedAt: null, ...set }).where(eq(pushOutbox.id, id))
}

export async function drainPushOutbox(opts: { limit?: number; now?: Date } = {}): Promise<DrainStats> {
  const stats: DrainStats = { claimed: 0, sent: 0, skipped: 0, deferred: 0, retried: 0, failed: 0, messages: 0, reclaimed: 0 }
  if (!(await isPushEnabled())) return { ...stats, disabled: true }
  const now = opts.now ?? new Date()
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000)

  // 1. Hängende Zeilen wieder freigeben (bzw. nach zu vielen Versuchen aufgeben)
  const reclaimed = await db.execute(sql`
    update push_outbox
       set status = case when attempts >= ${PUSH_LIMITS.maxAttempts} then 'failed' else 'pending' end,
           locked_at = null,
           last_error = coalesce(last_error, 'stale lock')
     where status = 'processing'
       and locked_at < now() - make_interval(mins => ${PUSH_LIMITS.staleLockMinutes})
    returning id`)
  stats.reclaimed = reclaimed.length

  // 2. Fällige Zeilen exklusiv übernehmen
  const claimed = await db.execute(sql`
    update push_outbox o
       set status = 'processing', locked_at = now(), attempts = o.attempts + 1
     where o.id in (
       select id from push_outbox
        where status = 'pending' and not_before <= now()
        order by not_before, created_at
        limit ${limit}
        for update skip locked)
    returning o.id, o.user_id, o.category, o.type, o.title, o.body, o.data, o.attempts, o.created_at`) as unknown as ClaimedRow[]
  stats.claimed = claimed.length
  if (claimed.length === 0) return stats

  const userIds = [...new Set(claimed.map(r => r.user_id))]
  const [prefs, devices, recent] = await Promise.all([
    getPreferencesMap(userIds),
    db.select({ id: pushDevices.id, userId: pushDevices.userId, token: pushDevices.expoToken })
      .from(pushDevices)
      .where(and(inArray(pushDevices.userId, userIds), eq(pushDevices.enabled, true))),
    // Drosselung: bereits gesendete Mitteilungen je Nutzer in der letzten Stunde
    db.select({ userId: pushOutbox.userId, n: sql<number>`count(*)::int` })
      .from(pushOutbox)
      .where(and(inArray(pushOutbox.userId, userIds), eq(pushOutbox.status, 'sent'), sql`${pushOutbox.sentAt} > now() - interval '1 hour'`))
      .groupBy(pushOutbox.userId),
  ])
  const sentLastHour = new Map<string, number>()
  for (const r of recent) sentLastHour.set(r.userId, Number(r.n))

  const devicesByUser = new Map<string, { id: string; token: string }[]>()
  for (const d of devices) {
    const list = devicesByUser.get(d.userId) ?? []
    list.push({ id: d.id, token: d.token })
    devicesByUser.set(d.userId, list)
  }
  // Badge fürs App-Symbol: nur für Nutzer mit Geräten, einmal je Lauf
  const badges = new Map<string, number | null>()
  await Promise.all([...devicesByUser.keys()].map(async uid => badges.set(uid, await badgeCountFor(uid))))

  // 3. Je Zeile entscheiden: überspringen, verschieben (Nachtruhe) oder senden
  type Pending = { outboxId: string; deviceId: string; message: ExpoMessage }
  const toSend: Pending[] = []
  const sendRows = new Map<string, ClaimedRow>()

  for (const row of claimed) {
    try {
      const p = prefs.get(row.user_id)!
      const createdAt = new Date(row.created_at)
      const data = row.data ?? {}
      const expiresAt = typeof data.expiresAt === 'string' ? new Date(data.expiresAt) : null

      if (now.getTime() - createdAt.getTime() > PUSH_LIMITS.maxAgeHours * 3600_000 || (expiresAt && expiresAt <= now)) {
        await finish(row.id, { status: 'skipped', skipReason: 'expired' }); stats.skipped++; continue
      }
      if (!categoryAllowed(p, row.category)) {
        await finish(row.id, { status: 'skipped', skipReason: 'category_off' }); stats.skipped++; continue
      }
      const quiet = quietHoursOf(p)
      if (isInQuietHours(now, quiet)) {
        // Versuch zählt nicht; nach der Nachtruhe erneut
        await db.update(pushOutbox)
          .set({ status: 'pending', lockedAt: null, notBefore: nextAllowedTime(now, quiet), attempts: sql`${pushOutbox.attempts} - 1` })
          .where(eq(pushOutbox.id, row.id))
        stats.deferred++; continue
      }
      const count = sentLastHour.get(row.user_id) ?? 0
      if (count >= PUSH_LIMITS.perUserPerHour) {
        await finish(row.id, { status: 'skipped', skipReason: 'throttled' }); stats.skipped++; continue
      }
      const devs = devicesByUser.get(row.user_id) ?? []
      if (devs.length === 0) {
        await finish(row.id, { status: 'skipped', skipReason: 'no_devices' }); stats.skipped++; continue
      }
      sentLastHour.set(row.user_id, count + 1)
      sendRows.set(row.id, row)
      for (const d of devs) {
        toSend.push({
          outboxId: row.id,
          deviceId: d.id,
          message: {
            to: d.token,
            title: row.title,
            ...(typeof data.subtitle === 'string' && data.subtitle ? { subtitle: data.subtitle } : {}),
            body: row.body,
            data: { ...data, outboxId: row.id },
            sound: 'default',
            priority: 'high',
            channelId: row.category,
            ttl: PUSH_LIMITS.maxAgeHours * 3600,
            ...(typeof badges.get(row.user_id) === 'number' ? { badge: badges.get(row.user_id) as number } : {}),
          },
        })
      }
    } catch (err) {
      console.error('[push/drain] row failed:', row.id, err instanceof Error ? err.message : err)
      await finish(row.id, { status: 'pending', lastError: String(err instanceof Error ? err.message : err).slice(0, 500) }).catch(() => {})
      stats.retried++
    }
  }

  // 4. Senden in 100er-Paketen
  const results = new Map<string, { ok: number; error: number; lastError?: string }>()
  for (let i = 0; i < toSend.length; i += PUSH_LIMITS.chunkSize) {
    const chunk = toSend.slice(i, i + PUSH_LIMITS.chunkSize)
    let tickets: ExpoTicket[] | null = null
    let chunkError: string | null = null
    try {
      tickets = await sendExpoChunk(chunk.map(c => c.message))
      stats.messages += chunk.length
    } catch (err) {
      chunkError = (err instanceof Error ? err.message : String(err)).slice(0, 500)
    }
    const deliveryRows: (typeof pushDeliveries.$inferInsert)[] = []
    const goneDevices: string[] = []
    chunk.forEach((c, idx) => {
      const r = results.get(c.outboxId) ?? { ok: 0, error: 0 }
      const t = tickets?.[idx]
      if (t && t.status === 'ok') {
        r.ok++
        deliveryRows.push({ outboxId: c.outboxId, deviceId: c.deviceId, ticketId: t.id, status: 'ok' })
      } else {
        r.error++
        const errText = t && t.status === 'error' ? (t.details?.error ?? t.message ?? 'error') : (chunkError ?? 'error')
        r.lastError = errText
        if (t && t.status === 'error' && t.details?.error === DEVICE_GONE) goneDevices.push(c.deviceId)
        // Bei Netzfehlern (kein Ticket) keine Lieferzeile – die Zeile wird später erneut versucht
        if (t) deliveryRows.push({ outboxId: c.outboxId, deviceId: c.deviceId, status: 'error', error: errText.slice(0, 500) })
      }
      results.set(c.outboxId, r)
    })
    if (deliveryRows.length) await db.insert(pushDeliveries).values(deliveryRows)
    if (goneDevices.length) {
      await db.update(pushDevices)
        .set({ enabled: false, disabledReason: 'device_not_registered', updatedAt: new Date() })
        .where(inArray(pushDevices.id, goneDevices))
    }
  }

  // 5. Ergebnis je Zeile
  for (const [id, row] of sendRows) {
    const r = results.get(id) ?? { ok: 0, error: 1, lastError: 'no result' }
    if (r.ok > 0) {
      await finish(id, { status: 'sent', sentAt: new Date(), lastError: r.error ? r.lastError ?? null : null })
      stats.sent++
    } else if (row.attempts >= PUSH_LIMITS.maxAttempts) {
      await finish(id, { status: 'failed', lastError: r.lastError ?? null })
      stats.failed++
    } else {
      // Zurück in die Warteschlange mit wachsendem Abstand (2, 4, 6 … Minuten)
      await finish(id, { status: 'pending', lastError: r.lastError ?? null, notBefore: new Date(Date.now() + row.attempts * 2 * 60_000) })
      stats.retried++
    }
  }
  return stats
}

export type ReceiptStats = { disabled?: true; checked: number; ok: number; errors: number; devicesDisabled: number }

/** Empfangsbestätigungen (Expo empfiehlt: frühestens nach 15 Minuten abfragen). */
export async function checkPushReceipts(opts: { limit?: number } = {}): Promise<ReceiptStats> {
  const stats: ReceiptStats = { checked: 0, ok: 0, errors: 0, devicesDisabled: 0 }
  if (!(await isPushEnabled())) return { ...stats, disabled: true }
  const limit = Math.min(Math.max(opts.limit ?? 1000, 1), 5000)

  const due = await db.select({ id: pushDeliveries.id, ticketId: pushDeliveries.ticketId, deviceId: pushDeliveries.deviceId })
    .from(pushDeliveries)
    .where(and(
      eq(pushDeliveries.status, 'ok'),
      sql`${pushDeliveries.receiptStatus} is null`,
      sql`${pushDeliveries.ticketId} is not null`,
      sql`${pushDeliveries.createdAt} < now() - interval '15 minutes'`,
      sql`${pushDeliveries.createdAt} > now() - interval '24 hours'`,
    ))
    .limit(limit)

  for (let i = 0; i < due.length; i += PUSH_LIMITS.receiptChunkSize) {
    const chunk = due.slice(i, i + PUSH_LIMITS.receiptChunkSize)
    const receipts = await getExpoReceipts(chunk.map(c => c.ticketId!))
    const gone: string[] = []
    for (const d of chunk) {
      const r = receipts[d.ticketId!]
      if (!r) continue // noch nicht da – nächster Lauf
      stats.checked++
      if (r.status === 'ok') {
        stats.ok++
        await db.update(pushDeliveries).set({ receiptStatus: 'ok', receiptCheckedAt: new Date() }).where(eq(pushDeliveries.id, d.id))
      } else {
        stats.errors++
        const err = (r.details?.error ?? r.message ?? 'error').slice(0, 500)
        await db.update(pushDeliveries).set({ receiptStatus: 'error', receiptError: err, receiptCheckedAt: new Date() }).where(eq(pushDeliveries.id, d.id))
        if (r.details?.error === DEVICE_GONE && d.deviceId) gone.push(d.deviceId)
      }
    }
    if (gone.length) {
      await db.update(pushDevices)
        .set({ enabled: false, disabledReason: 'device_not_registered', updatedAt: new Date() })
        .where(inArray(pushDevices.id, gone))
      stats.devicesDisabled += gone.length
    }
  }
  return stats
}
