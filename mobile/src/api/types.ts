/**
 * Datenformen der App-Schnittstellen.
 *
 * /api/app/v1/*: abgeleitet aus den Server-Verträgen (zod) in ./contracts – eine 1:1-Kopie von
 * src/lib/contracts/app-v1, erzeugt mit `npm run sync:contracts`. Nie hier von Hand nachbauen.
 *
 * Bestehende Web-Routen (/api/sites, /api/submissions, /api/support/*, …) haben keinen Vertrag;
 * ihre Formen stehen unten so, wie der Server sie liefert (geprüft von scripts/app-e2e-test.ts).
 *
 * Grundregel: Der Server schickt Codes, die App hat eigene neutrale Texte. Kein Kauftext vom Server.
 */
import type { z } from 'zod';

import type * as C from './contracts';

// ── /api/app/v1/* (aus den Verträgen) ─────────────────────────────────────────
export type AppConfig = z.infer<typeof C.ConfigResponse>;
export type AppFeatures = z.infer<typeof C.AppFeatures>;
export type Me = z.infer<typeof C.MeResponse>;
export type Socials = z.infer<typeof C.Socials>;
export type EmailCategoryKey = z.infer<typeof C.EmailCategory>;
export type Overview = z.infer<typeof C.OverviewResponse>;
export type OverviewSite = z.infer<typeof C.SiteCard>;
export type AccountStatusCode = z.infer<typeof C.AccountStatusCode>;
export type TodoCode = z.infer<typeof C.TodoCode>;
export type Todo = z.infer<typeof C.Todo>;
export type AppNotification = z.infer<typeof C.AppNotification>;
export type NotificationList = z.infer<typeof C.NotificationsResponse>;
export type MarkReadRequest = z.infer<typeof C.MarkReadRequest>;
export type MarkReadResponse = z.infer<typeof C.MarkReadResponse>;
export type NotificationPreferences = z.infer<typeof C.NotificationPreferences>;
export type UpdateNotificationPreferences = z.infer<typeof C.UpdateNotificationPreferencesRequest>;
export type RegisterDeviceRequest = z.infer<typeof C.RegisterDeviceRequest>;
export type DeviceResponse = z.infer<typeof C.DeviceResponse>;
export type Affiliate = z.infer<typeof C.AffiliateResponse>;
export type AffiliateCommission = Affiliate['history']['commissions'][number];
export type AffiliateReferral = Affiliate['referrals']['items'][number];
export type CommissionStatus = z.infer<typeof C.CommissionStatus>;
export type PayoutMode = z.infer<typeof C.PayoutMode>;
export type PayoutModeState = z.infer<typeof C.PayoutModeResponse>;
export type ConnectResponse = z.infer<typeof C.AffiliateConnectResponse>;
export type TaxStatus = z.infer<typeof C.TaxStatus>;
export type TaxProfileState = z.infer<typeof C.TaxProfileResponse>;
export type TaxProfileInput = z.infer<typeof C.UpdateTaxProfileRequest>;
export type PayoutResult = z.infer<typeof C.PayoutResponse>;
export type PayoutResultStatus = z.infer<typeof C.PayoutResultStatus>;
export type CreditNote = z.infer<typeof C.CreditNote>;
export type CreditNoteList = z.infer<typeof C.CreditNotesResponse>;
export type ImpersonationStatus = z.infer<typeof C.ImpersonationStatus>;
export type ImpersonationState = z.infer<typeof C.ImpersonationResponse>;
export type ImpersonationDecision = z.infer<typeof C.ImpersonationDecisionRequest>['action'];
export type Template = z.infer<typeof C.AppTemplate>;
export type OneTimeToken = z.infer<typeof C.OneTimeTokenResponse>;
export type AppErrorCode = z.infer<typeof C.AppErrorCode>;
export type PublishErrorCode = z.infer<typeof C.PublishErrorCode>;

// ── Besucher-Chat (/api/app/v1/chat/*, aus contracts/chat.ts) ─────────────────
export type ChatConversationStatus = z.infer<typeof C.ChatConversationStatus>;
export type ChatSender = z.infer<typeof C.ChatSender>;
export type ChatMessage = z.infer<typeof C.ChatMessage>;
export type ChatVisitor = z.infer<typeof C.ChatVisitor>;
export type ChatConversation = z.infer<typeof C.ChatConversation>;
export type ChatConversationList = z.infer<typeof C.ChatConversationsResponse>;
export type ChatConversationDetail = z.infer<typeof C.ChatConversationResponse>;
export type ChatMessagePage = z.infer<typeof C.ChatMessagesResponse>;
export type SendChatMessageRequest = z.infer<typeof C.SendChatMessageRequest>;
export type ChatOk = z.infer<typeof C.ChatOkResponse>;
export type BlockChatVisitorRequest = z.infer<typeof C.BlockChatVisitorRequest>;
export type ReportChatRequest = z.infer<typeof C.ReportChatRequest>;
export type ChatReportReason = ReportChatRequest['reason'];
export type ChatUnread = z.infer<typeof C.ChatUnreadResponse>;

// ── /api/sites (Web-Route) ────────────────────────────────────────────────────
export type SiteStatus = 'draft' | 'published' | 'deactivated' | 'deleted';

export interface Site {
  id: string;
  template_id: string;
  status: SiteStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  username: string | null;
  custom_domain: string | null;
  custom_domain_status: string | null;
  /** nur Liste (/api/sites) */
  unread_submissions?: number;
  has_unpublished_changes?: boolean;
  /** Liste: mit preview_images; Detail (/api/sites/[id]): ohne */
  templates: { id: string; title: string; domain: string; preview_images?: string[] | null } | null;
}

// ── /api/submissions (Web-Route) ──────────────────────────────────────────────
export interface Submission {
  id: string;
  user_site_id: string;
  form_name: string;
  data: Record<string, unknown>;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
  is_spam?: boolean;
  site: { title: string; domain: string } | null;
}

export type SubmissionStatus = 'all' | 'unread' | 'archived';

export interface SubmissionList {
  submissions: Submission[];
  total: number;
}

// ── /api/support/* (Web-Routen) ───────────────────────────────────────────────
export type ConversationStatus = 'open' | 'waiting' | 'closed';

export interface ConversationSummary {
  id: string;
  subject: string | null;
  status: ConversationStatus;
  createdAt: string;
  updatedAt?: string;
  lastMessageAt?: string | null;
  unreadByUser: number;
  lastMessage: { content: string; contentType: string; senderType: 'user' | 'admin' | 'system'; createdAt?: string } | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderType: 'user' | 'admin' | 'system';
  senderId: string | null;
  content: string;
  contentType: 'text' | 'image' | 'system';
  mediaUrl: string | null;
  createdAt: string;
}

// ── Konto löschen (/api/app/v1/account/deletion, aus contracts/account-deletion.ts) ──────
export type PartnerBalanceChoice = z.infer<typeof C.BalanceChoice>;
export type DeletionInfo = z.infer<typeof C.DeletionStatusResponse>;
export type DeletionRequestBody = z.infer<typeof C.DeletionRequestBody>;
export type DeletionRequestResult = z.infer<typeof C.DeletionRequestResponse>;
export type DeletionCancelResult = z.infer<typeof C.DeletionCancelResponse>;

// ── Fehler ────────────────────────────────────────────────────────────────────
/** /api/app/v1/*: { code, message, fields? }; Web-Routen: { error, code? }; BetterAuth: { code, message }. */
export interface ApiErrorBody {
  error?: string;
  code?: string;
  message?: string;
  fields?: Record<string, string>;
}
