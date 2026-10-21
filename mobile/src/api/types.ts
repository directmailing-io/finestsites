/**
 * Datenformen der App-Schnittstellen.
 *
 * Bestehende Routen (/api/sites, /api/submissions, /api/support/*, /api/user/profile, …) sind
 * wie im Web-Code abgebildet. Die neuen Routen unter /api/app/v1/* spiegeln den Plan; sobald
 * `src/lib/contracts/app-v1/` (zod) im Repo liegt, werden diese Typen daraus abgeleitet und
 * diese Datei schrumpft auf Re-Exporte.
 *
 * Grundregel: Der Server schickt Codes, die App hat eigene neutrale Texte. Kein Kauftext vom Server.
 */

// ── /api/app/v1/config ────────────────────────────────────────────────────────
export interface AppConfig {
  min_version: string;
  latest_version: string;
  /** Notschalter je Bereich, z. B. Partnerprogramm vorübergehend ausblenden */
  kill_switches: Partial<Record<'affiliate' | 'editor' | 'support' | 'push', boolean>>;
  support_hours: { start: number; end: number };
}

// ── /api/app/v1/me ────────────────────────────────────────────────────────────
export interface Socials {
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  linkedin: string | null;
  youtube: string | null;
}

export interface Me {
  id: string;
  email: string;
  email_verified: boolean;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  profile_image_url: string | null;
  team_partner_number: string | null;
  socials: Socials;
  /** Nur Anzeige: „Tarif: Pro · 2 von 3 Webseiten“. null = kein Tarif → nichts anzeigen. */
  plan_label: { name: string; sites_used: number; sites_limit: number | null } | null;
  onboarding: {
    needs_username: boolean;
    needs_consent: boolean;
    /** Teampartner-Nummer & Foto sind freiwillig: nur einmal anbieten */
    offer_team_partner: boolean;
    offer_photo: boolean;
  };
  features: { affiliate: boolean };
  email_opt_out: EmailCategoryKey[];
}

// ── /api/app/v1/overview ──────────────────────────────────────────────────────
export type AccountStatusCode = 'ok' | 'no_sites' | 'drafts_only' | 'site_offline' | 'account_notice';

export type TodoCode =
  | 'first_site'
  | 'unread_submissions'
  | 'unpublished_changes'
  | 'complete_profile'
  | 'team_partner_missing'
  | 'tax_profile_missing'
  | 'domain_pending'
  | 'support_reply';

export interface Todo {
  id: string;
  code: TodoCode;
  count?: number;
  site_id?: string;
  site_title?: string;
}

export interface Overview {
  account_status: { code: AccountStatusCode; online_count: number; offline_count: number };
  todos: Todo[];
  week: { visitors: number; visitors_prev: number; submissions: number; submissions_prev: number };
  unread: { submissions: number; support: number; notifications: number };
}

// ── /api/sites ────────────────────────────────────────────────────────────────
export type SiteStatus = 'draft' | 'published' | 'deactivated' | 'deleted';

export interface Site {
  id: string;
  template_id: string;
  status: SiteStatus;
  created_at: string;
  username: string | null;
  custom_domain: string | null;
  custom_domain_status: string | null;
  unread_submissions?: number;
  has_unpublished_changes?: boolean;
  /** Nur App (overview): Besucher der letzten 7 Tage */
  visitors_7d?: number;
  templates: { title: string; domain: string; preview_images?: string[] | null } | null;
}

export interface Template {
  id: string;
  title: string;
  description: string | null;
  domain: string;
  preview_images: string[] | null;
  is_free: boolean;
  badge: string | null;
  is_coming_soon: boolean;
}

export interface DomainInfo {
  domain: string | null;
  status: 'none' | 'pending' | 'active' | 'error';
}

// ── /api/submissions ──────────────────────────────────────────────────────────
export interface Submission {
  id: string;
  user_site_id: string;
  form_name: string;
  data: Record<string, unknown>;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
  site: { title: string; domain: string } | null;
}

export type SubmissionStatus = 'all' | 'unread' | 'archived';

export interface SubmissionList {
  submissions: Submission[];
  total: number;
}

// ── /api/support/* ────────────────────────────────────────────────────────────
export type ConversationStatus = 'open' | 'waiting' | 'closed';

export interface ConversationSummary {
  id: string;
  subject: string | null;
  status: ConversationStatus;
  createdAt: string;
  updatedAt?: string;
  unreadByUser: number;
  lastMessage: { content: string; contentType: string; senderType: 'user' | 'admin' } | null;
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

export type ImpersonationState = 'pending' | 'approved' | 'active' | 'ended' | 'rejected' | 'expired';

// ── /api/app/v1/notifications ─────────────────────────────────────────────────
export type NotificationKind = 'submission' | 'support' | 'site' | 'partner' | 'system';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** App-Route, z. B. /inbox/123 */
  href: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  push: Record<'submissions' | 'support' | 'sites' | 'partner', boolean>;
  quiet_hours: { enabled: boolean; start: string; end: string };
}

// ── E-Mail-Kategorien (src/lib/email/categories.ts) ───────────────────────────
export type EmailCategoryKey = 'system' | 'updates' | 'tips' | 'offers';

// ── /api/app/v1/affiliate ─────────────────────────────────────────────────────
export type PayoutMode = 'credit' | 'payout';

export interface TaxProfile {
  tax_status: 'kleinunternehmer' | 'regelbesteuert';
  full_name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  tax_id: string;
  entrepreneur_confirmed: boolean;
  consent_at: string | null;
}

export interface AffiliateHistoryItem {
  id: string;
  date: string;
  amount_cents: number;
  /** pending = 14 Tage Schutzfrist, available, paid (ausgezahlt), credited (verrechnet), reversed */
  status: 'pending' | 'available' | 'paid' | 'credited' | 'reversed';
  available_at: string | null;
}

export interface Affiliate {
  eligible: boolean;
  link: string;
  code: string;
  /** Neutraler Erklärsatz vom Server (Plan v2: neutrale Fassung). */
  pitch: string;
  commission_percent: number;
  earnings: { available_cents: number; pending_cents: number; paid_cents: number };
  payout_mode: PayoutMode;
  min_payout_cents: number;
  payout_account: { status: 'none' | 'incomplete' | 'active'; bank_name: string | null; bank_last4: string | null };
  tax_profile: { complete: boolean; data: TaxProfile | null };
  referrals: { active: number; paused: number; items: { id: string; name: string; since: string; status: 'active' | 'paused' }[] };
  history: AffiliateHistoryItem[];
}

export interface CreditNote {
  id: string;
  number: string;
  date: string;
  amount_cents: number;
  ready: boolean;
  method: 'credit' | 'transfer';
}

// ── Konto löschen (/api/app/v1/account/deletion) ──────────────────────────────
// Spiegel von src/lib/contracts/app-v1/account-deletion.ts (Server prüft seine Antworten dagegen).
export type PartnerBalanceChoice = 'payout' | 'waive';

export interface DeletionInfo {
  status: 'none' | 'scheduled';
  requestedAt: string | null;
  scheduledFor: string | null;
  graceDays: number;
  /** false z. B. beim Admin-Konto */
  canDelete: boolean;
  blockedReason: 'admin' | null;
  partnerBalance: {
    currency: 'EUR';
    availableCents: number;
    pendingCents: number;
    /** schon gutgeschriebenes, noch nicht verrechnetes Kundenguthaben */
    customerCreditCents: number;
    /** > 0 → Wahl Auszahlung/Verzicht ist Pflicht */
    totalCents: number;
    hasPayoutAccount: boolean;
    taxProfileComplete: boolean;
    choice: PartnerBalanceChoice | null;
    /** Wortlaut der Verzichtserklärung (so wird er gespeichert) */
    waiverText: string;
  };
}

export interface DeletionRequestResult {
  status: 'scheduled';
  scheduledFor: string;
  /** Alle Sitzungen sind beendet – lokal abmelden */
  signedOut: true;
}

export interface DeletionCancelResult {
  status: 'none';
  sitesOffline: boolean;
}

// ── Fehler: feste Codes vom Server ────────────────────────────────────────────
export interface ApiErrorBody {
  error?: string;
  code?: string;
  message?: string;
}
