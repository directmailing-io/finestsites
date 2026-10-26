/**
 * Beispieldaten für den Mock-Modus (EXPO_PUBLIC_API_MOCK=1).
 * Erfundene Personen, keine echten Kundendaten. Keine Fremdmarken in Titeln.
 */
import type {
  Affiliate,
  AppNotification,
  ChatConversation,
  ChatMessage,
  ConversationSummary,
  CreditNote,
  ImpersonationStatus,
  Me,
  Message,
  NotificationPreferences,
  Site,
  Submission,
  TaxProfileState,
  Template,
} from '../types';

const PREVIEW = 'https://app.finestsites.io/previews';

const now = Date.now();
const ago = (min: number) => new Date(now - min * 60_000).toISOString();
const days = (d: number) => ago(d * 24 * 60);

export function createMockDb() {
  const me: Me = {
    user: {
      id: 'u_demo',
      email: 'sabine.keller@example.de',
      username: 'sabine-keller',
      firstName: 'Sabine',
      lastName: 'Keller',
      companyName: null,
      teamPartnerNumber: '40237198',
      profileImageUrl: null,
      emailVerified: true,
      isInternal: false,
      phone: '+49 151 23456789',
      socials: { instagram: 'https://instagram.com/sabine.keller', tiktok: null, facebook: null, linkedin: null, youtube: null },
    },
    emailOptOut: ['offers'],
    onboarding: { usernameSet: true, consentGiven: true, complete: true },
    account: { sitesOnline: 2, sitesTotal: 3, paymentIssue: false, planLabel: 'Pro', quota: { used: 2, limit: 3 } },
    features: { partnerProgram: true, visitorChat: true },
  };

  const sites: Site[] = [
    {
      id: 's_business',
      template_id: 't_business',
      status: 'published',
      created_at: days(64),
      published_at: days(60),
      updated_at: days(3),
      username: 'sabine-keller',
      custom_domain: null,
      custom_domain_status: null,
      unread_submissions: 2,
      has_unpublished_changes: false,
      templates: { id: 't_business', title: 'Business-Seite', domain: 'wellpreneur.io', preview_images: [`${PREVIEW}/business-seite.jpg`] },
    },
    {
      id: 's_kur',
      template_id: 't_kur',
      status: 'published',
      created_at: days(31),
      published_at: days(30),
      updated_at: days(1),
      username: 'sabine-keller',
      custom_domain: 'www.sabine-keller.de',
      custom_domain_status: 'active',
      unread_submissions: 0,
      has_unpublished_changes: true,
      templates: { id: 't_kur', title: 'Stoffwechselkur', domain: 'cellrestart.net', preview_images: [`${PREVIEW}/stoffwechselkur.jpg`] },
    },
    {
      id: 's_links',
      template_id: 't_links',
      status: 'draft',
      created_at: days(2),
      published_at: null,
      updated_at: days(2),
      username: 'sabine-keller',
      custom_domain: null,
      custom_domain_status: null,
      unread_submissions: 0,
      has_unpublished_changes: false,
      templates: { id: 't_links', title: 'Link-Seite', domain: 'lnko.me', preview_images: [`${PREVIEW}/lnko-bio.png`] },
    },
  ];

  const templates: Template[] = [
    { id: 't_business', title: 'Business-Seite', description: 'Stell dein Business vor und gewinne neue Teampartner.', domain: 'wellpreneur.io', preview_images: [`${PREVIEW}/business-seite.jpg`], badge: null, is_coming_soon: false },
    { id: 't_kur', title: 'Stoffwechselkur', description: 'Erkläre die Kur Schritt für Schritt, mit Formular für Anfragen.', domain: 'cellrestart.net', preview_images: [`${PREVIEW}/stoffwechselkur.jpg`], badge: null, is_coming_soon: false },
    { id: 't_vital', title: 'Dein Vitalprofil', description: 'Ein kurzer Check für deine Besucher. Die Ergebnisse landen bei dir als Anfrage.', domain: 'vitalprofil.net', preview_images: [`${PREVIEW}/vitalprofil.jpg`], badge: 'brandneu', is_coming_soon: false },
    { id: 't_links', title: 'Link-Seite', description: 'Alle deine Links auf einer Seite, ideal für dein Instagram-Profil.', domain: 'lnko.me', preview_images: [`${PREVIEW}/lnko-bio.png`], badge: null, is_coming_soon: false },
    { id: 't_event', title: 'Event-Seite', description: 'Lade zu deinem nächsten Treffen ein, mit Anmeldung.', domain: 'myevnt.io', preview_images: [`${PREVIEW}/myevnt.png`], badge: null, is_coming_soon: false },
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
    { id: 'n_1', type: 'submission', title: 'Neue Anfrage', message: 'Über deine Webseite ist eine neue Anfrage eingegangen.', data: { url: 'finestsites://submissions/sub_1' }, readAt: null, createdAt: ago(18) },
    { id: 'n_5', type: 'chat_message', title: 'Neue Chat-Nachricht', message: 'Ein Besucher deiner Webseite hat dir geschrieben.', data: { url: 'finestsites://chats/ch_1', type: 'chat_message', conversationId: 'ch_1' }, readAt: null, createdAt: ago(4) },
    { id: 'n_2', type: 'support_reply', title: 'Neue Nachricht vom Support', message: 'Du hast eine neue Antwort im Hilfe-Chat.', data: { url: 'finestsites://support/c_1' }, readAt: null, createdAt: ago(35) },
    { id: 'n_3', type: 'domain_active', title: 'Deine Domain ist verbunden', message: 'www.sabine-keller.de zeigt jetzt auf deine Webseite.', data: { url: 'finestsites://sites/s_kur' }, readAt: days(2), createdAt: days(2) },
    { id: 'n_4', type: 'partner_commission', title: 'Neue Provision', message: 'Eine neue Provision ist eingegangen. Sie ist in 14 Tagen verfügbar.', data: { url: 'finestsites://affiliate' }, readAt: days(5), createdAt: days(5) },
  ];

  // Besucher-Chat: ein ungelesenes Gespräch, eines mit WhatsApp-Nummer, eines archiviert
  const chatConversations: ChatConversation[] = [
    {
      id: 'ch_1', siteId: 's_business', siteTitle: 'Business-Seite', siteHost: 'sabine-keller.wellpreneur.io', startedOnPath: '/',
      visitor: { name: 'Lena Hoffmann', email: 'lena.hoffmann@example.de', phone: null, displayName: 'Lena Hoffmann', initials: 'LH', whatsappUrl: null, online: true, lastSeenAt: ago(0.5) },
      status: 'open', unread: 2,
      lastMessage: { preview: 'Super, dann melde ich mich morgen nochmal. Hast du auch Infos zum Einstieg als Teampartner?', sender: 'visitor', at: ago(4) },
      reportedAt: null, createdAt: ago(32), updatedAt: ago(4),
      resumeCode: '7K4M-2P9X',
    },
    {
      id: 'ch_2', siteId: 's_kur', siteTitle: 'Stoffwechselkur', siteHost: 'www.sabine-keller.de', startedOnPath: '/#ablauf',
      visitor: { name: 'Besucher 4F2A', email: null, phone: '+49 160 5557821', displayName: 'Besucher 4F2A', initials: 'B4', whatsappUrl: 'https://wa.me/491605557821', online: false, lastSeenAt: ago(60 * 20) },
      status: 'open', unread: 0,
      lastMessage: { preview: 'Gern, schreib mir einfach auf WhatsApp, dann schicke ich dir den Ablauf.', sender: 'owner', at: ago(60 * 19) },
      reportedAt: null, createdAt: days(1.1), updatedAt: ago(60 * 19),
      resumeCode: 'Q3WX-8HTB',
    },
    {
      id: 'ch_3', siteId: 's_business', siteTitle: 'Business-Seite', siteHost: 'sabine-keller.wellpreneur.io', startedOnPath: '/#kontakt',
      visitor: { name: 'Tobias Krüger', email: 'tobias.k@example.de', phone: null, displayName: 'Tobias Krüger', initials: 'TK', whatsappUrl: null, online: false, lastSeenAt: days(6) },
      status: 'archived', unread: 0,
      lastMessage: { preview: 'Danke dir, das hat mir sehr geholfen!', sender: 'visitor', at: days(6) },
      reportedAt: null, createdAt: days(7), updatedAt: days(6),
      resumeCode: 'N5RK-2VYD',
    },
  ];

  const chatMessages: Record<string, ChatMessage[]> = {
    ch_1: [
      { id: 'cm_1', conversationId: 'ch_1', sender: 'visitor', body: 'Hallo Sabine! Ich bin über deine Seite gestolpert und finde das Thema spannend.', createdAt: ago(32), readAt: ago(30), clientId: null },
      { id: 'cm_2', conversationId: 'ch_1', sender: 'owner', body: 'Hallo Lena, schön, dass du schreibst! Was interessiert dich am meisten?', createdAt: ago(29), readAt: ago(28), clientId: null },
      { id: 'cm_3', conversationId: 'ch_1', sender: 'visitor', body: 'Vor allem, wie der Alltag damit aussieht. Ich arbeite Vollzeit und habe zwei Kinder.', createdAt: ago(27), readAt: ago(26), clientId: null },
      { id: 'cm_4', conversationId: 'ch_1', sender: 'owner', body: 'Das kenne ich gut. Ich habe auch so angefangen – 30 Minuten am Tag reichen am Anfang völlig. Mehr dazu findest du hier: https://finestsites.io', createdAt: ago(25), readAt: ago(24), clientId: null },
      { id: 'cm_5', conversationId: 'ch_1', sender: 'visitor', body: 'Das klingt machbar.', createdAt: ago(5), readAt: null, clientId: null },
      { id: 'cm_6', conversationId: 'ch_1', sender: 'visitor', body: 'Super, dann melde ich mich morgen nochmal. Hast du auch Infos zum Einstieg als Teampartner?', createdAt: ago(4), readAt: null, clientId: null },
    ],
    ch_2: [
      { id: 'cm_7', conversationId: 'ch_2', sender: 'visitor', body: 'Hi, wie lange dauert die Kur genau?', createdAt: days(1.1), readAt: days(1.05), clientId: null },
      { id: 'cm_8', conversationId: 'ch_2', sender: 'owner', body: 'Hallo! In der Regel 8 Wochen, in drei Phasen. Magst du mir sagen, was dein Ziel ist?', createdAt: days(1.04), readAt: days(1.0), clientId: null },
      { id: 'cm_9', conversationId: 'ch_2', sender: 'visitor', body: 'Mehr Energie, weniger Heißhunger. Kannst du mir den Ablauf schicken? Meine Nummer: +49 160 5557821', createdAt: ago(60 * 21), readAt: ago(60 * 20), clientId: null },
      { id: 'cm_10', conversationId: 'ch_2', sender: 'owner', body: 'Gern, schreib mir einfach auf WhatsApp, dann schicke ich dir den Ablauf.', createdAt: ago(60 * 19), readAt: null, clientId: null },
    ],
    ch_3: [
      { id: 'cm_11', conversationId: 'ch_3', sender: 'visitor', body: 'Hallo, gibt es ein Treffen in Würzburg?', createdAt: days(7), readAt: days(6.9), clientId: null },
      { id: 'cm_12', conversationId: 'ch_3', sender: 'owner', body: 'Ja, jeden ersten Donnerstag im Monat. Ich schicke dir die Einladung per Mail.', createdAt: days(6.5), readAt: days(6.4), clientId: null },
      { id: 'cm_13', conversationId: 'ch_3', sender: 'visitor', body: 'Danke dir, das hat mir sehr geholfen!', createdAt: days(6), readAt: days(5.9), clientId: null },
    ],
  };

  const notificationPrefs: NotificationPreferences = {
    leads: true,
    support: true,
    account: true,
    partner: true,
    chat: true, news: true,
    quietHours: { enabled: true, start: 22, end: 7 },
    timezone: 'Europe/Berlin',
  };

  const affiliate: Affiliate = {
    link: 'https://finestsites.io/?ref=sabine-keller',
    code: 'sabine-keller',
    texts: {
      title: 'Partnerprogramm',
      description: 'Du erhältst eine Provision auf die Zahlungen deiner Empfehlungen, solange sie dabei sind.',
      holdInfo: 'Provisionen sind nach 14 Tagen verfügbar.',
    },
    commissionPercent: 10,
    earnings: { currency: 'EUR', availableCents: 12740, pendingCents: 2970, paidCents: 48600 },
    payout: { mode: 'payout', connectStatus: 'ready', bankLast4: '4821', minPayoutCents: 1000 },
    taxProfileComplete: true,
    history: {
      commissions: [
        { id: 'h_1', amountCents: 2970, status: 'pending', createdAt: days(3), availableAt: new Date(now + 11 * 864e5).toISOString(), paidAt: null },
        { id: 'h_2', amountCents: 2700, status: 'available', createdAt: days(18), availableAt: days(4), paidAt: null },
        { id: 'h_3', amountCents: 10040, status: 'available', createdAt: days(33), availableAt: days(19), paidAt: null },
        { id: 'h_4', amountCents: 16200, status: 'paid', createdAt: days(48), availableAt: days(34), paidAt: days(20) },
        { id: 'h_5', amountCents: 32400, status: 'paid', createdAt: days(79), availableAt: days(65), paidAt: days(51) },
      ],
      payouts: [
        { id: 'cn_2', amountCents: 16200, method: 'transfer', status: 'paid', paidAt: days(20), creditNote: { id: 'cn_2', number: 'GS-2026-00041', ready: true } },
        { id: 'cn_1', amountCents: 32400, method: 'transfer', status: 'paid', paidAt: days(51), creditNote: { id: 'cn_1', number: 'GS-2026-00017', ready: true } },
      ],
    },
    referrals: {
      count: 4,
      active: 3,
      paused: 1,
      items: [
        { displayName: 'Julia B.', joinedAt: days(80), status: 'active' },
        { displayName: 'Markus F.', joinedAt: days(54), status: 'active' },
        { displayName: 'Petra L.', joinedAt: days(20), status: 'active' },
        { displayName: 'Thomas R.', joinedAt: days(120), status: 'paused' },
      ],
    },
  };

  const taxProfile: TaxProfileState = {
    profile: {
      taxStatus: 'kleinunternehmer', fullName: 'Sabine Keller', street: 'Hauptstraße 12', zip: '97437', city: 'Haßfurt',
      country: 'DE', taxId: '123/456/78901', entrepreneurConfirmed: true, consentAt: days(40), consentVersion: '2026-10-16', updatedAt: days(40),
    },
    complete: true,
  };

  const creditNotes: CreditNote[] = [
    { id: 'cn_2', number: 'GS-2026-00041', date: days(20), amountCents: 16200, ready: true, method: 'transfer' },
    { id: 'cn_1', number: 'GS-2026-00017', date: days(51), amountCents: 32400, ready: true, method: 'transfer' },
  ];

  return {
    me,
    sites,
    templates,
    submissions,
    conversations,
    messages,
    chatConversations,
    chatMessages,
    notifications,
    notificationPrefs,
    affiliate,
    taxProfile,
    creditNotes,
    impersonation: { status: 'pending' as ImpersonationStatus, token: 'imp_demo' },
    /** Besucher je Seite (letzte 7 Tage) und Wochenwerte für die Übersicht */
    visitors: { s_business: 148, s_kur: 61, s_links: 0 } as Record<string, number>,
    week: { visitors: 209, visitorsPrev: 174, submissions: 4, submissionsPrev: 2 },
  };
}

export type MockDb = ReturnType<typeof createMockDb>;
