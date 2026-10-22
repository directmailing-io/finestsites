/**
 * Push-Auslöser – die EINZIGEN Funktionen, die bestehender Code aufruft.
 *
 * Jeder Aufruf ist ein einzelner, abgesicherter Fire-and-forget-Aufruf:
 *   void pushTriggers.newSubmission(...)
 * - wirft nie, gibt nie einen abgelehnten Promise zurück
 * - prüft ZUERST den Schalter; solange Push aus ist, passiert nichts (auch keine DB-Abfrage)
 *
 * Texte: neutral, keine Interessenten-Daten (Sperrbildschirm), keine Preise, keine Zahl-Links,
 * keine Kauf-Aufforderung (Apple 3.1.1). Deep-Links über data.url (finestsites://…).
 */
import { db } from '@/lib/db'
import { chatConversations, userSites } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { isPushEnabled } from './config'
import { enqueuePush } from './enqueue'

async function guarded(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    if (!(await isPushEnabled())) return
    await fn()
  } catch (err) {
    console.error(`[push/trigger:${name}] failed:`, err instanceof Error ? err.message : err)
  }
}

export type PaymentPushKind = 'notice' | 'reminder' | 'offline'

export const pushTriggers = {
  /** Neue Anfrage über ein Formular (nur Nicht-Spam). Kein Inhalt der Anfrage im Text. */
  newSubmission(userSiteId: string, submissionId: string): Promise<void> {
    return guarded('submission', async () => {
      const site = await db.query.userSites.findFirst({ where: eq(userSites.id, userSiteId), columns: { userId: true } })
      if (!site) return
      await enqueuePush({
        userId: site.userId,
        category: 'leads',
        type: 'submission',
        title: 'Neue Anfrage',
        body: 'Über deine Webseite ist eine neue Anfrage eingegangen.',
        data: { url: `finestsites://submissions/${submissionId}`, siteId: userSiteId, submissionId },
        collapseKey: `submission:${userSiteId}`,
        throttleSeconds: 60,
      })
    })
  },

  /**
   * Neue Nachricht eines Seitenbesuchers im Besucher-Chat (docs/chat/konzept.md).
   * Nie Besucherdaten oder Nachrichtentext im Sperrbildschirm.
   */
  newChatMessage(conversationId: string): Promise<void> {
    return guarded('chat', async () => {
      const conv = await db.query.chatConversations.findFirst({ where: eq(chatConversations.id, conversationId), columns: { userId: true } })
      if (!conv) return
      await enqueuePush({
        userId: conv.userId,
        category: 'chat',
        type: 'chat_message',
        title: 'Neue Chat-Nachricht',
        body: 'Ein Besucher deiner Webseite hat dir geschrieben.',
        data: { url: `finestsites://chats/${conversationId}`, conversationId },
        collapseKey: `chat:${conversationId}`,
        throttleSeconds: 120,
      })
    })
  },

  /** Antwort des Supports im Hilfe-Chat. Der Inhalt der Antwort steht nie in der Mitteilung. */
  supportReply(userId: string, conversationId: string): Promise<void> {
    return guarded('support', () => enqueuePush({
      userId,
      category: 'support',
      type: 'support_reply',
      title: 'Neue Nachricht vom Support',
      body: 'Du hast eine neue Antwort im Hilfe-Chat.',
      data: { url: `finestsites://support/${conversationId}`, conversationId },
      collapseKey: `support:${conversationId}`,
      throttleSeconds: 60,
    }))
  },

  /** Support bittet um Zugriff aufs Konto (Freigabe im Hilfe-Chat). */
  impersonationRequest(userId: string, conversationId: string, expiresAt: Date): Promise<void> {
    return guarded('impersonation', () => enqueuePush({
      userId,
      category: 'support',
      type: 'impersonation_request',
      title: 'Der Support bittet um Freigabe',
      body: 'Damit wir dir helfen können, bitten wir um kurzen Zugriff auf dein Konto. Du entscheidest im Hilfe-Chat.',
      data: { url: `finestsites://support/${conversationId}`, conversationId },
      collapseKey: `impersonation:${conversationId}`,
      throttleSeconds: 300,
      expiresAt,
    }))
  },

  /** Eigene Domain ist verbunden. */
  domainActive(userId: string, userSiteId: string, domain: string): Promise<void> {
    return guarded('domain', () => enqueuePush({
      userId,
      category: 'account',
      type: 'domain_active',
      title: 'Deine Domain ist verbunden',
      body: `${domain} zeigt jetzt auf deine Webseite.`,
      data: { url: `finestsites://sites/${userSiteId}`, siteId: userSiteId },
      collapseKey: `domain:${userSiteId}`,
      throttleSeconds: 3600,
    }))
  },

  /**
   * Zahlungs-Hinweis (parallel zur E-Mail). Bewusst OHNE Betrag, ohne Zahl-Link, ohne
   * Aufforderung – nur der Hinweis, dass die Details per E-Mail kommen.
   */
  paymentNotice(userId: string, kind: PaymentPushKind): Promise<void> {
    const body = kind === 'offline'
      ? 'Deine Webseiten sind gerade offline. Alle Details findest du in deinem E-Mail-Postfach.'
      : 'Es gibt einen Hinweis zu deinem Konto. Alle Details findest du in deinem E-Mail-Postfach.'
    return guarded('payment', () => enqueuePush({
      userId,
      category: 'account',
      type: `payment_${kind}`,
      title: 'Hinweis zu deinem Konto',
      body,
      data: { url: 'finestsites://account' },
      collapseKey: `payment:${kind}`,
      throttleSeconds: 6 * 3600,
    }))
  },
}
