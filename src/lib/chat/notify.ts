/**
 * Mails des Besucher-Chats (beide über layout() aus src/lib/email/templates.ts, Kategorie system,
 * Versand über sendEmail wie alle anderen Benachrichtigungen – lokal/Test scheitert Resend still).
 *
 *   notifyVisitorOfReply – „{Betreiber} hat dir geantwortet“, nur wenn der Besucher eine E-Mail
 *     hinterlegt UND notify_by_email an hat UND seit ≥ 2 min nicht online war UND die letzte
 *     Mail ≥ 30 min her ist. Enthält Resume-Link (30 Tage, einmalig) und Abmelde-Link.
 *     Kein Reply-To auf den Betreiber (der Besucher antwortet im Chat).
 *   sendChatReportMail – Meldung an info@finestsites.io mit den letzten 20 Nachrichten.
 *
 * Beide Funktionen werfen nie.
 */
import { db } from '@/lib/db'
import { chatConversations, type ChatConversationRow, type ChatMessageRow } from '@/lib/db/schema'
import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { sendEmail } from '@/lib/resend'
import { chatReplyEmail, chatReportEmail } from '@/lib/email/templates'
import { appUrl } from '@/lib/app-api/http'
import { createResumeToken, previewOf } from './service'

export const REPLY_MAIL_MIN_OFFLINE_MS = 2 * 60_000
export const REPLY_MAIL_THROTTLE_MS = 30 * 60_000
export const CHAT_REPORT_EMAIL = process.env.ADMIN_NOTIFY_EMAIL ?? 'info@finestsites.io'

export const REPORT_REASON_LABELS: Record<string, string> = {
  spam: 'Spam oder Werbung',
  abuse: 'Beleidigung oder Belästigung',
  illegal: 'Rechtswidriger Inhalt',
  other: 'Sonstiges',
}

export function resumeUrl(siteHost: string, token: string, unsubscribe = false): string {
  return `https://${siteHost}/?fs_chat=${encodeURIComponent(token)}${unsubscribe ? '&unsubscribe=1' : ''}`
}

export function shouldNotifyVisitor(conv: ChatConversationRow, now = Date.now()): boolean {
  if (!conv.visitorEmail || !conv.notifyByEmail) return false
  if (conv.visitorLastSeenAt && now - conv.visitorLastSeenAt.getTime() < REPLY_MAIL_MIN_OFFLINE_MS) return false
  if (conv.visitorNotifiedAt && now - conv.visitorNotifiedAt.getTime() < REPLY_MAIL_THROTTLE_MS) return false
  return true
}

export async function notifyVisitorOfReply(input: {
  conversationId: string
  ownerName: string
  siteHost: string
  body: string
}): Promise<'sent' | 'skipped' | 'error'> {
  try {
    const conv = await db.query.chatConversations.findFirst({ where: eq(chatConversations.id, input.conversationId) })
    if (!conv || !shouldNotifyVisitor(conv)) return 'skipped'
    // Drossel zuerst setzen (zwei PM2-Prozesse): nur wer die Zeile tatsächlich umstellt, sendet
    const claimed = await db.update(chatConversations)
      .set({ visitorNotifiedAt: new Date() })
      .where(and(
        eq(chatConversations.id, conv.id),
        or(isNull(chatConversations.visitorNotifiedAt), lt(chatConversations.visitorNotifiedAt, new Date(Date.now() - REPLY_MAIL_THROTTLE_MS))),
      ))
      .returning({ id: chatConversations.id })
    if (claimed.length === 0) return 'skipped'

    const token = await createResumeToken(conv.id)
    const html = chatReplyEmail({
      ownerName: input.ownerName,
      preview: previewOf(input.body),
      openUrl: resumeUrl(input.siteHost, token),
      unsubscribeUrl: resumeUrl(input.siteHost, token, true),
      siteHost: input.siteHost,
    })
    const r = await sendEmail({
      to: conv.visitorEmail!,
      subject: `${input.ownerName} hat dir geantwortet`,
      html,
      type: 'chat_reply',
      category: 'system',
    })
    return r.status === 'sent' ? 'sent' : 'error'
  } catch (err) {
    console.error('[chat/notify] reply mail failed:', err instanceof Error ? err.message : err)
    return 'error'
  }
}

export async function sendChatReportMail(input: {
  conversation: ChatConversationRow
  reason: string
  note: string | null
  blocked: boolean
  ownerEmail: string
  ownerUsername: string | null
  siteTitle: string
  siteHost: string
  messages: ChatMessageRow[]
}): Promise<void> {
  try {
    const label = REPORT_REASON_LABELS[input.reason] ?? input.reason
    const html = chatReportEmail({
      reasonLabel: label,
      note: input.note,
      accountLabel: `${input.ownerEmail}${input.ownerUsername ? ` (${input.ownerUsername})` : ''}`,
      siteLabel: `${input.siteTitle} – ${input.siteHost}`,
      conversationId: input.conversation.id,
      blocked: input.blocked,
      adminUrl: `${appUrl()}/admin/besucher-chat?conversation=${input.conversation.id}`,
      messages: input.messages.slice(-20).map(m => ({
        sender: m.sender === 'visitor' ? 'Besucher' : m.sender === 'owner' ? 'Betreiber' : 'System',
        body: m.body,
        at: m.createdAt.toISOString().replace('T', ' ').slice(0, 16),
      })),
    })
    await sendEmail({
      to: CHAT_REPORT_EMAIL,
      subject: `Chat gemeldet: ${label}`,
      html,
      type: 'chat_report',
      category: 'system',
    })
  } catch (err) {
    console.error('[chat/notify] report mail failed:', err instanceof Error ? err.message : err)
  }
}
