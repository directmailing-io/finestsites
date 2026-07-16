import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  integer,
  numeric,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

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
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  isAdmin: boolean('is_admin').notNull().default(false),
  // Profile fields
  firstName: text('first_name'),
  lastName: text('last_name'),
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
  // NM company preferences
  nmCompanies: text('nm_companies').array().default([]),
  // PM-International / FitLine
  teamPartnerNumber: text('team_partner_number'),
  // Affiliate
  referredByUsername: text('referred_by_username'),
  stripeConnectId: text('stripe_connect_id').unique(),
  affiliateOnboarded: boolean('affiliate_onboarded').default(false),
  affiliatePayoutEmail: text('affiliate_payout_email'),
  // Global content consent (legal proof — stored once at onboarding)
  contentConsentAt: timestamp('content_consent_at', { withTimezone: true }),
  contentConsentIp: varchar('content_consent_ip', { length: 64 }),
  contentConsentUa: text('content_consent_ua'),
  contentConsentVersion: varchar('content_consent_version', { length: 20 }),
  contentConsentTextHash: varchar('content_consent_text_hash', { length: 64 }),
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
  referrerId: uuid('referrer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refereeId: uuid('referee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeInvoiceId: text('stripe_invoice_id').notNull().unique(),
  stripeCustomerId: text('stripe_customer_id'),
  grossAmount: integer('gross_amount').notNull(),
  commissionRate: numeric('commission_rate', { precision: 5, scale: 4 }).notNull().default('0.15'),
  commissionAmount: integer('commission_amount').notNull(),
  status: text('status').notNull().default('pending'),
  availableAt: timestamp('available_at', { withTimezone: true }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  payoutId: uuid('payout_id'),
  reversalReason: text('reversal_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_commissions_referrer').on(t.referrerId, t.status),
  index('idx_commissions_referee').on(t.refereeId),
])

export const affiliatePayouts = pgTable('affiliate_payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  referrerId: uuid('referrer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  commissionIds: uuid('commission_ids').array().notNull(),
  totalAmount: integer('total_amount').notNull(),
  commissionCount: integer('commission_count').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  stripeTransferId: text('stripe_transfer_id'),
  payoutMethod: text('payout_method').default('stripe_connect'),
  status: text('status').notNull().default('pending'),
  pdfUrl: text('pdf_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
}, (t) => [
  index('idx_payouts_referrer').on(t.referrerId),
])

export const affiliateClicks = pgTable('affiliate_clicks', {
  id: uuid('id').primaryKey().defaultRandom(),
  referrerUsername: text('referrer_username').notNull(),
  ipHash: text('ip_hash'),
  userAgentShort: text('user_agent_short'),
  converted: boolean('converted').default(false),
  convertedUserId: uuid('converted_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_clicks_referrer').on(t.referrerUsername),
])

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
