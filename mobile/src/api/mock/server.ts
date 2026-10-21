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

function overview() {
  const online = db.sites.filter(s => s.status === 'published').length;
  const offline = db.sites.filter(s => s.status === 'deactivated').length;
  const unreadSubs = db.submissions.filter(s => !s.read_at && !s.archived_at).length;
  const unreadSupport = db.conversations.reduce((n, c) => n + c.unreadByUser, 0);
  const todos = [] as { id: string; code: string; count?: number; site_id?: string; site_title?: string }[];
  if (db.sites.length === 0) todos.push({ id: 'first', code: 'first_site' });
  if (unreadSubs > 0) todos.push({ id: 'subs', code: 'unread_submissions', count: unreadSubs });
  if (unreadSupport > 0) todos.push({ id: 'support', code: 'support_reply', count: unreadSupport });
  for (const s of db.sites.filter(x => x.has_unpublished_changes)) {
    todos.push({ id: `chg_${s.id}`, code: 'unpublished_changes', site_id: s.id, site_title: s.templates?.title });
  }
  if (!db.me.team_partner_number) todos.push({ id: 'tpn', code: 'team_partner_missing' });
  if (db.me.features.affiliate && !db.affiliate.tax_profile.complete) todos.push({ id: 'tax', code: 'tax_profile_missing' });
  const code = db.sites.length === 0 ? 'no_sites' : offline > 0 ? 'site_offline' : online === 0 ? 'drafts_only' : 'ok';
  return {
    account_status: { code, online_count: online, offline_count: offline },
    todos,
    week: db.week,
    unread: { submissions: unreadSubs, support: unreadSupport, notifications: db.notifications.filter(n => !n.read_at).length },
  };
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
    db.me.email = email || db.me.email;
    if (email.startsWith('neu')) {
      db.me.username = null;
      db.me.first_name = null;
      db.me.last_name = null;
      db.me.team_partner_number = null;
      db.me.plan_label = null;
      db.me.features.affiliate = false;
      db.me.onboarding = { needs_username: true, needs_consent: true, offer_team_partner: true, offer_photo: true };
      db.sites = [];
      db.submissions = [];
      db.conversations = [];
      db.notifications = [];
    }
    if (email.startsWith('ohne-tarif')) {
      db.me.plan_label = null;
      db.me.features.affiliate = false;
      db.sites = db.sites.filter(s => s.status === 'draft');
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
    return json({ min_version: '1.0.0', latest_version: '1.0.0', kill_switches: {}, support_hours: { start: 8, end: 20 } });
  }

  if (!authed) return json({ error: 'Unauthorized' }, 401);

  // ── App v1 ──
  if (path === '/api/app/v1/me') return json(db.me);
  if (path === '/api/app/v1/overview') return json(overview());
  if (path === '/api/app/v1/notifications') return json({ items: db.notifications });
  if (path === '/api/app/v1/notifications/read') {
    const ids = body.ids;
    db.notifications = db.notifications.map(n =>
      ids === 'all' || (Array.isArray(ids) && ids.includes(n.id)) ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n,
    );
    return json({ ok: true });
  }
  if (path === '/api/app/v1/push/devices') return json({ ok: true });
  if (path === '/api/app/v1/notification-preferences') {
    if (method === 'PUT') db.notificationPrefs = body as unknown as MockDb['notificationPrefs'];
    return json(db.notificationPrefs);
  }
  if (path === '/api/app/v1/affiliate') {
    if (!db.me.features.affiliate) return json({ ...db.affiliate, eligible: false });
    return json(db.affiliate);
  }
  if (path === '/api/app/v1/affiliate/payout-mode') {
    db.affiliate.payout_mode = body.mode === 'credit' ? 'credit' : 'payout';
    return json({ ok: true });
  }
  if (path === '/api/app/v1/affiliate/tax-profile') {
    db.affiliate.tax_profile = { complete: true, data: { ...(body as unknown as MockDb['affiliate']['tax_profile']['data'] & object), consent_at: new Date().toISOString() } };
    return json({ complete: true });
  }
  if (path === '/api/app/v1/affiliate/connect') return json({ url: 'https://connect.stripe.com/setup/e/mock' });
  if (path === '/api/app/v1/affiliate/payout') {
    const amount = db.affiliate.earnings.available_cents;
    db.affiliate.earnings.paid_cents += amount;
    db.affiliate.earnings.available_cents = 0;
    db.affiliate.history = db.affiliate.history.map(h => (h.status === 'available' ? { ...h, status: 'paid' } : h));
    return json({ amount_cents: amount });
  }
  if (path === '/api/app/v1/affiliate/credit-notes') return json({ items: db.creditNotes });
  if (path === '/api/app/v1/account/deletion') {
    const total = db.me.features.affiliate ? db.affiliate.earnings.available_cents + db.affiliate.earnings.pending_cents : 0;
    if (method === 'POST') {
      if (String(body.password) === 'falsch') return json({ code: 'INVALID_PASSWORD', message: 'Das Passwort stimmt nicht.' }, 400);
      if (total > 0 && !body.balanceChoice) return json({ code: 'BALANCE_CHOICE_REQUIRED', message: '' }, 400);
      return json({ status: 'scheduled', scheduledFor: new Date(Date.now() + 14 * 864e5).toISOString(), signedOut: true });
    }
    if (method === 'DELETE') return json({ status: 'none', sitesOffline: true });
    return json({
      status: 'none', requestedAt: null, scheduledFor: null, graceDays: 14, canDelete: true, blockedReason: null,
      partnerBalance: {
        currency: 'EUR',
        availableCents: db.me.features.affiliate ? db.affiliate.earnings.available_cents : 0,
        pendingCents: db.me.features.affiliate ? db.affiliate.earnings.pending_cents : 0,
        customerCreditCents: 0,
        totalCents: total,
        hasPayoutAccount: true,
        taxProfileComplete: true,
        choice: null,
        waiverText: 'Ich verzichte auf mein Guthaben aus dem FinestSites-Partnerprogramm, einschließlich noch nicht verfügbarer Provisionen. Mir ist klar, dass dieser Verzicht nach der Löschung meines Kontos nicht rückgängig gemacht werden kann.',
      },
    });
  }
  if (path === '/api/app/v1/impersonation') {
    return json({ state: db.impersonation.state, request: { token: db.impersonation.token } });
  }

  // ── Seiten ──
  if (path === '/api/sites' && method === 'GET') return json(db.sites);
  if (path === '/api/sites' && method === 'POST') {
    const tpl = db.templates.find(t => t.id === body.template_id);
    const id = `s_${Math.random().toString(36).slice(2, 8)}`;
    db.sites.push({
      id, template_id: String(body.template_id), status: 'draft', created_at: new Date().toISOString(),
      username: db.me.username, custom_domain: null, custom_domain_status: null, unread_submissions: 0,
      has_unpublished_changes: false, visitors_7d: 0,
      templates: tpl ? { title: tpl.title, domain: tpl.domain, preview_images: tpl.preview_images } : null,
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
    if (seg[3] === 'domain') {
      return json(site.custom_domain ? { domain: site.custom_domain, status: site.custom_domain_status === 'active' ? 'active' : 'pending' } : { domain: null, status: 'none' });
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
  if (path === '/api/impersonate/approve') {
    db.impersonation.state = 'approved' as never;
    return json({ ok: true });
  }
  if (path === '/api/impersonate/reject') {
    db.impersonation.state = 'rejected' as never;
    return json({ ok: true });
  }

  // ── Profil & Ersteinrichtung ──
  if (path === '/api/user/profile' && method === 'PATCH') {
    const b = body as Record<string, string>;
    if ('first_name' in b) db.me.first_name = b.first_name;
    if ('last_name' in b) db.me.last_name = b.last_name;
    if ('company_name' in b) db.me.company_name = b.company_name;
    if ('phone' in b) db.me.phone = b.phone;
    if ('team_partner_number' in b) db.me.team_partner_number = b.team_partner_number || null;
    if ('email_opt_out' in body) db.me.email_opt_out = body.email_opt_out as never;
    for (const k of ['instagram', 'tiktok', 'facebook', 'linkedin', 'youtube'] as const) {
      if (k in b) db.me.socials[k] = b[k] || null;
    }
    return json({ ok: true });
  }
  if (path === '/api/user/profile/avatar') {
    db.me.profile_image_url = 'https://app.finestsites.io/support-avatar.jpg';
    return json({ url: db.me.profile_image_url });
  }
  if (path === '/api/onboarding/set-username') {
    const name = String(body.username ?? '');
    if (name === 'vergeben') return json({ code: 'DUPLICATE' }, 409);
    db.me.username = name;
    db.me.first_name = String(body.first_name ?? '');
    db.me.last_name = String(body.last_name ?? '');
    db.me.onboarding.needs_username = false;
    return json({ ok: true });
  }
  if (path === '/api/auth/consent') {
    db.me.onboarding.needs_consent = false;
    return json({ ok: true });
  }
  if (path === '/api/onboarding/set-company') return json({ ok: true });

  return json({ error: `Mock: ${method} ${path} nicht abgebildet` }, 404);
}
