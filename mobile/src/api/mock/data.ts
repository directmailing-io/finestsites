/**
 * Beispieldaten für den Mock-Modus (EXPO_PUBLIC_API_MOCK=1).
 * Erfundene Personen, keine echten Kundendaten. Keine Fremdmarken in Titeln.
 */
import type {
  Affiliate,
  AppNotification,
  ConversationSummary,
  CreditNote,
  Me,
  Message,
  NotificationPreferences,
  Site,
  Submission,
  Template,
} from '../types';

const PREVIEW = 'https://app.finestsites.io/previews';

const now = Date.now();
const ago = (min: number) => new Date(now - min * 60_000).toISOString();
const days = (d: number) => ago(d * 24 * 60);

export function createMockDb() {
  const me: Me = {
    id: 'u_demo',
    email: 'sabine.keller@example.de',
    email_verified: true,
    username: 'sabine-keller',
    first_name: 'Sabine',
    last_name: 'Keller',
    company_name: null,
    phone: '+49 151 23456789',
    profile_image_url: null,
    team_partner_number: '40237198',
    socials: { instagram: 'https://instagram.com/sabine.keller', tiktok: null, facebook: null, linkedin: null, youtube: null },
    plan_label: { name: 'Pro', sites_used: 2, sites_limit: 3 },
    onboarding: { needs_username: false, needs_consent: false, offer_team_partner: false, offer_photo: false },
    features: { affiliate: true },
    email_opt_out: ['offers'],
  };

  const sites: Site[] = [
    {
      id: 's_business',
      template_id: 't_business',
      status: 'published',
      created_at: days(64),
      username: 'sabine-keller',
      custom_domain: null,
      custom_domain_status: null,
      unread_submissions: 2,
      has_unpublished_changes: false,
      visitors_7d: 148,
      templates: { title: 'Business-Seite', domain: 'wellpreneur.io', preview_images: [`${PREVIEW}/business-seite.jpg`] },
    },
    {
      id: 's_kur',
      template_id: 't_kur',
      status: 'published',
      created_at: days(31),
      username: 'sabine-keller',
      custom_domain: 'www.sabine-keller.de',
      custom_domain_status: 'active',
      unread_submissions: 0,
      has_unpublished_changes: true,
      visitors_7d: 61,
      templates: { title: 'Stoffwechselkur', domain: 'cellrestart.net', preview_images: [`${PREVIEW}/stoffwechselkur.jpg`] },
    },
    {
      id: 's_links',
      template_id: 't_links',
      status: 'draft',
      created_at: days(2),
      username: 'sabine-keller',
      custom_domain: null,
      custom_domain_status: null,
      unread_submissions: 0,
      has_unpublished_changes: false,
      visitors_7d: 0,
      templates: { title: 'Link-Seite', domain: 'lnko.me', preview_images: [`${PREVIEW}/lnko-bio.png`] },
    },
  ];

  const templates: Template[] = [
    { id: 't_business', title: 'Business-Seite', description: 'Stell dein Business vor und gewinne neue Teampartner.', domain: 'wellpreneur.io', preview_images: [`${PREVIEW}/business-seite.jpg`], is_free: false, badge: null, is_coming_soon: false },
    { id: 't_kur', title: 'Stoffwechselkur', description: 'Erkläre die Kur Schritt für Schritt, mit Formular für Anfragen.', domain: 'cellrestart.net', preview_images: [`${PREVIEW}/stoffwechselkur.jpg`], is_free: false, badge: null, is_coming_soon: false },
    { id: 't_vital', title: 'Dein Vitalprofil', description: 'Ein kurzer Check für deine Besucher. Die Ergebnisse landen bei dir als Anfrage.', domain: 'vitalprofil.net', preview_images: [`${PREVIEW}/vitalprofil.jpg`], is_free: false, badge: 'brandneu', is_coming_soon: false },
    { id: 't_links', title: 'Link-Seite', description: 'Alle deine Links auf einer Seite, ideal für dein Instagram-Profil.', domain: 'lnko.me', preview_images: [`${PREVIEW}/lnko-bio.png`], is_free: true, badge: null, is_coming_soon: false },
    { id: 't_event', title: 'Event-Seite', description: 'Lade zu deinem nächsten Treffen ein, mit Anmeldung.', domain: 'myevnt.io', preview_images: [`${PREVIEW}/myevnt.png`], is_free: false, badge: null, is_coming_soon: false },
  ];

  const submissions: Submission[] = [
    {
      id: 'sub_1', user_site_id: 's_business', form_name: 'kontakt', read_at: null, archived_at: null, created_at: ago(18),
      site: { title: 'Business-Seite', domain: 'wellpreneur.io' },
      data: { name: 'Julia Brandt', email: 'julia.brandt@example.de', laendervorwahl: '+49', telefon: '0171 5550123', kontaktweg: 'WhatsApp', nachricht: 'Hallo Sabine, ich würde gern mehr über die Zusammenarbeit erfahren. Wann passt dir ein kurzes Telefonat?' },
    },
    {
      id: 'sub_2', user_site_id: 's_business', form_name: 'rueckruf', read_at: null, archived_at: null, created_at: ago(190),
      site: { title: 'Business-Seite', domain: 'wellpreneur.io' },
      data: { name: 'Markus Feld', laendervorwahl: '+43', telefon: '664 1234567', nachricht: 'Bitte ruf mich nach 17 Uhr an.' },
    },
    {
      id: 'sub_3', user_site_id: 's_kur', form_name: 'kur-anfrage', read_at: ago(60 * 26), archived_at: null, created_at: days(1.2),
      site: { title: 'Stoffwechselkur', domain: 'cellrestart.net' },
      data: { name: 'Petra Lang', email: 'petra.lang@example.de', ziele: 'Mehr Energie im Alltag', alter: '52', nachricht: 'Ich interessiere mich für die Kur im Januar.' },
    },
    {
      id: 'sub_4', user_site_id: 's_kur', form_name: 'kontakt', read_at: days(3), archived_at: null, created_at: days(4),
      site: { title: 'Stoffwechselkur', domain: 'cellrestart.net' },
      data: { vorname: 'Thomas', email: 'thomas.r@example.de', nachricht: 'Gibt es die Kur auch für Paare?' },
    },
    {
      id: 'sub_5', user_site_id: 's_business', form_name: 'kontakt', read_at: days(20), archived_at: days(19), created_at: days(21),
      site: { title: 'Business-Seite', domain: 'wellpreneur.io' },
      data: { name: 'Anna Weber', email: 'anna.weber@example.de', nachricht: 'Danke für das nette Gespräch!' },
    },
  ];

  const conversations: ConversationSummary[] = [
    {
      id: 'c_1', subject: null, status: 'open', createdAt: days(1), updatedAt: ago(35), unreadByUser: 1,
      lastMessage: { content: 'Schau mal unter „Seiten“, dort findest du deine Seite jederzeit wieder.', contentType: 'text', senderType: 'admin' },
    },
    {
      id: 'c_2', subject: 'Eigene Domain verbinden', status: 'closed', createdAt: days(12), updatedAt: days(11), unreadByUser: 0,
      lastMessage: { content: 'Super, danke dir!', contentType: 'text', senderType: 'user' },
    },
  ];

  const messages: Record<string, Message[]> = {
    c_1: [
      { id: 'm_1', conversationId: 'c_1', senderType: 'user', senderId: 'u_demo', content: 'Hallo, ich habe meine Seite veröffentlicht, finde sie aber nicht mehr.', contentType: 'text', mediaUrl: null, createdAt: ago(60 * 22) },
      { id: 'm_2', conversationId: 'c_1', senderType: 'admin', senderId: 'a_1', content: 'Hallo Sabine, kein Problem! Darf ich kurz in dein Konto schauen?', contentType: 'text', mediaUrl: null, createdAt: ago(60 * 21) },
      { id: 'm_3', conversationId: 'c_1', senderType: 'system', senderId: null, content: JSON.stringify({ type: 'impersonation_request', token: 'imp_demo' }), contentType: 'system', mediaUrl: null, createdAt: ago(60 * 21 - 1) },
      { id: 'm_4', conversationId: 'c_1', senderType: 'admin', senderId: 'a_1', content: 'Schau mal unter **„Seiten“**, dort findest du deine Seite jederzeit wieder.', contentType: 'text', mediaUrl: null, createdAt: ago(35) },
    ],
    c_2: [
      { id: 'm_5', conversationId: 'c_2', senderType: 'user', senderId: 'u_demo', content: 'Wie verbinde ich meine eigene Domain?', contentType: 'text', mediaUrl: null, createdAt: days(12) },
      { id: 'm_6', conversationId: 'c_2', senderType: 'admin', senderId: 'a_1', content: 'Im Editor unter „Eigene Domain“ steht eine Anleitung. Trag dort einfach deine Domain ein.', contentType: 'text', mediaUrl: null, createdAt: days(11.9) },
      { id: 'm_7', conversationId: 'c_2', senderType: 'user', senderId: 'u_demo', content: 'Super, danke dir!', contentType: 'text', mediaUrl: null, createdAt: days(11) },
    ],
  };

  const notifications: AppNotification[] = [
    { id: 'n_1', kind: 'submission', title: 'Neue Anfrage', body: 'Über deine Business-Seite ist eine neue Anfrage eingegangen.', href: '/inbox/sub_1', read_at: null, created_at: ago(18) },
    { id: 'n_2', kind: 'support', title: 'Antwort vom Support', body: 'Du hast eine neue Nachricht im Hilfe-Chat.', href: '/help/c_1', read_at: null, created_at: ago(35) },
    { id: 'n_3', kind: 'site', title: 'Deine Seite ist online', body: 'Stoffwechselkur ist jetzt unter www.sabine-keller.de erreichbar.', href: '/sites/s_kur', read_at: days(2), created_at: days(2) },
    { id: 'n_4', kind: 'partner', title: 'Neue Provision', body: 'Eine neue Provision ist eingegangen. Sie ist in 14 Tagen verfügbar.', href: '/account/partner', read_at: days(5), created_at: days(5) },
  ];

  const notificationPrefs: NotificationPreferences = {
    push: { submissions: true, support: true, sites: true, partner: true },
    quiet_hours: { enabled: true, start: '22:00', end: '07:00' },
  };

  const affiliate: Affiliate = {
    eligible: true,
    link: 'https://finestsites.io/?ref=sabine-keller',
    code: 'sabine-keller',
    pitch: 'Teile deinen Link mit Menschen, die eine eigene Webseite brauchen.',
    commission_percent: 10,
    earnings: { available_cents: 12740, pending_cents: 2970, paid_cents: 48600 },
    payout_mode: 'payout',
    min_payout_cents: 1000,
    payout_account: { status: 'active', bank_name: 'Sparkasse', bank_last4: '4821' },
    tax_profile: {
      complete: true,
      data: {
        tax_status: 'kleinunternehmer', full_name: 'Sabine Keller', street: 'Hauptstraße 12', zip: '97437', city: 'Haßfurt',
        country: 'DE', tax_id: '123/456/78901', entrepreneur_confirmed: true, consent_at: days(40),
      },
    },
    referrals: {
      active: 3,
      paused: 1,
      items: [
        { id: 'r_1', name: 'Julia B.', since: days(80), status: 'active' },
        { id: 'r_2', name: 'Markus F.', since: days(54), status: 'active' },
        { id: 'r_3', name: 'Petra L.', since: days(20), status: 'active' },
        { id: 'r_4', name: 'Thomas R.', since: days(120), status: 'paused' },
      ],
    },
    history: [
      { id: 'h_1', date: days(3), amount_cents: 2970, status: 'pending', available_at: new Date(now + 11 * 864e5).toISOString() },
      { id: 'h_2', date: days(18), amount_cents: 2700, status: 'available', available_at: days(4) },
      { id: 'h_3', date: days(33), amount_cents: 10040, status: 'available', available_at: days(19) },
      { id: 'h_4', date: days(48), amount_cents: 16200, status: 'paid', available_at: days(34) },
      { id: 'h_5', date: days(79), amount_cents: 32400, status: 'paid', available_at: days(65) },
    ],
  };

  const creditNotes: CreditNote[] = [
    { id: 'cn_2', number: 'GS-2026-00041', date: days(20), amount_cents: 16200, ready: true, method: 'transfer' },
    { id: 'cn_1', number: 'GS-2026-00017', date: days(51), amount_cents: 32400, ready: true, method: 'transfer' },
  ];

  return {
    me,
    sites,
    templates,
    submissions,
    conversations,
    messages,
    notifications,
    notificationPrefs,
    affiliate,
    creditNotes,
    impersonation: { state: 'pending' as const, token: 'imp_demo' },
    week: { visitors: 209, visitors_prev: 174, submissions: 4, submissions_prev: 2 },
  };
}

export type MockDb = ReturnType<typeof createMockDb>;
