import { pgTable, pgEnum, uuid, text, varchar, boolean, timestamp, jsonb, integer, smallint, bigint, numeric, date, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const planEnum = pgEnum('plan', ['starter', 'pro', 'unlimited', 'secret'])
export const billingIntervalEnum = pgEnum('billing_interval', ['monthly', 'yearly'])
export const siteStatusEnum = pgEnum('site_status', ['draft', 'published', 'deactivated', 'deleted'])
export const templateStatusEnum = pgEnum('template_status', ['draft', 'published'])

// ─── BetterAuth Tables ────────────────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_sessions_user_id').on(t.userId),
  index('idx_sessions_expires').on(t.expiresAt),
])

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_accounts_user_id').on(t.userId),
  index('idx_accounts_provider').on(t.providerId, t.accountId),
])

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_verifications_identifier').on(t.identifier),
  index('idx_verifications_expires').on(t.expiresAt),
])

// ─── Core Tables ──────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  username: text('username').unique(),
  usernameSetAt: timestamp('username_set_at', { withTimezone: true }),
  plan: text('plan').notNull().default('starter'),
  billingInterval: text('billing_interval').notNull().default('monthly'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  subscriptionStatus: text('subscription_status'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  paymentFailedAt: timestamp('payment_failed_at', { withTimezone: true }),
  // Payment recovery (see src/lib/billing/payment-recovery.ts):
  // the open invoice behind paymentFailedAt, how long the sites stay online
  // despite the arrears, whether a new attempt is still being processed (SEPA),
  // and which reminder mails already went out for this episode.
  paymentFailedInvoiceId: text('payment_failed_invoice_id'),
  paymentGraceUntil: timestamp('payment_grace_until', { withTimezone: true }),
  paymentRetryProcessingAt: timestamp('payment_retry_processing_at', { withTimezone: true }),
  paymentNoticeSentAt: timestamp('payment_notice_sent_at', { withTimezone: true }),
  paymentReminderSentAt: timestamp('payment_reminder_sent_at', { withTimezone: true }),
  paymentOfflineNotifiedAt: timestamp('payment_offline_notified_at', { withTimezone: true }),
  // Opt-in: when the card fails, retry with the stored SEPA mandate (slow, may cost a fee)
  paymentFallbackSepa: boolean('payment_fallback_sepa').notNull().default(false),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  isAdmin: boolean('is_admin').notNull().default(false),
  // Internes Konto (z. B. Apple-Demo-Konto der App), Migration 20261021120000
  isInternal: boolean('is_internal').notNull().default(false),
  // Markenfarbe (#RRGGBB) für alle Seiten des Nutzers mit farbthema=eigene; Phase A nur Admin (14.10.2026)
  brandColor: varchar('brand_color', { length: 7 }),
  // Abbestellte Mail-Kategorien (src/lib/email/categories.ts); leer = alles erlaubt, "system" nie abwählbar
  emailOptOut: text('email_opt_out').array().notNull().default([]),
  emailOptOutUpdatedAt: timestamp('email_opt_out_updated_at', { withTimezone: true }),
  // Profile fields
  firstName: text('first_name'),
  lastName: text('last_name'),
  companyName: text('company_name'), // freiwillig; erscheint in Impressum/Datenschutz aller Seiten des Nutzers
  phone: text('phone'),
  websiteUrl: text('website_url'),
  instagram: text('instagram'),
  facebook: text('facebook'),
  linkedin: text('linkedin'),
  tiktok: text('tiktok'),
  youtube: text('youtube'),
  profileImageUrl: text('profile_image_url'),
  // BetterAuth required fields
  name: text('name').notNull().default(''),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  // Unternehmen: seit 15.10.2026 immer PM-International (keine Auswahl mehr, Vorlagen gibt es nur dafür)
  nmCompanies: text('nm_companies').array().default(['PM-International']),
  // PM-International / FitLine
  teamPartnerNumber: text('team_partner_number'),
  // Affiliate
  referredByUsername: text('referred_by_username'),
  // Empfehlungsrabatt als Kunde (src/lib/affiliate/referral-model.ts): 'legacy10' (10 % dauerhaft, Bestandsschutz) | 'c2026' (Modell C) | null
  referralTerms: text('referral_terms'),
  // Hinweis für den Admin, z. B. 'fingerprint_match:<username>' (Zahlungsmittel eines früheren Kunden); kein automatischer Entzug
  referralDiscountFlag: text('referral_discount_flag'),
  // Fingerprints der Zahlungsmittel (card/sepa_debit) für die Neukunden-Prüfung
  paymentFingerprints: text('payment_fingerprints').array().notNull().default([]),
  stripeConnectId: text('stripe_connect_id').unique(),
  affiliateOnboarded: boolean('affiliate_onboarded').default(false),
  affiliatePayoutEmail: text('affiliate_payout_email'),
  // Wie der Partner seine Provision bekommt: 'credit' = Verrechnung mit dem eigenen Abo (Kundenguthaben), 'payout' = Überweisung (Stripe Connect)
  affiliatePayoutMode: text('affiliate_payout_mode').notNull().default('credit'),
  // Global content consent (legal proof — stored once at onboarding)
  contentConsentAt: timestamp('content_consent_at', { withTimezone: true }),
  contentConsentIp: varchar('content_consent_ip', { length: 64 }),
  contentConsentUa: text('content_consent_ua'),
  contentConsentVersion: varchar('content_consent_version', { length: 20 }),
  contentConsentTextHash: varchar('content_consent_text_hash', { length: 64 }),
  // Konto löschen (Migration 20261022100000, src/lib/account-deletion): angefragt → nach 14 Tagen
  // ausgeführt. Nach der Löschung bleibt die Zeile als Grabstein (id + Benutzername reserviert).
  deletionRequestedAt: timestamp('deletion_requested_at', { withTimezone: true }),
  deletionScheduledFor: timestamp('deletion_scheduled_for', { withTimezone: true }),
  // now = Seiten sofort offline, Abo sofort beendet; period_end = Abo zum Laufzeitende gekündigt, Seiten bis dahin
  // online, Löschung zum Laufzeitende (Migration 20261026060000). NULL = keine Anfrage.
  deletionMode: text('deletion_mode'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_users_username').on(t.username),
  index('idx_users_stripe_customer').on(t.stripeCustomerId),
  index('idx_users_referred_by').on(t.referredByUsername),
])

export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  previewImages: jsonb('preview_images').default([]),
  domain: text('domain').notNull(),
  r2BundlePath: text('r2_bundle_path'),
  status: text('status').notNull().default('draft'),
  placeholderSchema: jsonb('placeholder_schema').notNull().default({ version: 1, fields: [] }),
  schemaVersion: integer('schema_version').notNull().default(1),
  isTest: boolean('is_test').notNull().default(false),
  isFree: boolean('is_free').notNull().default(false),
  // Marketing fields
  tags: text('tags').array().default([]),
  badge: text('badge'),        // 'brandneu' | 'beliebt' | null
  slug: text('slug').unique(),
  detailColor: text('detail_color'), // hex accent color for detail page
  detailContent: jsonb('detail_content').default([]), // array of {heading, text, imageUrl, imagePosition}
  // NM company targeting
  nmCompanies: text('nm_companies').array().default([]),
  isAllrounder: boolean('is_allrounder').default(false),
  // Interactive preview editor config (for /vorlagen/[id] marketing page)
  previewConfig: jsonb('preview_config'), // { editable_themes, editable_sections, editable_header_images }
  // Cloudflare Worker Route setup (for template domain routing)
  cfHostnameId: text('cf_hostname_id'),
  cfHostnameStatus: text('cf_hostname_status'),
  cfHostnameData: jsonb('cf_hostname_data'),
  sortOrder: integer('sort_order').default(100),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userSites = pgTable('user_sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'restrict' }),
  status: text('status').notNull().default('draft'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  scheduledDeletionAt: timestamp('scheduled_deletion_at', { withTimezone: true }),
  r2PublishedPath: text('r2_published_path'),
  // Custom domain
  customDomain: text('custom_domain').unique(),
  customDomainStatus: text('custom_domain_status'),
  cfCustomHostnameId: text('cf_custom_hostname_id'),
  customDomainVerifiedAt: timestamp('custom_domain_verified_at', { withTimezone: true }),
  // Veröffentlichter Stand (Schnappschuss von site_data beim Veröffentlichen). Der Worker
  // liefert nur diesen aus; der Editor arbeitet am Entwurf in site_data. Siehe src/lib/sites/published-data.ts
  publishedData: jsonb('published_data').$type<Record<string, string> | null>(),
  publishedDataAt: timestamp('published_data_at', { withTimezone: true }),
  /** Besucher-Chat auf dieser Seite (Editor-Schalter); wirkt nur, wenn das Konto freigeschaltet ist */
  visitorChatEnabled: boolean('visitor_chat_enabled').notNull().default(true),
  // @deprecated — per-site consent fields (replaced by users.content_consent_at onboarding step)
  // Kept for historical data; no longer written by the publish flow. Admin panel still reads them.
  contentConsentGivenAt: timestamp('content_consent_given_at', { withTimezone: true }),
  contentConsentIp: varchar('content_consent_ip', { length: 64 }),
  contentConsentUa: text('content_consent_ua'),
  contentConsentVersion: varchar('content_consent_version', { length: 20 }).default('v1'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_user_sites_user_id').on(t.userId),
  index('idx_user_sites_template_id').on(t.templateId),
  index('idx_user_sites_status').on(t.status),
  uniqueIndex('user_sites_user_template_unique').on(t.userId, t.templateId),
])

export const siteData = pgTable('site_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  userSiteId: uuid('user_site_id').notNull().references(() => userSites.id, { onDelete: 'cascade' }),
  fieldKey: text('field_key').notNull(),
  fieldValue: text('field_value'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_site_data_user_site_id').on(t.userSiteId),
  uniqueIndex('site_data_user_site_field_unique').on(t.userSiteId, t.fieldKey),
])

export const siteImages = pgTable('site_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  userSiteId: uuid('user_site_id').notNull().references(() => userSites.id, { onDelete: 'cascade' }),
  fieldKey: text('field_key').notNull(),
  r2Path: text('r2_path').notNull(),
  publicUrl: text('public_url').notNull(),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('site_images_user_site_field_unique').on(t.userSiteId, t.fieldKey),
])

export const templateUpdates = pgTable('template_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  updateType: text('update_type').notNull(),
  description: text('description'),
  schemaVersionBefore: integer('schema_version_before'),
  schemaVersionAfter: integer('schema_version_after'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userNotifications = pgTable('user_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: jsonb('data').default({}),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_notifications_user_id').on(t.userId),
])

export const formSchemas = pgTable('form_schemas', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  formName: text('form_name').notNull(),
  title: text('title').notNull(),
  fields: jsonb('fields').notNull().default([]),
  emailNotificationEnabled: boolean('email_notification_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_form_schemas_template').on(t.templateId),
  uniqueIndex('form_schemas_template_name_unique').on(t.templateId, t.formName),
])

export const formSubmissions = pgTable('form_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userSiteId: uuid('user_site_id').notNull().references(() => userSites.id, { onDelete: 'cascade' }),
  formName: text('form_name').notNull(),
  data: jsonb('data').notNull().default({}),
  submitterIpHash: text('submitter_ip_hash'),
  isSpam: boolean('is_spam').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_form_submissions_site').on(t.userSiteId),
  index('idx_form_submissions_created').on(t.createdAt),
])

export const templateAccess = pgTable('template_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => [
  index('idx_template_access_template').on(t.templateId),
  index('idx_template_access_user').on(t.userId),
  uniqueIndex('template_access_unique').on(t.templateId, t.userId),
])

export const subscriptionEvents = pgTable('subscription_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  plan: text('plan'),
  billingInterval: text('billing_interval'),
  amountCents: integer('amount_cents'),
  stripeEventId: text('stripe_event_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeInvoiceId: text('stripe_invoice_id'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_subscription_events_user_id').on(t.userId),
  index('idx_subscription_events_created_at').on(t.createdAt),
  index('idx_subscription_events_type').on(t.eventType),
])

export const affiliateCommissions = pgTable('affiliate_commissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  // SET NULL statt CASCADE: Provisionen sind Buchungsbelege (§ 147 AO, 10 Jahre) und bleiben
  // erhalten, wenn ein Konto gelöscht wird. Gutschriften tragen eigene Snapshots.
  referrerId: uuid('referrer_id').references(() => users.id, { onDelete: 'set null' }),
  refereeId: uuid('referee_id').references(() => users.id, { onDelete: 'set null' }),
  stripeInvoiceId: text('stripe_invoice_id').notNull().unique(),
  stripeCustomerId: text('stripe_customer_id'),
  grossAmount: integer('gross_amount').notNull(),
  // Tax-free net amount from the Stripe invoice (commission base). Nullable for legacy rows.
  netAmount: integer('net_amount'),
  commissionRate: numeric('commission_rate', { precision: 5, scale: 4 }).notNull().default('0.10'),
  commissionAmount: integer('commission_amount').notNull(),
  status: text('status').notNull().default('pending'),
  availableAt: timestamp('available_at', { withTimezone: true }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  payoutId: uuid('payout_id'),
  reversalReason: text('reversal_reason'),
  // Aufbewahrung bis (10 Jahre ab Jahresende, § 147 Abs. 1 Nr. 1 AO); gesetzt beim Löschen eines beteiligten Kontos
  retentionUntil: date('retention_until'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_commissions_referrer').on(t.referrerId, t.status),
  index('idx_commissions_referee').on(t.refereeId),
])

export const affiliatePayouts = pgTable('affiliate_payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  referrerId: uuid('referrer_id').references(() => users.id, { onDelete: 'set null' }),
  commissionIds: uuid('commission_ids').array().notNull(),
  totalAmount: integer('total_amount').notNull(),
  commissionCount: integer('commission_count').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  stripeTransferId: text('stripe_transfer_id'),
  payoutMethod: text('payout_method').default('stripe_connect'), // stripe_connect | credit
  // Verrechnung (payout_method = 'credit'): Stripe customer balance transaction + Kunde, dem sie gutgeschrieben wurde
  stripeBalanceTxnId: text('stripe_balance_txn_id'),
  stripeCustomerId: text('stripe_customer_id'),
  status: text('status').notNull().default('pending'),
  pdfUrl: text('pdf_url'),
  notes: text('notes'),
  // ── Gutschrift / Provisionsabrechnung (unveränderlicher Beleg, seit 16.10.2026) ──
  // totalAmount = überwiesener Betrag (= grossAmount). Netto = Summe der Provisionszeilen.
  netAmount: integer('net_amount'),
  vatAmount: integer('vat_amount'),
  grossAmount: integer('gross_amount'),
  vatRate: numeric('vat_rate', { precision: 5, scale: 4 }),
  taxStatus: text('tax_status'), // kleinunternehmer | regelbesteuert
  taxProfileSnapshot: jsonb('tax_profile_snapshot'), // Angaben des Partners zum Zeitpunkt der Auszahlung
  lineItems: jsonb('line_items'), // CreditNoteLine[] (ohne Kundennamen/E-Mails)
  creditNoteNumber: text('credit_note_number').unique(), // GS-YYYY-NNNNN, lückenlos
  creditNoteDate: date('credit_note_date'),
  creditNoteKey: text('credit_note_key'), // privater R2-Schlüssel des PDFs
  creditNoteStatus: text('credit_note_status'), // pending | created
  creditNoteError: text('credit_note_error'),
  failureReason: text('failure_reason'),
  // Aufbewahrung bis (Gutschrift 8 J., Auszahlungsbuchung 10 J., jeweils ab Jahresende – der längere Wert)
  retentionUntil: date('retention_until'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
}, (t) => [
  index('idx_payouts_referrer').on(t.referrerId),
])

/** Steuerliche Angaben des Partners für die Abrechnung (eine Zeile je Nutzer). */
export const affiliateTaxProfiles = pgTable('affiliate_tax_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  taxStatus: text('tax_status').notNull(), // kleinunternehmer | regelbesteuert (nur Unternehmer)
  fullName: text('full_name').notNull(),
  street: text('street').notNull(),
  zip: text('zip').notNull(),
  city: text('city').notNull(),
  country: text('country').notNull().default('DE'),
  taxNumber: text('tax_number'),
  vatId: text('vat_id'),
  // Bestätigung „Ich handle als Unternehmer (§ 14 BGB) …“ – gehört zum Einverständnis
  entrepreneurConfirmed: boolean('entrepreneur_confirmed').notNull().default(false),
  consentAt: timestamp('consent_at', { withTimezone: true }),
  consentVersion: text('consent_version'),
  consentText: text('consent_text'),
  consentIp: varchar('consent_ip', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Lückenloser Gutschrift-Nummernkreis je Jahr (wird in derselben Transaktion hochgezählt). */
export const affiliateCreditNoteCounters = pgTable('affiliate_credit_note_counters', {
  year: integer('year').primaryKey(),
  lastNumber: integer('last_number').notNull().default(0),
})

export const affiliateClicks = pgTable('affiliate_clicks', {
  id: uuid('id').primaryKey().defaultRandom(),
  referrerUsername: text('referrer_username').notNull(),
  ipHash: text('ip_hash'),
  userAgentShort: text('user_agent_short'),
  converted: boolean('converted').default(false),
  convertedUserId: uuid('converted_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_clicks_referrer').on(t.referrerUsername),
])

/**
 * Protokoll der Kontolöschungen (Migration 20261022100000). Eine offene Anfrage je Nutzer
 * (status 'scheduled'); abgebrochene und ausgeführte bleiben als Nachweis stehen.
 */
export const accountDeletionRequests = pgTable('account_deletion_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  status: text('status').notNull().default('scheduled'), // scheduled | cancelled | completed
  source: text('source').notNull().default('web'), // web | app | admin
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  balanceAvailableCents: integer('balance_available_cents').notNull().default(0),
  balancePendingCents: integer('balance_pending_cents').notNull().default(0),
  // Stripe-Kundenguthaben (Verrechnungsmodus, noch nicht verbraucht) – AGB § 16 Abs. 3: auf Anfrage auszahlbar
  balanceCustomerCreditCents: integer('balance_customer_credit_cents').notNull().default(0),
  balanceChoice: text('balance_choice').notNull().default('none'), // none | payout | waive
  mode: text('mode').notNull().default('now'), // now | period_end
  waiverText: text('waiver_text'),
  waiverAcceptedAt: timestamp('waiver_accepted_at', { withTimezone: true }),
  // not_needed | pending | settled | payable_on_request | waived | time_barred
  settlementStatus: text('settlement_status').notNull().default('not_needed'),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  contactEmail: text('contact_email'),
  limitationUntil: date('limitation_until'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_account_deletion_requests_user').on(t.userId),
])

export type AccountDeletionRequest = typeof accountDeletionRequests.$inferSelect

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  userSites: many(userSites),
  userNotifications: many(userNotifications),
  subscriptionEvents: many(subscriptionEvents),
  templateAccess: many(templateAccess),
  commissions: many(affiliateCommissions, { relationName: 'referrer' }),
  payouts: many(affiliatePayouts),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const templatesRelations = relations(templates, ({ many }) => ({
  userSites: many(userSites),
  templateAccess: many(templateAccess),
  formSchemas: many(formSchemas),
  templateUpdates: many(templateUpdates),
}))

export const userSitesRelations = relations(userSites, ({ one, many }) => ({
  user: one(users, { fields: [userSites.userId], references: [users.id] }),
  template: one(templates, { fields: [userSites.templateId], references: [templates.id] }),
  siteData: many(siteData),
  siteImages: many(siteImages),
  formSubmissions: many(formSubmissions),
}))

export const siteDataRelations = relations(siteData, ({ one }) => ({
  userSite: one(userSites, { fields: [siteData.userSiteId], references: [userSites.id] }),
}))

export const siteImagesRelations = relations(siteImages, ({ one }) => ({
  userSite: one(userSites, { fields: [siteImages.userSiteId], references: [userSites.id] }),
}))

export const formSchemasRelations = relations(formSchemas, ({ one }) => ({
  template: one(templates, { fields: [formSchemas.templateId], references: [templates.id] }),
}))

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  userSite: one(userSites, { fields: [formSubmissions.userSiteId], references: [userSites.id] }),
}))

export const templateAccessRelations = relations(templateAccess, ({ one }) => ({
  template: one(templates, { fields: [templateAccess.templateId], references: [templates.id] }),
  user: one(users, { fields: [templateAccess.userId], references: [users.id] }),
}))

export const userNotificationsRelations = relations(userNotifications, ({ one }) => ({
  user: one(users, { fields: [userNotifications.userId], references: [users.id] }),
}))

export const subscriptionEventsRelations = relations(subscriptionEvents, ({ one }) => ({
  user: one(users, { fields: [subscriptionEvents.userId], references: [users.id] }),
}))

export const affiliateCommissionsRelations = relations(affiliateCommissions, ({ one }) => ({
  referrer: one(users, { fields: [affiliateCommissions.referrerId], references: [users.id], relationName: 'referrer' }),
  referee: one(users, { fields: [affiliateCommissions.refereeId], references: [users.id], relationName: 'referee' }),
}))

export const affiliatePayoutsRelations = relations(affiliatePayouts, ({ one }) => ({
  referrer: one(users, { fields: [affiliatePayouts.referrerId], references: [users.id] }),
}))

export const templateUpdatesRelations = relations(templateUpdates, ({ one }) => ({
  template: one(templates, { fields: [templateUpdates.templateId], references: [templates.id] }),
}))

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type Account = typeof accounts.$inferSelect
export type Verification = typeof verifications.$inferSelect
export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert
export type UserSite = typeof userSites.$inferSelect
export type NewUserSite = typeof userSites.$inferInsert
export type SiteData = typeof siteData.$inferSelect
export type SiteImage = typeof siteImages.$inferSelect
export type TemplateUpdate = typeof templateUpdates.$inferSelect
export type UserNotification = typeof userNotifications.$inferSelect
export type FormSchema = typeof formSchemas.$inferSelect
export type FormSubmission = typeof formSubmissions.$inferSelect
export type TemplateAccess = typeof templateAccess.$inferSelect
export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect
export type AffiliateCommission = typeof affiliateCommissions.$inferSelect
export type AffiliatePayout = typeof affiliatePayouts.$inferSelect
export type AffiliateTaxProfile = typeof affiliateTaxProfiles.$inferSelect
export type AffiliateClick = typeof affiliateClicks.$inferSelect

// ─── Waitlist ──────────────────────────────────────────────────────────────────
// REMOVAL: run `DROP TABLE waitlist;` + delete all waitlist files (see docs/waitlist-removal.md)
export const waitlist = pgTable('waitlist', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  name: text('name'),
  source: text('source').default('homepage'),
  confirmToken: uuid('confirm_token').unique().defaultRandom(),
  confirmed: boolean('confirmed').notNull().default(false),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
export type WaitlistEntry = typeof waitlist.$inferSelect

// ─── Support Chat ──────────────────────────────────────────────────────────────

export const supportConversations = pgTable('support_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('open'), // 'open' | 'closed' | 'waiting'
  subject: text('subject'),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  unreadByAdmin: integer('unread_by_admin').notNull().default(0),
  unreadByUser: integer('unread_by_user').notNull().default(0),
  deletedByUser: boolean('deleted_by_user').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_support_conv_user_id').on(t.userId),
  index('idx_support_conv_status').on(t.status),
  index('idx_support_conv_last_msg').on(t.lastMessageAt),
])

export const supportMessages = pgTable('support_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => supportConversations.id, { onDelete: 'cascade' }),
  senderType: text('sender_type').notNull(), // 'user' | 'admin'
  senderId: uuid('sender_id'),
  content: text('content').notNull(),
  contentType: text('content_type').notNull().default('text'), // 'text' | 'image' | 'gif'
  mediaUrl: text('media_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_support_msg_conv_id').on(t.conversationId),
  index('idx_support_msg_created').on(t.createdAt),
])

export const supportConversationsRelations = relations(supportConversations, ({ one, many }) => ({
  user: one(users, { fields: [supportConversations.userId], references: [users.id] }),
  messages: many(supportMessages),
}))

export const supportMessagesRelations = relations(supportMessages, ({ one }) => ({
  conversation: one(supportConversations, { fields: [supportMessages.conversationId], references: [supportConversations.id] }),
  sender: one(users, { fields: [supportMessages.senderId], references: [users.id] }),
}))

export type SupportConversation = typeof supportConversations.$inferSelect
export type SupportMessage = typeof supportMessages.$inferSelect

/** KI-Antwortvorschläge für den Admin (Migration 20261019120000). sent_content wird gefüllt, sobald
 *  der Admin nach diesem Vorschlag antwortet – so lässt sich sehen, wie stark umgeschrieben wird. */
export const supportAiSuggestions = pgTable('support_ai_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => supportConversations.id, { onDelete: 'cascade' }),
  adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
  model: text('model').notNull(),
  hint: text('hint'),
  suggestion: text('suggestion').notNull(),
  sentContent: text('sent_content'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  cachedTokens: integer('cached_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_support_ai_suggestions_conv').on(t.conversationId),
  index('idx_support_ai_suggestions_created').on(t.createdAt),
])

/** Kleiner Schlüssel/Wert-Speicher für Admin-Einstellungen (z. B. 'support_ai_notes'). */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Impersonation ─────────────────────────────────────────────────────────────

export const impersonationRequests = pgTable('impersonation_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminId: uuid('admin_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  // pending → approved → active → ended | pending → rejected
  status: text('status').notNull().default('pending'),
  conversationId: uuid('conversation_id').references(() => supportConversations.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
}, (t) => [
  index('idx_impersonation_token').on(t.token),
  index('idx_impersonation_admin').on(t.adminId),
  index('idx_impersonation_user').on(t.userId),
])

export type ImpersonationRequest = typeof impersonationRequests.$inferSelect

// ─── Email Logs ────────────────────────────────────────────────────────────────

export const emailLogs = pgTable('email_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  // 'welcome' | 'verification' | 'password_reset' | 'subscription_confirmation' |
  // 'payment_failed' | 'payment_reminder' | 'sites_offline' | 'payment_fallback' |
  // 'upcoming_debit' | 'account_deactivated' | 'account_expired' |
  // 'account_canceled' | 'account_reactivated' | 'domain_active' |
  // 'affiliate_referral' | 'affiliate_payout' | 'newsletter' | 'waitlist' | 'other'
  type: text('type').notNull(),
  // Mail-Kategorie (system | updates | tips | offers), siehe src/lib/email/categories.ts
  category: text('category'),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  resendId: text('resend_id'),
  status: text('status').notNull().default('sent'), // 'sent' | 'error' | 'skipped' (Kategorie abbestellt)
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_email_logs_sent_at').on(t.sentAt),
  index('idx_email_logs_type').on(t.type),
])

export type EmailLog = typeof emailLogs.$inferSelect

// ─── Site Analytics ────────────────────────────────────────────────────────────

export const siteEvents = pgTable('site_events', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  // Deliberately no FK: events must survive site deletion so template-level
  // aggregates stay complete
  siteId: uuid('site_id').notNull(),
  templateId: uuid('template_id').notNull(),
  eventType: text('event_type').notNull(), // 'pageview' | 'click' | 'duration'
  visitorHash: varchar('visitor_hash', { length: 64 }),
  host: text('host').notNull(),
  path: text('path').notNull().default('/'),
  // 'instagram' | 'facebook' | 'whatsapp' | 'tiktok' | 'youtube' | 'google' |
  // 'bing' | 'linktree' | 'lnko' | 'twitter' | 'telegram' | 'direct' | 'other'
  source: text('source'),
  referrerHost: text('referrer_host'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  device: varchar('device', { length: 16 }), // 'mobile' | 'tablet' | 'desktop'
  browser: varchar('browser', { length: 32 }),
  os: varchar('os', { length: 32 }),
  country: varchar('country', { length: 8 }),
  meta: jsonb('meta'),
  // Werbe-Ereignisse (contact/lead): Ereignis-Nummer aus dem Browser. Eindeutig, damit
  // Doppelklicks und Wiederholungen nicht doppelt zählen (und nicht doppelt an Meta gehen).
  eventId: varchar('event_id', { length: 64 }),
}, (t) => [
  index('idx_site_events_site_occurred').on(t.siteId, t.occurredAt),
  index('idx_site_events_template_occurred').on(t.templateId, t.occurredAt),
  index('idx_site_events_occurred').on(t.occurredAt),
  // Plain unique index: Postgres lässt beliebig viele NULLs zu, ein partieller Index würde
  // ON CONFLICT (event_id) nicht bedienen.
  uniqueIndex('site_events_event_id_unique').on(t.eventId),
])

export type SiteEvent = typeof siteEvents.$inferSelect

// ─── Werbung & Tracking (Meta / Google Ads / TikTok) ───────────────────────────
// Eine Konfiguration je Nutzer, gilt für alle seine veröffentlichten Seiten
// (optional eingeschränkt über site_ids). Tokens liegen AES-256-GCM-verschlüsselt
// (src/lib/tracking/crypto.ts) und werden nie an den Browser zurückgegeben.
export const trackingConfigs = pgTable('tracking_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  metaPixelId: text('meta_pixel_id'),
  metaTokenEnc: text('meta_token_enc'),
  googleAdsId: text('google_ads_id'),            // AW-123456789
  googleLeadLabel: text('google_lead_label'),    // Conversion-Label „Anfrage“
  googleContactLabel: text('google_contact_label'), // Conversion-Label „Kontakt“ (optional)
  tiktokPixelId: text('tiktok_pixel_id'),
  tiktokTokenEnc: text('tiktok_token_enc'),
  siteIds: jsonb('site_ids').$type<string[] | null>(), // null = alle Seiten
  // Welche Ereignisse an die Plattformen gehen (Seitenaufruf immer). Eigene Statistik zählt immer.
  events: jsonb('events').$type<{ contact: boolean; lead: boolean }>().notNull().default({ contact: true, lead: true }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }), // Verantwortung bestätigt
  lastSendAt: timestamp('last_send_at', { withTimezone: true }),
  lastSendPlatform: text('last_send_platform'),
  lastSendStatus: text('last_send_status'), // 'ok' | 'error'
  lastSendError: text('last_send_error'),
  firstLeadAt: timestamp('first_lead_at', { withTimezone: true }),
  firstLeadNotifiedAt: timestamp('first_lead_notified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TrackingConfig = typeof trackingConfigs.$inferSelect

// ─── Erfahrungsberichte (öffentliche Testimonial-Sammlung) ────────────────────

export const testimonialStatusEnum = pgEnum('testimonial_status', [
  'draft', 'new', 'reviewed', 'published', 'rejected',
])
export const testimonialCategoryEnum = pgEnum('testimonial_category', [
  'produkte', 'stoffwechselkur', 'business',
])
export const testimonialAssetKindEnum = pgEnum('testimonial_asset_kind', [
  'before_image', 'after_image', 'video', 'audio',
])
export const testimonialAssetStatusEnum = pgEnum('testimonial_asset_status', [
  'pending', 'verified', 'rejected',
])

export const testimonials = pgTable('testimonials', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: testimonialStatusEnum('status').notNull().default('draft'),
  category: testimonialCategoryEnum('category').notNull(),
  text: text('text'),
  textSource: varchar('text_source', { length: 16 }), // 'typed' | 'dictated' | 'mixed'
  fullName: varchar('full_name', { length: 200 }),
  displayNameMode: varchar('display_name_mode', { length: 16 }), // 'full' | 'abbreviated'
  age: integer('age'),
  email: varchar('email', { length: 320 }),
  instagram: varchar('instagram', { length: 300 }),
  tiktok: varchar('tiktok', { length: 300 }),
  facebook: varchar('facebook', { length: 300 }),
  // Autorisiert alle Folge-Requests des anonymen Absenders (Upload, Submit)
  uploadToken: varchar('upload_token', { length: 64 }).notNull(),
  consentVersion: varchar('consent_version', { length: 16 }),
  consentHash: varchar('consent_hash', { length: 64 }),
  consentIp: varchar('consent_ip', { length: 64 }),
  consentUa: text('consent_ua'),
  consentedAt: timestamp('consented_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_testimonials_status_created').on(t.status, t.createdAt),
])

export const testimonialAssets = pgTable('testimonial_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  testimonialId: uuid('testimonial_id').notNull()
    .references(() => testimonials.id, { onDelete: 'cascade' }),
  kind: testimonialAssetKindEnum('kind').notNull(),
  status: testimonialAssetStatusEnum('status').notNull().default('pending'),
  r2Key: text('r2_key').notNull(),
  contentType: varchar('content_type', { length: 100 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  durationSeconds: integer('duration_seconds'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_testimonial_assets_testimonial').on(t.testimonialId),
])

export const testimonialsRelations = relations(testimonials, ({ many }) => ({
  assets: many(testimonialAssets),
}))

export const testimonialAssetsRelations = relations(testimonialAssets, ({ one }) => ({
  testimonial: one(testimonials, {
    fields: [testimonialAssets.testimonialId],
    references: [testimonials.id],
  }),
}))

export type Testimonial = typeof testimonials.$inferSelect
export type TestimonialAsset = typeof testimonialAssets.$inferSelect

// ─── Native App: Push (Migration 20261021120000) ──────────────────────────────
// Versand ist standardmäßig AUS (src/lib/push/config.ts). Auslöser schreiben nur in push_outbox,
// der Cron /api/cron/push-drain arbeitet die Warteschlange mit FOR UPDATE SKIP LOCKED ab.

export const pushDevices = pgTable('push_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expoToken: text('expo_token').notNull().unique(),
  platform: text('platform').notNull(), // 'ios' | 'android'
  appVersion: text('app_version'),
  osVersion: text('os_version'),
  deviceModel: text('device_model'),
  locale: text('locale'),
  enabled: boolean('enabled').notNull().default(true),
  disabledReason: text('disabled_reason'), // 'user' | 'device_not_registered' | 'logout' | 'limit'
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_push_devices_user').on(t.userId),
])

export const notificationPreferences = pgTable('notification_preferences', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  leads: boolean('leads').notNull().default(true),
  support: boolean('support').notNull().default(true),
  account: boolean('account').notNull().default(true),
  partner: boolean('partner').notNull().default(true),
  // Besucher-Chat (Migration 20261022200000)
  chat: boolean('chat').notNull().default(true),
  // Neuigkeiten von FinestSites (Migration 20261027060000)
  news: boolean('news').notNull().default(true),
  quietHoursEnabled: boolean('quiet_hours_enabled').notNull().default(true),
  quietStartHour: smallint('quiet_start_hour').notNull().default(21),
  quietEndHour: smallint('quiet_end_hour').notNull().default(8),
  timezone: text('timezone').notNull().default('Europe/Berlin'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const pushOutbox = pgTable('push_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').notNull(), // 'leads' | 'support' | 'account' | 'partner' | 'chat'
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  collapseKey: text('collapse_key'),
  notificationId: uuid('notification_id').references(() => userNotifications.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending'), // pending | processing | sent | failed | skipped
  skipReason: text('skip_reason'),
  attempts: integer('attempts').notNull().default(0),
  notBefore: timestamp('not_before', { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lastError: text('last_error'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_push_outbox_user_collapse').on(t.userId, t.collapseKey, t.createdAt),
])

export const pushDeliveries = pgTable('push_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  outboxId: uuid('outbox_id').notNull().references(() => pushOutbox.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').references(() => pushDevices.id, { onDelete: 'set null' }),
  ticketId: text('ticket_id'),
  status: text('status').notNull(), // 'ok' | 'error'
  error: text('error'),
  receiptStatus: text('receipt_status'), // 'ok' | 'error' | null (noch nicht geprüft)
  receiptError: text('receipt_error'),
  receiptCheckedAt: timestamp('receipt_checked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_push_deliveries_outbox').on(t.outboxId),
])

// ─── Neuigkeiten / Ankündigungen (Migration 20261027060000, docs/news/spec.md) ───────────────
export const newsPosts = pgTable('news_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: text('status').notNull().default('draft'), // 'draft' | 'published' | 'archived'
  title: text('title').notNull(),
  pushTitle: text('push_title').notNull(),
  pushBody: text('push_body').notNull(),
  body: text('body').notNull(),
  ctaLabel: text('cta_label'),
  ctaKind: text('cta_kind'), // 'sites' | 'submissions' | 'chats' | 'affiliate' | 'settings' | 'url' | null
  ctaUrl: text('cta_url'),
  audience: text('audience').notNull().default('all'), // 'all' | 'plan:starter' | 'plan:pro' | 'plan:unlimited' | 'users'
  // Migration 20261027120000: nur bei audience = 'users' gefüllt (Konten, die die Neuigkeit sehen – zum Testen)
  audienceUserIds: uuid('audience_user_ids').array().notNull().default(sql`'{}'::uuid[]`),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  // „Sichtbar bis“ (Ende des Tages Europe/Berlin); NULL = sichtbar bis zum Archivieren
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  pushSentAt: timestamp('push_sent_at', { withTimezone: true }),
  pushQueued: integer('push_queued').notNull().default(0),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_news_posts_published').on(t.publishedAt),
])

export const newsReads = pgTable('news_reads', {
  newsId: uuid('news_id').notNull().references(() => newsPosts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  readAt: timestamp('read_at', { withTimezone: true }),
  ctaClickedAt: timestamp('cta_clicked_at', { withTimezone: true }),
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
}, (t) => [
  primaryKey({ columns: [t.newsId, t.userId] }),
  index('idx_news_reads_user').on(t.userId),
])

export type NewsPost = typeof newsPosts.$inferSelect
export type NewsRead = typeof newsReads.$inferSelect

export type PushDevice = typeof pushDevices.$inferSelect
export type NotificationPreference = typeof notificationPreferences.$inferSelect
export type PushOutboxRow = typeof pushOutbox.$inferSelect
export type PushDelivery = typeof pushDeliveries.$inferSelect

// ─── Besucher-Chat (Migration 20261022200000) ─────────────────────────────────
// Seitenbesucher ↔ Seitenbetreiber, siehe docs/chat/konzept.md. Vom Besucher-Token und der IP
// werden nur Hashes gespeichert. Schalter: app_settings visitor_chat_enabled / visitor_chat_users.

export const chatConversations = pgTable('chat_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  siteId: uuid('site_id').notNull().references(() => userSites.id, { onDelete: 'cascade' }),
  visitorTokenHash: varchar('visitor_token_hash', { length: 64 }).notNull(), // sha256 des Browser-Tokens
  visitorName: text('visitor_name'),
  visitorEmail: text('visitor_email'),
  visitorPhone: text('visitor_phone'),
  notifyByEmail: boolean('notify_by_email').notNull().default(false),
  visitorKey: varchar('visitor_key', { length: 8 }).notNull(), // Kurzkennung „Besucher 4F2A“
  status: text('status').notNull().default('open'), // open | archived | blocked
  startedOnPath: text('started_on_path'),
  userAgent: text('user_agent'),
  ipHash: varchar('ip_hash', { length: 64 }),
  ownerUnread: integer('owner_unread').notNull().default(0),
  visitorUnread: integer('visitor_unread').notNull().default(0),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  lastMessagePreview: text('last_message_preview'),
  lastMessageSender: text('last_message_sender'),
  visitorLastSeenAt: timestamp('visitor_last_seen_at', { withTimezone: true }),
  ownerLastSeenAt: timestamp('owner_last_seen_at', { withTimezone: true }),
  reportedAt: timestamp('reported_at', { withTimezone: true }),
  reportReason: text('report_reason'),
  visitorNotifiedAt: timestamp('visitor_notified_at', { withTimezone: true }), // Drossel der Antwort-Mail
  resumeCode: varchar('resume_code', { length: 8 }), // Gesprächs-Code (8 Zeichen, Migration 20261022250000); je Seite eindeutig
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('chat_conversations_site_visitor_unique').on(t.siteId, t.visitorTokenHash),
  index('idx_chat_conversations_user_status_updated').on(t.userId, t.status, t.updatedAt),
  index('idx_chat_conversations_site_token').on(t.siteId, t.visitorTokenHash),
])

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  sender: text('sender').notNull(), // 'visitor' | 'owner' | 'system'
  body: text('body').notNull(), // ≤ 2000 Zeichen
  clientId: varchar('client_id', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true }),
}, (t) => [
  index('idx_chat_messages_conversation_created').on(t.conversationId, t.createdAt),
])

export const chatBlocks = pgTable('chat_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  visitorTokenHash: varchar('visitor_token_hash', { length: 64 }),
  ipHash: varchar('ip_hash', { length: 64 }),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_chat_blocks_user_token').on(t.userId, t.visitorTokenHash),
  index('idx_chat_blocks_user_ip').on(t.userId, t.ipHash),
])

export const chatResumeTokens = pgTable('chat_resume_tokens', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  /** reply (Antwort-Mail, 30 Tage) | handoff (Übergabe-Link, 7 Tage) | handoff_mail (Übergabe-Link per Mail, 7 Tage) */
  kind: text('kind').notNull().default('reply'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Weitere Besucher-Token (Alias) je Gespräch – Übergabe zwischen Browsern; nur sha256-Hashes. */
export const chatVisitorTokens = pgTable('chat_visitor_tokens', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => chatConversations.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (t) => [
  index('idx_chat_visitor_tokens_conversation').on(t.conversationId),
])

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  user: one(users, { fields: [chatConversations.userId], references: [users.id] }),
  site: one(userSites, { fields: [chatConversations.siteId], references: [userSites.id] }),
  messages: many(chatMessages),
}))

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, { fields: [chatMessages.conversationId], references: [chatConversations.id] }),
}))

export type ChatConversationRow = typeof chatConversations.$inferSelect
export type ChatMessageRow = typeof chatMessages.$inferSelect
export type ChatBlockRow = typeof chatBlocks.$inferSelect
export type ChatResumeTokenRow = typeof chatResumeTokens.$inferSelect
