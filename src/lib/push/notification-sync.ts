/**
 * Mitteilungs-Postfach (user_notifications) mit dem Rest der App abgleichen: Ist das, worauf eine Mitteilung
 * zeigt, schon gelesen (Anfrage geöffnet/archiviert, Support-Antwort gelesen, Chat gelesen oder gelöscht),
 * gilt auch die Mitteilung als gelesen. Sonst blieb die rote Zahl unter „Mehr → Mitteilungen“ stehen,
 * obwohl alles erledigt war (Daniel, 30.10.2026). Läuft vor jedem Zählen (Übersicht, Postfach), eine Abfrage.
 */
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function syncNotificationReads(userId: string): Promise<void> {
  try {
    await db.execute(sql`
      update user_notifications n set read_at = now()
      where n.user_id = ${userId} and n.read_at is null and (
        (n.type = 'submission' and not exists (
          select 1 from form_submissions f
          where f.id::text = n.data->>'submissionId' and f.read_at is null and f.archived_at is null and f.is_spam = false))
        or (n.type = 'support_reply' and not exists (
          select 1 from support_conversations c
          where c.id::text = n.data->>'conversationId' and c.unread_by_user > 0 and c.deleted_by_user = false))
        or (n.type = 'chat_message' and not exists (
          select 1 from chat_conversations c
          where c.id::text = n.data->>'conversationId' and c.owner_unread > 0 and c.status = 'open'))
      )`)
  } catch (err) {
    console.error('[push/notification-sync] failed:', err instanceof Error ? err.message : err)
  }
}
