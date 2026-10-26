/**
 * Mini-Server im Speicher für den Mock-Modus. Beantwortet dieselben Pfade wie der echte
 * Server, damit Bildschirme und Abläufe ohne Backend geprüft werden können.
 *
 * Szenarien über die Anmelde-E-Mail:
 *   neu@…          → Ersteinrichtung (Benutzername, Einwilligung, Teampartner-Nummer, Foto)
 *   ohne-tarif@…   → kein Tarif, kein Partnerprogramm
 *   unbestaetigt@… → E-Mail noch nicht bestätigt
 *   Passwort „falsch“ → falsches Passwort
 */
import type { ChatConversation, ChatMessage, Overview, Site, Todo } from '../types';

import { waiverText } from '../contracts/account-deletion';
import { createMockDb, type MockDb } from './data';

let db: MockDb = createMockDb();


const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function parseBody(body: BodyInit | undefined): Record<string, unknown> {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return {};
}

const ZERO = { pageviews: 0, contacts: 0, leads: 0 };

/** Gleiche Form wie GET /api/app/v1/overview (OverviewResponse). */
function overview(): Overview {
  const live = db.sites.filter(s => s.status !== 'deleted');
  const status = (s: Site) => (s.status === 'published' ? 'online' : s.status === 'deactivated' ? 'offline' : 'draft') as 'online' | 'offline' | 'draft';
  const cards = live.map(s => {
    const domain = s.custom_domain
      ? { name: s.custom_domain, status: (s.custom_domain_status === 'active' ? 'active' : s.custom_domain_status === 'error' ? 'error' : 'pending') as 'active' | 'pending' | 'error' }
      : null;
    return {
      id: s.id,
      title: s.templates?.title ?? 'Meine Webseite',
      status: status(s),
      url: domain?.status === 'active' ? `https://${domain.name}` : db.me.user.username && s.templates ? `https://${db.me.user.username}.${s.templates.domain}` : null,
      domain,
      thumbnailUrl: s.templates?.preview_images?.[0] ?? null,
      unreadSubmissions: db.submissions.filter(x => x.user_site_id === s.id && !x.read_at && !x.archived_at).length,
      visitors7d: db.visitors[s.id] ?? 0,
      hasUnpublishedChanges: !!s.has_unpublished_changes,
      publishedAt: s.published_at,
      updatedAt: s.updated_at,
    };
  });
  const online = cards.filter(c => c.status === 'online').length;
  const offline = cards.filter(c => c.status === 'offline').length;
  const unreadSubs = cards.reduce((n, c) => n + c.unreadSubmissions, 0);
  const unreadSupport = db.conversations.reduce((n, c) => n + c.unreadByUser, 0);
  const unreadChat = db.me.features.visitorChat ? db.chatConversations.filter(c => c.status === 'open').reduce((n, c) => n + c.unread, 0) : 0;
  const todos: Todo[] = [];
  if (cards.length === 0) todos.push({ id: 'first_site', code: 'first_site' });
  if (unreadSubs > 0) todos.push({ id: 'unread_submissions', code: 'unread_submissions', count: unreadSubs });
  if (unreadChat > 0) todos.push({ id: 'unread_chats', code: 'unread_chats', count: unreadChat });
  if (unreadSupport > 0) todos.push({ id: 'support_reply', code: 'support_reply', count: unreadSupport });
  for (const c of cards) {
    if (c.status === 'online' && c.hasUnpublishedChanges) todos.push({ id: `unpublished_changes:${c.id}`, code: 'unpublished_changes', siteId: c.id, siteTitle: c.title });
    if (c.domain?.status === 'pending') todos.push({ id: `domain_pending:${c.id}`, code: 'domain_pending', siteId: c.id, siteTitle: c.title });
  }
  if (!db.me.user.teamPartnerNumber) todos.push({ id: 'team_partner_missing', code: 'team_partner_missing' });
  if (db.me.features.partnerProgram && !db.taxProfile.complete) todos.push({ id: 'tax_profile_missing', code: 'tax_profile_missing' });
  const code = cards.length === 0 ? 'no_sites' : offline > 0 ? 'site_offline' : online === 0 ? 'drafts_only' : 'ok';
  const w = db.week;
  return {
    sites: cards,
    unread: { submissions: unreadSubs, support: unreadSupport, chat: unreadChat, notifications: db.notifications.filter(n => !n.readAt).length },
    stats: {
      last7: { visitors: w.visitors, submissions: w.submissions, ...ZERO },
      prev7: { visitors: w.visitorsPrev, submissions: w.submissionsPrev, ...ZERO },
      last30: { visitors: w.visitors * 4, submissions: w.submissions * 4, ...ZERO },
    },
    accountStatus: { code, online, offline },
    todos,
    news: newsOverview(),
  };
}

// ── Neuigkeiten ──
const newsSorted = () => [...db.news].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
const newsUnread = () => db.news.filter(n => !n.readAt).length;

/** Wie overviewFor(): ungelesene Anzahl + neueste Neuigkeit, die weder gelesen noch weggewischt ist. */
function newsOverview(): Overview['news'] {
  const latest = newsSorted().find(n => !n.readAt && !n.dismissedAt) ?? null;
  return {
    unread: newsUnread(),
    latest: latest ? { id: latest.id, title: latest.title, summary: latest.summary, publishedAt: latest.publishedAt } : null,
  };
}

// ── Besucher-Chat: Antworten simulieren ──
const VISITOR_REPLIES = [
  'Danke dir, das hilft mir weiter!',
  'Okay, ich schaue mir das an und melde mich dann.',
  'Klingt gut. Wann hättest du Zeit für ein kurzes Telefonat?',
  'Perfekt, vielen Dank!',
];
let replyIndex = 0;

function chatConv(id: string) {
  return db.chatConversations.find(c => c.id === id) ?? null;
}

function touchChat(c: ChatConversation, m: ChatMessage) {
  c.lastMessage = { preview: m.body.replace(/\s*\n\s*/g, ' ').slice(0, 140), sender: m.sender, at: m.createdAt };
  c.updatedAt = m.createdAt;
}

/** Nach einer Antwort des Betreibers: Besucher liest (✓✓) und antwortet kurz darauf, solange das Gespräch offen ist. */
function scheduleVisitorReply(conversationId: string, ownerMessageId: string) {
  const snapshot = db;
  setTimeout(() => {
    if (db !== snapshot) return; // neu angemeldet, alte Daten verworfen
    const c = chatConv(conversationId);
    const m = db.chatMessages[conversationId]?.find(x => x.id === ownerMessageId);
    if (!c || !m || c.status !== 'open') return;
    m.readAt = new Date().toISOString();
    c.visitor.online = true;
    c.visitor.lastSeenAt = m.readAt;
  }, 2500);
  setTimeout(() => {
    if (db !== snapshot) return;
    const c = chatConv(conversationId);
    if (!c || c.status !== 'open') return;
    const reply: ChatMessage = {
      id: `cm_${Date.now()}`, conversationId, sender: 'visitor',
      body: VISITOR_REPLIES[replyIndex++ % VISITOR_REPLIES.length], createdAt: new Date().toISOString(), readAt: null, clientId: null,
    };
    (db.chatMessages[conversationId] ??= []).push(reply);
    c.unread += 1;
    touchChat(c, reply);
  }, 6500);
}

function syncMeAccount() {
  db.me.account.sitesTotal = db.sites.filter(s => s.status !== 'deleted').length;
  db.me.account.sitesOnline = db.sites.filter(s => s.status === 'published').length;
}

export async function mockFetch(url: string, init: { method: string; headers: Record<string, string>; body?: BodyInit }) {
  await sleep(220 + Math.random() * 260);
  const u = new URL(url);
  const path = u.pathname;
  const method = init.method;
  const body = parseBody(init.body);
  const authed = init.headers.Authorization === "Bearer mock-session-token";
  const seg = path.split('/').filter(Boolean);

  // ── Anmeldung ──
  if (path === '/api/auth/sign-in/email' && method === 'POST') {
    const email = String(body.email ?? '');
    if (String(body.password) === 'falsch') return json({ code: 'INVALID_EMAIL_OR_PASSWORD' }, 401);
    if (email.startsWith('unbestaetigt')) return json({ code: 'EMAIL_NOT_VERIFIED' }, 403);
    db = createMockDb();
    db.me.user.email = email || db.me.user.email;
    if (email.startsWith('neu')) {
      db.me.user.username = null;
      db.me.user.firstName = null;
      db.me.user.lastName = null;
      db.me.user.teamPartnerNumber = null;
      db.me.account = { sitesOnline: 0, sitesTotal: 0, paymentIssue: false, planLabel: null, quota: null };
      db.me.features.partnerProgram = false;
      db.me.onboarding = { usernameSet: false, consentGiven: false, complete: false };
      db.sites = [];
      db.submissions = [];
      db.conversations = [];
      db.notifications = [];
    }
    if (email.startsWith('ohne-chat')) db.me.features.visitorChat = false;
    if (email.startsWith('ohne-tarif')) {
      db.me.account.planLabel = null;
      db.me.account.quota = null;
      db.me.features.partnerProgram = false;
      db.sites = db.sites.filter(s => s.status === 'draft');
      syncMeAccount();
    }
    return json({ token: 'mock-session-token' }, 200, { 'set-auth-token': 'mock-session-token' });
  }
  if (path === '/api/auth/sign-out') {

    return json({ success: true });
  }
  if (path === '/api/auth/send-verification-email') return json({ status: true });
  if (path === '/api/auth/change-password') {
    if (String(body.currentPassword) === 'falsch') return json({ code: 'INVALID_PASSWORD', message: 'Invalid password' }, 400);
    return json({ status: true });
  }
  if (path === '/api/auth/one-time-token/generate') return json({ token: 'mock-ott' });

  if (path === '/api/app/v1/config') {
    return json({
      apiVersion: 1,
      platforms: { ios: { minSupported: '1.0.0', latest: '1.0.0' }, android: { minSupported: '1.0.0', latest: '1.0.0' } },
      features: { partnerProgram: true, push: true, editor: true, support: true, submissions: true },
      maintenance: { active: false, message: null },
      links: { privacy: 'https://finestsites.io/datenschutz', terms: 'https://finestsites.io/agb', imprint: 'https://finestsites.io/impressum' },
      serverTime: new Date().toISOString(),
    });
  }

  if (!authed) return json({ error: 'Unauthorized' }, 401);

  // ── App v1 ──
  if (path === '/api/app/v1/me') {
    syncMeAccount();
    return json(db.me);
  }
  if (path === '/api/app/v1/overview') return json(overview());
  if (path === '/api/app/v1/notifications') {
    return json({ items: db.notifications, unreadCount: db.notifications.filter(n => !n.readAt).length, nextCursor: null });
  }
  if (path === '/api/app/v1/notifications/read') {
    const ids = Array.isArray(body.ids) ? (body.ids as string[]) : null;
    let updated = 0;
    db.notifications = db.notifications.map(n => {
      if (n.readAt || (ids && !ids.includes(n.id)) || (!ids && body.all !== true)) return n;
      updated++;
      return { ...n, readAt: new Date().toISOString() };
    });
    return json({ updated, unreadCount: db.notifications.filter(n => !n.readAt).length });
  }
  if (path === '/api/app/v1/push/devices') {
    return method === 'DELETE' ? json({ ok: true }) : json({ id: 'd_mock', platform: 'ios', enabled: true }, method === 'POST' ? 201 : 200);
  }
  if (path === '/api/app/v1/notification-preferences') {
    if (method === 'PUT') {
      const b = body as Partial<MockDb['notificationPrefs']>;
      db.notificationPrefs = { ...db.notificationPrefs, ...b, quietHours: { ...db.notificationPrefs.quietHours, ...(b.quietHours ?? {}) } };
    }
    return json(db.notificationPrefs);
  }
  // ── Neuigkeiten ──
  if (seg[0] === 'api' && seg[1] === 'app' && seg[2] === 'v1' && seg[3] === 'news') {
    if (!seg[4]) return json({ items: newsSorted(), unreadCount: newsUnread() });
    const item = db.news.find(n => n.id === seg[4]);
    if (!item) return json({ code: 'NOT_FOUND', message: 'Diese Neuigkeit gibt es nicht mehr.' }, 404);
    const action = seg[5];
    if (!action) return json(item);
    if (method !== 'POST') return json({ code: 'NOT_FOUND', message: 'Nicht gefunden.' }, 404);
    const now = new Date().toISOString();
    if (action === 'read') item.readAt ??= now;
    else if (action === 'dismiss') item.dismissedAt ??= now;
    else if (action !== 'cta') return json({ code: 'NOT_FOUND', message: 'Nicht gefunden.' }, 404);
    return json({ item, unreadCount: newsUnread() });
  }

  // ── Besucher-Chat ──
  if (seg[0] === 'api' && seg[1] === 'app' && seg[2] === 'v1' && seg[3] === 'chat') {
    if (!db.me.features.visitorChat) return json({ code: 'FEATURE_DISABLED', message: 'Dieser Bereich ist für dein Konto nicht freigeschaltet.' }, 403);
    if (seg[4] === 'unread') {
      const open = db.chatConversations.filter(c => c.status === 'open' && c.unread > 0);
      return json({ count: open.reduce((n, c) => n + c.unread, 0), conversations: open.length });
    }
    if (seg[4] !== 'conversations') return json({ code: 'NOT_FOUND', message: 'Nicht gefunden.' }, 404);
    const unreadTotal = db.chatConversations.filter(c => c.status === 'open').reduce((n, c) => n + c.unread, 0);
    if (!seg[5]) {
      const status = (u.searchParams.get('status') ?? 'open') as ChatConversation['status'];
      const q = (u.searchParams.get('q') ?? '').toLowerCase();
      const list = db.chatConversations
        .filter(c => c.status === status)
        .filter(c => !q || [c.visitor.displayName, c.visitor.email, c.visitor.phone, c.siteTitle, c.lastMessage?.preview].some(v => v?.toLowerCase().includes(q)))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return json({ conversations: list, nextCursor: null, unreadTotal });
    }
    const c = chatConv(seg[5]);
    if (!c) return json({ code: 'NOT_FOUND', message: 'Das Gespräch gibt es nicht mehr.' }, 404);
    const all = db.chatMessages[c.id] ?? [];
    const action = seg[6];
    if (!action && method === 'GET') return json({ conversation: c, messages: all.slice(-100), hasMore: all.length > 100 });
    if (!action && method === 'DELETE') {
      db.chatConversations = db.chatConversations.filter(x => x.id !== c.id);
      delete db.chatMessages[c.id];
      return json({ ok: true });
    }
    if (action === 'messages' && method === 'GET') {
      const after = u.searchParams.get('after');
      const before = u.searchParams.get('before');
      let list = all;
      if (after) {
        const i = all.findIndex(m => m.id === after);
        list = i >= 0 ? all.slice(i + 1) : all;
      } else if (before) {
        const i = all.findIndex(m => m.id === before);
        list = (i >= 0 ? all.slice(0, i) : all).slice(-100);
      }
      return json({ messages: list, conversation: c, hasMore: false });
    }
    if (action === 'messages' && method === 'POST') {
      if (c.status === 'blocked') return json({ code: 'CONVERSATION_BLOCKED', message: 'Der Besucher ist gesperrt.' }, 409);
      const clientId = typeof body.clientId === 'string' ? body.clientId : null;
      const existing = clientId ? all.find(m => m.clientId === clientId) : null;
      if (existing) return json({ message: existing });
      const m: ChatMessage = {
        id: `cm_${Date.now()}`, conversationId: c.id, sender: 'owner', body: String(body.body ?? '').trim(),
        createdAt: new Date().toISOString(), readAt: null, clientId,
      };
      (db.chatMessages[c.id] ??= []).push(m);
      touchChat(c, m);
      if (c.status === 'archived') c.status = 'open';
      scheduleVisitorReply(c.id, m.id);
      return json({ message: m }, 201);
    }
    if (action === 'read') {
      const now = new Date().toISOString();
      for (const m of all) if (m.sender === 'visitor' && !m.readAt) m.readAt = now;
      c.unread = 0;
      return json({ ok: true, conversation: c });
    }
    if (action === 'archive' || action === 'unarchive' || action === 'block' || action === 'unblock') {
      c.status = action === 'archive' ? 'archived' : action === 'block' ? 'blocked' : 'open';
      if (action === 'block') c.unread = 0;
      return json({ ok: true, conversation: c });
    }
    if (action === 'report') {
      c.reportedAt = new Date().toISOString();
      if (body.block !== false) {
        c.status = 'blocked';
        c.unread = 0;
      }
      return json({ ok: true, conversation: c });
    }
    return json({ code: 'NOT_FOUND', message: 'Nicht gefunden.' }, 404);
  }

  if (seg[0] === 'api' && seg[1] === 'app' && seg[3] === 'affiliate' && !db.me.features.partnerProgram) {
    return json({ code: 'AFFILIATE_NOT_AVAILABLE', message: 'Dieser Bereich ist für dein Konto nicht verfügbar.' }, 403);
  }
  if (path === '/api/app/v1/affiliate') return json({ ...db.affiliate, taxProfileComplete: db.taxProfile.complete });
  if (path === '/api/app/v1/affiliate/payout-mode') {
    if (method === 'PUT') db.affiliate.payout.mode = body.mode === 'credit' ? 'credit' : 'payout';
    return json({ mode: db.affiliate.payout.mode, canChange: true, connectStatus: db.affiliate.payout.connectStatus });
  }
  if (path === '/api/app/v1/affiliate/tax-profile') {
    if (method === 'PUT') {
      const b = body as Record<string, unknown>;
      const fields: Record<string, string> = {};
      if (b.taxStatus !== 'kleinunternehmer' && b.taxStatus !== 'regelbesteuert') fields.taxStatus = 'Bitte wähle aus, was auf dich zutrifft.';
      if (!/^\d{5}$/.test(String(b.zip ?? ''))) fields.zip = 'Die Postleitzahl hat 5 Ziffern.';
      if (b.consent !== true) fields.consent = 'Bitte setze den Haken beim Einverständnis.';
      if (Object.keys(fields).length) return json({ code: 'VALIDATION_FAILED', message: 'Bitte prüfe deine Angaben.', fields }, 400);
      const now = new Date().toISOString();
      db.taxProfile = {
        profile: {
          taxStatus: b.taxStatus as 'kleinunternehmer' | 'regelbesteuert', fullName: String(b.fullName), street: String(b.street), zip: String(b.zip),
          city: String(b.city), country: 'DE', taxId: String(b.taxId), entrepreneurConfirmed: true, consentAt: now, consentVersion: '2026-10-16', updatedAt: now,
        },
        complete: true,
      };
    }
    return json(db.taxProfile);
  }
  if (path === '/api/app/v1/affiliate/connect') return json({ url: 'https://connect.stripe.com/setup/e/mock', callbackScheme: 'finestsites' });
  if (path === '/api/app/v1/affiliate/payout') {
    const amount = db.affiliate.earnings.availableCents;
    const min = db.affiliate.payout.minPayoutCents;
    if (amount < min) return json({ status: 'below_minimum', amountCents: amount, minPayoutCents: min, creditNoteNumber: null });
    db.affiliate.earnings.paidCents += amount;
    db.affiliate.earnings.availableCents = 0;
    db.affiliate.history.commissions = db.affiliate.history.commissions.map(h =>
      h.status === 'available' ? { ...h, status: 'paid', paidAt: new Date().toISOString() } : h,
    );
    return json({ status: 'paid', amountCents: amount, minPayoutCents: min, creditNoteNumber: 'GS-2026-00099' });
  }
  if (path === '/api/app/v1/affiliate/credit-notes') return json({ items: db.creditNotes });
  if (path === '/api/app/v1/account/deletion') {
    const total = db.me.features.partnerProgram ? db.affiliate.earnings.availableCents + db.affiliate.earnings.pendingCents : 0;
    if (method === 'POST') {
      if (String(body.password) === 'falsch') return json({ code: 'INVALID_PASSWORD', message: 'Das Passwort stimmt nicht.' }, 400);
      if (total > 0 && !body.balanceChoice) return json({ code: 'BALANCE_CHOICE_REQUIRED', message: '' }, 400);
      const periodEnd = body.timing === 'period_end';
      return json({ status: 'scheduled', mode: periodEnd ? 'period_end' : 'now', scheduledFor: new Date(Date.now() + (periodEnd ? 47 : 14) * 864e5).toISOString(), signedOut: !periodEnd });
    }
    if (method === 'DELETE') return json({ status: 'none', sitesOffline: false, subscriptionContinues: true });
    return json({
      status: 'none', requestedAt: null, scheduledFor: null, mode: null, graceDays: 14, canDelete: true, blockedReason: null,
      periodEnd: { available: true, at: new Date(Date.now() + 47 * 864e5).toISOString() },
      partnerBalance: {
        currency: 'EUR',
        availableCents: db.me.features.partnerProgram ? db.affiliate.earnings.availableCents : 0,
        pendingCents: db.me.features.partnerProgram ? db.affiliate.earnings.pendingCents : 0,
        customerCreditCents: 0,
        totalCents: total,
        hasPayoutAccount: true,
        taxProfileComplete: true,
        choice: null,
        waiverText: waiverText(total),
      },
    });
  }
  if (path === '/api/app/v1/impersonation') {
    if (method === 'POST') {
      if (body.token !== db.impersonation.token) return json({ code: 'NOT_FOUND', message: 'Nicht gefunden.' }, 404);
      db.impersonation.status = body.action === 'approve' ? 'approved' : 'rejected';
      return json({ status: db.impersonation.status });
    }
    const token = u.searchParams.get('token');
    if (token && token !== db.impersonation.token) return json({ request: null });
    const open = ['pending', 'approved', 'active'].includes(db.impersonation.status);
    if (!token && !open) return json({ request: null });
    return json({
      request: { token: db.impersonation.token, status: db.impersonation.status, adminName: '@support', expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() },
    });
  }

  // ── Seiten ──
  if (path === '/api/sites' && method === 'GET') return json(db.sites);
  if (path === '/api/sites' && method === 'POST') {
    const tpl = db.templates.find(t => t.id === body.template_id);
    const id = `s_${Math.random().toString(36).slice(2, 8)}`;
    db.sites.push({
      id, template_id: String(body.template_id), status: 'draft', created_at: new Date().toISOString(),
      published_at: null, updated_at: new Date().toISOString(),
      username: db.me.user.username, custom_domain: null, custom_domain_status: null, unread_submissions: 0,
      has_unpublished_changes: false,
      templates: tpl ? { id: tpl.id, title: tpl.title, domain: tpl.domain, preview_images: tpl.preview_images } : null,
    });
    return json({ id });
  }
  if (seg[0] === 'api' && seg[1] === 'sites' && seg[2]) {
    const site = db.sites.find(s => s.id === seg[2]);
    if (!site) return json({ error: 'Not found' }, 404);
    if (seg.length === 3 && method === 'GET') return json(site);
    if (seg.length === 3 && method === 'DELETE') {
      db.sites = db.sites.filter(s => s.id !== site.id);
      return json({ success: true });
    }
    if (seg[3] === 'publish' && method === 'DELETE') {
      site.status = 'deactivated';
      return json({ success: true });
    }
    if (seg[3] === 'submissions' && seg[4]) {
      const sub = db.submissions.find(s => s.id === seg[4]);
      if (!sub) return json({ error: 'Not found' }, 404);
      if (method === 'DELETE') {
        db.submissions = db.submissions.filter(s => s.id !== sub.id);
        return json({ success: true });
      }
      if (typeof body.read === 'boolean') sub.read_at = body.read ? new Date().toISOString() : null;
      if (typeof body.archived === 'boolean') sub.archived_at = body.archived ? new Date().toISOString() : null;
      return json({ success: true });
    }
  }
  if (path === '/api/templates') return json(db.templates);

  // ── Anfragen ──
  if (path === '/api/submissions') {
    const status = u.searchParams.get('status') ?? 'all';
    const search = (u.searchParams.get('search') ?? '').toLowerCase();
    const siteId = u.searchParams.get('siteId');
    let list = db.submissions.filter(s => (status === 'archived' ? !!s.archived_at : !s.archived_at));
    if (status === 'unread') list = list.filter(s => !s.read_at);
    if (siteId) list = list.filter(s => s.user_site_id === siteId);
    if (search) list = list.filter(s => JSON.stringify(s.data).toLowerCase().includes(search));
    list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return json({ submissions: list, total: list.length });
  }
  if (path === '/api/submissions/unread-count') {
    return json({ count: db.submissions.filter(s => !s.read_at && !s.archived_at).length });
  }

  // ── Support ──
  if (path === '/api/support/conversation' && method === 'GET') return json({ conversations: db.conversations });
  if (path === '/api/support/conversation' && method === 'POST') {
    const id = `c_${Math.random().toString(36).slice(2, 8)}`;
    const msg = {
      id: `m_${Date.now()}`, conversationId: id, senderType: 'user' as const, senderId: 'u_demo',
      content: String(body.content ?? ''), contentType: (body.contentType as 'text' | 'image') ?? 'text',
      mediaUrl: (body.mediaUrl as string) ?? null, createdAt: new Date().toISOString(),
    };
    const conv = { id, subject: null, status: 'open' as const, createdAt: msg.createdAt, unreadByUser: 0, lastMessage: { content: msg.content, contentType: msg.contentType, senderType: 'user' as const } };
    db.conversations.unshift(conv);
    db.messages[id] = [msg];
    return json({ conversation: conv, message: msg });
  }
  if (path === '/api/support/messages' && method === 'GET') {
    const cid = u.searchParams.get('conversationId') ?? '';
    const since = u.searchParams.get('since');
    const list = (db.messages[cid] ?? []).filter(m => !since || m.createdAt > since);
    return json({ messages: list, conversationStatus: db.conversations.find(c => c.id === cid)?.status });
  }
  if (path === '/api/support/messages' && method === 'POST') {
    const cid = String(body.conversationId);
    const msg = {
      id: `m_${Date.now()}`, conversationId: cid, senderType: 'user' as const, senderId: 'u_demo',
      content: String(body.content ?? ''), contentType: (body.contentType as 'text' | 'image') ?? 'text',
      mediaUrl: (body.mediaUrl as string) ?? null, createdAt: new Date().toISOString(),
    };
    (db.messages[cid] ??= []).push(msg);
    const conv = db.conversations.find(c => c.id === cid);
    if (conv) conv.lastMessage = { content: msg.content, contentType: msg.contentType, senderType: 'user' };
    return json({ message: msg });
  }
  if (seg[0] === 'api' && seg[1] === 'support' && seg[2] === 'conversation' && seg[4] === 'read') {
    const conv = db.conversations.find(c => c.id === seg[3]);
    if (conv) conv.unreadByUser = 0;
    return json({ ok: true });
  }
  if (path === '/api/support/upload') return json({ url: 'https://app.finestsites.io/previews/business-seite.jpg' });

  // ── Profil & Ersteinrichtung ──
  if (path === '/api/user/profile' && method === 'PATCH') {
    const b = body as Record<string, string>;
    if ('first_name' in b) db.me.user.firstName = b.first_name;
    if ('last_name' in b) db.me.user.lastName = b.last_name;
    if ('company_name' in b) db.me.user.companyName = b.company_name;
    if ('phone' in b) db.me.user.phone = b.phone;
    if ('team_partner_number' in b) db.me.user.teamPartnerNumber = b.team_partner_number || null;
    if ('email_opt_out' in body) db.me.emailOptOut = body.email_opt_out as never;
    for (const k of ['instagram', 'tiktok', 'facebook', 'linkedin', 'youtube'] as const) {
      if (k in b) db.me.user.socials[k] = b[k] || null;
    }
    return json({ ok: true });
  }
  if (path === '/api/user/profile/avatar') {
    db.me.user.profileImageUrl = 'https://app.finestsites.io/support-avatar.jpg';
    return json({ url: db.me.user.profileImageUrl });
  }
  if (path === '/api/onboarding/set-username') {
    const name = String(body.username ?? '');
    if (name === 'vergeben') return json({ code: 'DUPLICATE' }, 409);
    db.me.user.username = name;
    db.me.user.firstName = String(body.first_name ?? '');
    db.me.user.lastName = String(body.last_name ?? '');
    db.me.onboarding.usernameSet = true;
    db.me.onboarding.complete = db.me.onboarding.consentGiven;
    return json({ ok: true });
  }
  if (path === '/api/auth/consent') {
    db.me.onboarding.consentGiven = true;
    db.me.onboarding.complete = db.me.onboarding.usernameSet;
    return json({ ok: true });
  }
  if (path === '/api/onboarding/set-company') return json({ ok: true });

  return json({ error: `Mock: ${method} ${path} nicht abgebildet` }, 404);
}
