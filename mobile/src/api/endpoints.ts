import { api, rawRequest, request } from './client';
import type {
  Affiliate,
  AppConfig,
  AppNotification,
  ConversationSummary,
  CreditNote,
  DeletionInfo,
  DomainInfo,
  EmailCategoryKey,
  ImpersonationState,
  Me,
  Message,
  NotificationPreferences,
  Overview,
  PartnerBalanceChoice,
  PayoutMode,
  Site,
  SubmissionList,
  SubmissionStatus,
  TaxProfile,
  Template,
} from './types';

const V1 = '/api/app/v1';

// ── Anmeldung (BetterAuth) ────────────────────────────────────────────────────

export type SignInResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'invalid' | 'unverified' | 'rate_limited' | 'failed' };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const res = await rawRequest('/api/auth/sign-in/email', {
    method: 'POST',
    body: { email: email.toLowerCase().trim(), password, rememberMe: true },
    skipAuthHandling: true,
  });
  let data: { message?: string; code?: string; token?: string } = {};
  try {
    data = await res.json();
  } catch {
    /* leere Antwort */
  }
  if (!res.ok) {
    const code = `${data.code ?? ''} ${data.message ?? ''}`.toLowerCase();
    if (code.includes('not_verified') || code.includes('not verified')) return { ok: false, reason: 'unverified' };
    if (res.status === 401) return { ok: false, reason: 'invalid' };
    if (res.status === 429) return { ok: false, reason: 'rate_limited' };
    return { ok: false, reason: 'failed' };
  }
  // bearer-Plugin: Token kommt im Header, Fallback im Body
  const token = res.headers.get('set-auth-token') ?? data.token ?? null;
  return token ? { ok: true, token } : { ok: false, reason: 'failed' };
}

export const signOut = () => request('/api/auth/sign-out', { method: 'POST', body: {}, skipAuthHandling: true });

export const sendVerificationEmail = (email: string) =>
  request('/api/auth/send-verification-email', {
    method: 'POST',
    body: { email: email.toLowerCase().trim(), callbackURL: '/onboarding/username?verified=1' },
    skipAuthHandling: true,
  });

export const changePassword = (currentPassword: string, newPassword: string) =>
  request('/api/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword, revokeOtherSessions: false },
    skipAuthHandling: true,
  });

/** Einmal-Schlüssel für den Editor (BetterAuth oneTimeToken), 1 Minute gültig, nur einmal nutzbar. */
export const createOneTimeToken = () => api.get<{ token: string }>('/api/auth/one-time-token/generate');

// ── App v1 ────────────────────────────────────────────────────────────────────

export const getConfig = () => api.get<AppConfig>(`${V1}/config`);
export const getMe = () => api.get<Me>(`${V1}/me`);
export const getOverview = () => api.get<Overview>(`${V1}/overview`);

export const getNotifications = () => api.get<{ items: AppNotification[] }>(`${V1}/notifications`);
export const markNotificationsRead = (ids: string[] | 'all') => api.post(`${V1}/notifications/read`, { ids });

export const registerPushDevice = (body: {
  token: string;
  platform: 'ios' | 'android';
  device_name: string | null;
  app_version: string;
}) => api.post(`${V1}/push/devices`, body);
export const unregisterPushDevice = (token: string) => api.del(`${V1}/push/devices`, { token });

export const getNotificationPreferences = () => api.get<NotificationPreferences>(`${V1}/notification-preferences`);
export const saveNotificationPreferences = (prefs: NotificationPreferences) =>
  api.put<NotificationPreferences>(`${V1}/notification-preferences`, prefs);

// Partnerprogramm
export const getAffiliate = () => api.get<Affiliate>(`${V1}/affiliate`);
export const setPayoutMode = (mode: PayoutMode) => api.put(`${V1}/affiliate/payout-mode`, { mode });
export const saveTaxProfile = (profile: Omit<TaxProfile, 'consent_at'> & { consent: boolean }) =>
  api.put<{ complete: boolean }>(`${V1}/affiliate/tax-profile`, profile);
export const startConnect = () => api.post<{ url: string }>(`${V1}/affiliate/connect`);
export const requestPayout = () => api.post<{ amount_cents: number }>(`${V1}/affiliate/payout`);
export const getCreditNotes = () => api.get<{ items: CreditNote[] }>(`${V1}/affiliate/credit-notes`);
/** PDF wird mit Bearer geladen (nie im Browser-Fenster ohne Anmeldung). */
export const creditNotePdfPath = (id: string) => `${V1}/affiliate/credit-notes/${encodeURIComponent(id)}`;

// Konto löschen
export const getDeletionInfo = () => api.get<DeletionInfo>(`${V1}/account/deletion`);
export const requestDeletion = (password: string, partner_balance: PartnerBalanceChoice | null) =>
  api.post<{ scheduled_for: string }>(`${V1}/account/deletion`, { password, partner_balance });

// ── Bestehende Web-Routen ─────────────────────────────────────────────────────

export const getSites = () => api.get<Site[]>('/api/sites');
export const getSite = (id: string) => api.get<Site>(`/api/sites/${id}`);
export const createSite = (template_id: string) => api.post<{ id: string }>('/api/sites', { template_id });
export const deleteSite = (id: string) => api.del(`/api/sites/${id}`);
export const unpublishSite = (id: string) => api.del(`/api/sites/${id}/publish`);
export const getDomain = (id: string) => api.get<DomainInfo>(`/api/sites/${id}/domain`);
export const getTemplates = () => api.get<Template[]>('/api/templates');

export const getSubmissions = (params: { status: SubmissionStatus; search?: string; siteId?: string }) =>
  api.get<SubmissionList>('/api/submissions', params);
export const getUnreadCount = () => api.get<{ count: number }>('/api/submissions/unread-count');
export const updateSubmission = (siteId: string, id: string, patch: { read?: boolean; archived?: boolean }) =>
  api.patch(`/api/sites/${siteId}/submissions/${id}`, patch);
export const deleteSubmission = (siteId: string, id: string) => api.del(`/api/sites/${siteId}/submissions/${id}`);

export const getConversations = () => api.get<{ conversations: ConversationSummary[] }>('/api/support/conversation');
export const getMessages = (conversationId: string, since?: string) =>
  api.get<{ messages: Message[]; conversationStatus?: string }>('/api/support/messages', { conversationId, since });
export const startConversation = (body: { content: string; contentType: 'text' | 'image'; mediaUrl?: string }) =>
  api.post<{ conversation: ConversationSummary; message: Message }>('/api/support/conversation', body);
export const sendMessage = (body: {
  conversationId: string;
  content: string;
  contentType: 'text' | 'image';
  mediaUrl?: string;
}) => api.post<{ message: Message }>('/api/support/messages', body);
export const markConversationRead = (id: string) => api.patch(`/api/support/conversation/${id}/read`);
export function uploadSupportImage(uri: string, mimeType: string, name: string) {
  const fd = new FormData();
  fd.append('file', { uri, type: mimeType, name } as unknown as Blob);
  return request<{ url: string }>('/api/support/upload', { method: 'POST', body: fd, timeoutMs: 60000 });
}
export const getImpersonationState = () =>
  api.get<{ state: ImpersonationState | null; request: { token: string } | null }>(`${V1}/impersonation`);
export const approveImpersonation = (token: string) => api.post('/api/impersonate/approve', { token });
export const rejectImpersonation = (token: string) => api.post('/api/impersonate/reject', { token });

export interface ProfilePatch {
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone?: string;
  team_partner_number?: string | null;
  email_opt_out?: EmailCategoryKey[];
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  linkedin?: string;
  youtube?: string;
}
export const updateProfile = (patch: ProfilePatch) => api.patch<{ ok: true }>('/api/user/profile', patch);
export function uploadAvatar(uri: string, mimeType: string) {
  const fd = new FormData();
  fd.append('file', { uri, type: mimeType, name: 'avatar.jpg' } as unknown as Blob);
  return request<{ url: string }>('/api/user/profile/avatar', { method: 'POST', body: fd, timeoutMs: 60000 });
}

export const setUsername = (username: string, first_name: string, last_name: string) =>
  api.post('/api/onboarding/set-username', { username, first_name, last_name });
export const giveConsent = (version: string) => api.post('/api/auth/consent', { consent: true, version });
export const setCompany = () => api.post('/api/onboarding/set-company', { nm_companies: ['PM-International'] });
