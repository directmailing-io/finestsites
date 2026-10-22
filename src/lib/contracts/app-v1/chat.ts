import { z } from 'zod'
import { Uuid, IsoDateTime } from './common'

/**
 * Besucher-Chat (Seitenbesucher ↔ Seitenbetreiber) – Betreiber-Seite.
 * Gilt für App (Bearer) und Web-Dashboard (Cookie-Sitzung) gleichermaßen: /api/app/v1/chat/…
 *
 * Nur freigeschaltete Konten (app_settings visitor_chat_enabled + visitor_chat_users) sehen den Bereich;
 * für alle anderen antworten die Endpunkte mit FEATURE_DISABLED (403) und MeResponse.features.visitorChat = false.
 */

export const ChatConversationStatus = z.enum(['open', 'archived', 'blocked'])
export type ChatConversationStatus = z.infer<typeof ChatConversationStatus>

export const ChatSender = z.enum(['visitor', 'owner', 'system'])
export type ChatSender = z.infer<typeof ChatSender>

export const ChatMessage = z.object({
  id: Uuid,
  conversationId: Uuid,
  sender: ChatSender,
  /** Reiner Text (max. 2000 Zeichen); Links werden erst in der Anzeige erkannt. */
  body: z.string(),
  createdAt: IsoDateTime,
  /** Vom Empfänger gelesen (Besucher-Nachricht: vom Betreiber; Betreiber-Nachricht: vom Besucher). */
  readAt: IsoDateTime.nullable(),
  /** Vom Absender vergebene Kennung für optimistische Anzeige (nur bei eigenen Nachrichten gesetzt). */
  clientId: z.string().max(64).nullable(),
})
export type ChatMessage = z.infer<typeof ChatMessage>

export const ChatVisitor = z.object({
  /** Freiwillige Angaben des Besuchers; null = nicht angegeben. */
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  /** Anzeigename: Name, sonst „Besucher“ + Kurzkennung (z. B. „Besucher 4F2A“). */
  displayName: z.string(),
  /** Zwei Buchstaben für den Avatar. */
  initials: z.string(),
  /** wa.me-Link, wenn eine Telefonnummer angegeben ist. */
  whatsappUrl: z.string().url().nullable(),
  /** Besucher hat den Chat in den letzten 90 Sekunden offen gehabt. */
  online: z.boolean(),
  lastSeenAt: IsoDateTime.nullable(),
})
export type ChatVisitor = z.infer<typeof ChatVisitor>

export const ChatConversation = z.object({
  id: Uuid,
  siteId: Uuid,
  /** Titel der Webseite wie in „Meine Webseiten“. */
  siteTitle: z.string(),
  /** Host der Seite, auf der der Chat läuft (z. B. demo.wellpreneur.io). */
  siteHost: z.string(),
  /** Seite, auf der der Besucher den Chat begonnen hat (Pfad + Suche, kein Host). */
  startedOnPath: z.string().nullable(),
  visitor: ChatVisitor,
  status: ChatConversationStatus,
  /** Ungelesene Besucher-Nachrichten (für Badge und Fettdruck). */
  unread: z.number().int().nonnegative(),
  lastMessage: z.object({
    /** Gekürzt auf 140 Zeichen, einzeilig. */
    preview: z.string(),
    sender: ChatSender,
    at: IsoDateTime,
  }).nullable(),
  /** Vom Betreiber gemeldet (Datum), null = nicht gemeldet. */
  reportedAt: IsoDateTime.nullable(),
  /**
   * Gesprächs-Code, formatiert „7K4M-2P9X“: damit öffnet der Besucher das Gespräch auf einem anderen Gerät
   * (Widget „Gespräch fortsetzen“). Der Betreiber kann ihn dem Besucher nennen. 90 Tage nach der letzten
   * Nachricht ungültig; POST …/code erzeugt einen neuen. null nur bei Gesprächen ohne Code (Altbestand).
   */
  resumeCode: z.string().nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})
export type ChatConversation = z.infer<typeof ChatConversation>

/** GET /api/app/v1/chat/conversations?status=open|archived|blocked&q=&cursor= (Standard: open) */
export const ChatConversationsQuery = z.object({
  status: ChatConversationStatus.default('open'),
  q: z.string().max(100).optional(),
  /** updatedAt-Cursor (ISO) der letzten Zeile der vorigen Seite. */
  cursor: IsoDateTime.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
export const ChatConversationsResponse = z.object({
  conversations: z.array(ChatConversation),
  nextCursor: IsoDateTime.nullable(),
  /** Gesamtzahl ungelesener Besucher-Nachrichten über alle offenen Gespräche. */
  unreadTotal: z.number().int().nonnegative(),
})
export type ChatConversationsResponse = z.infer<typeof ChatConversationsResponse>

/** GET /api/app/v1/chat/conversations/[id] – Gespräch + letzte 100 Nachrichten (älteste zuerst). */
export const ChatConversationResponse = z.object({
  conversation: ChatConversation,
  messages: z.array(ChatMessage),
  /** Es gibt ältere Nachrichten als die gelieferten (GET …/messages?before=<id>). */
  hasMore: z.boolean(),
})
export type ChatConversationResponse = z.infer<typeof ChatConversationResponse>

/**
 * GET /api/app/v1/chat/conversations/[id]/messages?after=<messageId> | ?before=<messageId>
 * after = Polling (neue Nachrichten, älteste zuerst, max. 100), before = Verlauf nachladen.
 */
export const ChatMessagesQuery = z.object({
  after: Uuid.optional(),
  before: Uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
})
export const ChatMessagesResponse = z.object({
  messages: z.array(ChatMessage),
  conversation: ChatConversation,
  hasMore: z.boolean(),
})
export type ChatMessagesResponse = z.infer<typeof ChatMessagesResponse>

/** POST /api/app/v1/chat/conversations/[id]/messages */
export const SendChatMessageRequest = z.object({
  body: z.string().trim().min(1).max(2000),
  /** Idempotenz + optimistische Anzeige; dieselbe clientId liefert dieselbe Nachricht zurück. */
  clientId: z.string().min(1).max(64).optional(),
}).strict()
export const SendChatMessageResponse = z.object({ message: ChatMessage })

/** POST …/read → markiert alle Besucher-Nachrichten als gelesen. */
export const ChatOkResponse = z.object({ ok: z.literal(true), conversation: ChatConversation.optional() })

/** POST …/block – sperrt den Besucher (Kennung + IP-Hash) für alle Seiten dieses Kontos; Gespräch → blocked. */
export const BlockChatVisitorRequest = z.object({
  reason: z.string().trim().max(200).optional(),
}).strict()

/** POST …/report – meldet das Gespräch an FinestSites (Mail an info@finestsites.io, Kopie des Verlaufs). */
export const ReportChatRequest = z.object({
  reason: z.enum(['spam', 'abuse', 'illegal', 'other']),
  note: z.string().trim().max(500).optional(),
  /** Zusätzlich sofort sperren (Standard true). */
  block: z.boolean().default(true),
}).strict()

/** GET /api/app/v1/chat/unread – leichtgewichtig für Badges. */
export const ChatUnreadResponse = z.object({
  count: z.number().int().nonnegative(),
  /** Anzahl Gespräche mit ungelesenen Nachrichten. */
  conversations: z.number().int().nonnegative(),
})
export type ChatUnreadResponse = z.infer<typeof ChatUnreadResponse>

/** Push-Daten einer Chat-Mitteilung (data.type = 'chat_message', data.url = finestsites://chats/<id>). */
export const ChatPushType = z.literal('chat_message')
