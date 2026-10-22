/**
 * Mitteilung in die Warteschlange stellen (push_outbox) + Eintrag im Mitteilungs-Postfach
 * der App (user_notifications).
 *
 * GARANTIEN (für die Auslöser in Formular-, Support-, Domain- und Zahlungs-Code):
 *   - wirft NIE (alle Fehler werden geloggt und geschluckt) → ein Formular-Eingang oder eine
 *     Support-Nachricht kann daran nicht scheitern
 *   - tut NICHTS, solange Push abgeschaltet ist (isPushEnabled) → keine Zeilen, keine Abfragen
 *     außer dem (zwischengespeicherten) Schalter
 *   - Drosselung je Nutzer + collapseKey in der DB (Advisory-Lock, sicher mit 2 PM2-Prozessen)
 */
import { db } from '@/lib/db'
import { pushOutbox, userNotifications } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { isPushEnabled } from './config'
import type { PushCategory } from '@/lib/contracts/app-v1/push'

export type EnqueueInput = {
  userId: string
  category: PushCategory
  type: string
  /**
   * Sichtbar auf dem Sperrbildschirm → keine Preise oder Kauf-Hinweise. Interessenten-Daten nur im
   * Besucher-Chat (Name + Nachrichtentext wie bei WhatsApp, Daniels Entscheidung 22.10.2026); die
   * Vorschau lässt sich in iOS unter Mitteilungen → „Vorschauen zeigen“ systemweit abschalten.
   */
  title: string
  body: string
  data?: Record<string, unknown>
  /** Gleicher Schlüssel innerhalb von throttleSeconds → keine zweite Mitteilung */
  collapseKey?: string
  throttleSeconds?: number
  /** Danach nicht mehr senden (z. B. Zugriffsanfrage des Supports) */
  expiresAt?: Date
  /** Zusätzlich ins Mitteilungs-Postfach der App (Standard: ja) */
  inbox?: boolean
}

export type EnqueueResult = 'disabled' | 'queued' | 'throttled' | 'error'

/**
 * Sofortversand: nach dem Einreihen wird die Warteschlange direkt im selben Prozess abgearbeitet
 * (statt auf den Minuten-Cron zu warten – Daniel: Push kam erst nach 30 s+). Mehrere Auslöser in
 * kurzer Folge werden zu einem Lauf zusammengefasst; läuft gerade ein Lauf, folgt danach genau
 * ein weiterer. Der Cron bleibt als Netz (Nachtruhe-Verschiebungen, Neustarts, Fehler).
 */
let drainTimer: ReturnType<typeof setTimeout> | null = null
let draining = false
let drainAgain = false
function scheduleImmediateDrain(): void {
  if (drainTimer) return
  drainTimer = setTimeout(() => {
    drainTimer = null
    void runImmediateDrain()
  }, 150)
}
async function runImmediateDrain(): Promise<void> {
  if (draining) { drainAgain = true; return }
  draining = true
  try {
    const { drainPushOutbox } = await import('./drain')
    await drainPushOutbox({ limit: 100 })
  } catch (err) {
    console.error('[push/enqueue] immediate drain failed:', err instanceof Error ? err.message : err)
  } finally {
    draining = false
    if (drainAgain) { drainAgain = false; scheduleImmediateDrain() }
  }
}

export async function enqueuePush(input: EnqueueInput): Promise<EnqueueResult> {
  try {
    if (!(await isPushEnabled())) return 'disabled'
    const result = await enqueueUnchecked(input)
    if (result === 'queued') scheduleImmediateDrain()
    return result
  } catch (err) {
    console.error('[push/enqueue] failed:', err instanceof Error ? err.message : err)
    return 'error'
  }
}

/** Ohne Schalter-Prüfung – nur für enqueuePush und Tests. */
async function enqueueUnchecked(input: EnqueueInput): Promise<EnqueueResult> {
  const data: Record<string, unknown> = { ...(input.data ?? {}), type: input.type }
  if (input.expiresAt) data.expiresAt = input.expiresAt.toISOString()

  return await db.transaction(async (tx) => {
    if (input.collapseKey && input.throttleSeconds && input.throttleSeconds > 0) {
      // Serialisiert gleichzeitige Auslöser für denselben Nutzer + Schlüssel (beide PM2-Prozesse)
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.userId + ':' + input.collapseKey}))`)
      const recent = await tx.execute(sql`
        select 1 from push_outbox
        where user_id = ${input.userId} and collapse_key = ${input.collapseKey}
          and created_at > now() - make_interval(secs => ${input.throttleSeconds})
        limit 1`)
      if (recent.length > 0) return 'throttled' as const
    }

    let notificationId: string | null = null
    if (input.inbox !== false) {
      const [n] = await tx.insert(userNotifications).values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.body,
        data,
      }).returning({ id: userNotifications.id })
      notificationId = n.id
    }

    await tx.insert(pushOutbox).values({
      userId: input.userId,
      category: input.category,
      type: input.type,
      title: input.title,
      body: input.body,
      data: notificationId ? { ...data, notificationId } : data,
      collapseKey: input.collapseKey ?? null,
      notificationId,
    })
    return 'queued' as const
  })
}
