/**
 * GET /api/app/v1/overview — Startbildschirm: Seiten-Karten, Ungelesen-Zähler,
 * Besucher/Kontakte/Anfragen der letzten 7 und 30 Tage (eigene Statistik aus site_events,
 * gleiche Zählweise wie /api/tracking/stats), Vergleich zur Vorwoche, neutraler Konto-Status
 * und „Zu erledigen“ (nur Codes, die Texte stehen in der App).
 */
import { db } from '@/lib/db'
import { affiliateCommissions, affiliateTaxProfiles, formSubmissions, siteEvents, supportConversations, userNotifications } from '@/lib/db/schema'
import { and, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm'
import { appError, appJson, requireAppUser, toIso } from '@/lib/app-api/http'
import { syncNotificationReads } from '@/lib/push/notification-sync'
import { accountOffline, affiliateEligible, domainInfo, loadProfile, loadSites, siteStatus, siteUrl, thumbnailOf } from '@/lib/app-api/account'
import { getAppRuntimeSettings } from '@/lib/app-api/settings'
import { unpublishedChangesFor } from '@/lib/sites/published-data'
import { isTaxProfileComplete } from '@/lib/affiliate/tax'
import { OverviewResponse, type PeriodStats, type Todo, type AccountStatusCode } from '@/lib/contracts/app-v1/overview'
import { isVisitorChatEnabledForUser } from '@/lib/chat/flags'
import { ownerUnread } from '@/lib/chat/service'
import { overviewFor as newsOverviewFor } from '@/lib/news/service'

export const dynamic = 'force-dynamic'

const EMPTY: PeriodStats = { visitors: 0, pageviews: 0, contacts: 0, leads: 0, submissions: 0 }
const DAY = 86400_000

/** Statistik für den Zeitraum [jetzt − fromDays, jetzt − toDays). */
async function periodStats(siteIds: string[], fromDays: number, toDays = 0): Promise<PeriodStats> {
  if (siteIds.length === 0) return EMPTY
  const since = new Date(Date.now() - fromDays * DAY)
  const until = new Date(Date.now() - toDays * DAY)
  const count = (type: string) => sql<number>`count(*) filter (where ${siteEvents.eventType} = ${type})`.mapWith(Number)
  const [[row], [subs]] = await Promise.all([db.select({
    visitors: sql<number>`count(distinct ${siteEvents.visitorHash}) filter (where ${siteEvents.eventType} = 'pageview')`.mapWith(Number),
    pageviews: count('pageview'),
    contacts: count('contact'),
    leads: count('lead'),
  }).from(siteEvents).where(and(
    inArray(siteEvents.siteId, siteIds),
    gte(siteEvents.occurredAt, since),
    ...(toDays > 0 ? [lt(siteEvents.occurredAt, until)] : []),
  )), db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(formSubmissions).where(and(
    inArray(formSubmissions.userSiteId, siteIds),
    eq(formSubmissions.isSpam, false),
    gte(formSubmissions.createdAt, since),
    ...(toDays > 0 ? [lt(formSubmissions.createdAt, until)] : []),
  ))])
  return {
    visitors: row?.visitors ?? 0,
    pageviews: row?.pageviews ?? 0,
    contacts: row?.contacts ?? 0,
    leads: row?.leads ?? 0,
    submissions: subs?.n ?? 0,
  }
}

/** Eindeutige Besucher je Seite in den letzten 7 Tagen. */
async function visitorsBySite(siteIds: string[]): Promise<Map<string, number>> {
  if (siteIds.length === 0) return new Map()
  const since = new Date(Date.now() - 7 * DAY)
  const rows = await db.select({
    siteId: siteEvents.siteId,
    n: sql<number>`count(distinct ${siteEvents.visitorHash})`.mapWith(Number),
  }).from(siteEvents)
    .where(and(inArray(siteEvents.siteId, siteIds), eq(siteEvents.eventType, 'pageview'), gte(siteEvents.occurredAt, since)))
    .groupBy(siteEvents.siteId)
  return new Map(rows.map(r => [r.siteId, r.n]))
}

/** Steuerprofil fehlt nur dann als Aufgabe, wenn wirklich schon Provisionen da sind. */
async function taxProfileMissing(userId: string): Promise<boolean> {
  const [c] = await db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(affiliateCommissions)
    .where(eq(affiliateCommissions.referrerId, userId))
  if ((c?.n ?? 0) === 0) return false
  const tp = await db.query.affiliateTaxProfiles.findFirst({ where: eq(affiliateTaxProfiles.userId, userId) }).catch(() => undefined)
  return !isTaxProfileComplete(tp ?? null)
}

export async function GET(req: Request) {
  const auth = await requireAppUser(req, 'overview', 60)
  if (auth.response) return auth.response
  const userId = auth.user.id

  const [profile, sites, settings] = await Promise.all([loadProfile(userId), loadSites(userId), getAppRuntimeSettings()])
  if (!profile) return appError('UNAUTHORIZED')
  const siteIds = sites.map(s => s.id)

  await syncNotificationReads(userId)
  const [unreadBySite, supportRow, notifRow, last7, prev7, last30, visitors, changes, chatUnread, news] = await Promise.all([
    siteIds.length === 0 ? Promise.resolve([] as { siteId: string; n: number }[]) :
      db.select({ siteId: formSubmissions.userSiteId, n: sql<number>`count(*)::int`.mapWith(Number) })
        .from(formSubmissions)
        .where(and(
          inArray(formSubmissions.userSiteId, siteIds),
          isNull(formSubmissions.readAt),
          isNull(formSubmissions.archivedAt),
          eq(formSubmissions.isSpam, false),
        ))
        .groupBy(formSubmissions.userSiteId),
    db.select({ n: sql<number>`coalesce(sum(${supportConversations.unreadByUser}), 0)::int`.mapWith(Number) })
      .from(supportConversations)
      .where(and(eq(supportConversations.userId, userId), eq(supportConversations.deletedByUser, false))),
    db.select({ n: sql<number>`count(*)::int`.mapWith(Number) })
      .from(userNotifications)
      .where(and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt))),
    periodStats(siteIds, 7),
    periodStats(siteIds, 14, 7),
    periodStats(siteIds, 30),
    visitorsBySite(siteIds),
    unpublishedChangesFor(sites.map(s => ({ id: s.id, status: s.status, publishedData: (s.publishedData ?? null) as Record<string, string> | null }))),
    // Besucher-Chat: 0, wenn das Konto nicht freigeschaltet ist (dann gibt es auch kein Todo)
    isVisitorChatEnabledForUser(userId).then(on => on ? ownerUnread(userId) : { count: 0, conversations: 0 }),
    // Neuigkeiten: Ungelesen-Zähler + Startkarte (neueste weder gelesene noch weggewischte); Fehler = leer, nie 500
    newsOverviewFor(userId, { plan: profile.plan }).catch(err => {
      console.error('[overview] news failed:', err instanceof Error ? err.message : err)
      return { unread: 0, latest: null }
    }),
  ])

  const unreadMap = new Map(unreadBySite.map(r => [r.siteId, r.n]))
  const cards = sites.map(s => ({
    id: s.id,
    title: s.templateTitle,
    status: siteStatus(s, profile),
    url: siteUrl(s, profile.username),
    domain: domainInfo(s),
    thumbnailUrl: thumbnailOf(s),
    unreadSubmissions: unreadMap.get(s.id) ?? 0,
    visitors7d: visitors.get(s.id) ?? 0,
    hasUnpublishedChanges: changes[s.id] ?? false,
    publishedAt: toIso(s.publishedAt),
    updatedAt: toIso(s.updatedAt)!,
  }))

  // Gleiche Regel wie /api/submissions/unread-count (nur Entwürfe + veröffentlichte Seiten)
  const unreadSubmissions = sites.filter(s => s.status === 'draft' || s.status === 'published')
    .reduce((sum, s) => sum + (unreadMap.get(s.id) ?? 0), 0)
  const unreadSupport = supportRow[0]?.n ?? 0

  // ── Konto-Status (neutral) ──
  const online = cards.filter(c => c.status === 'online').length
  const offline = cards.filter(c => c.status === 'offline').length
  let code: AccountStatusCode
  if (cards.length === 0) code = 'no_sites'
  else if (offline > 0) code = 'site_offline'
  else if (online === 0) code = 'drafts_only'
  else if (profile.paymentFailedAt || accountOffline(profile)) code = 'account_notice'
  else code = 'ok'

  // ── Zu erledigen ──
  const todos: Todo[] = []
  if (cards.length === 0) todos.push({ id: 'first_site', code: 'first_site' })
  if (unreadSubmissions > 0) todos.push({ id: 'unread_submissions', code: 'unread_submissions', count: unreadSubmissions })
  if (chatUnread.count > 0) todos.push({ id: 'unread_chats', code: 'unread_chats', count: chatUnread.count })
  if (unreadSupport > 0) todos.push({ id: 'support_reply', code: 'support_reply', count: unreadSupport })
  for (const c of cards) {
    if (c.status === 'online' && c.hasUnpublishedChanges) {
      todos.push({ id: `unpublished_changes:${c.id}`, code: 'unpublished_changes', siteId: c.id, siteTitle: c.title })
    }
    if (c.domain?.status === 'pending') {
      todos.push({ id: `domain_pending:${c.id}`, code: 'domain_pending', siteId: c.id, siteTitle: c.title })
    }
  }
  if (!profile.firstName || !profile.lastName) todos.push({ id: 'complete_profile', code: 'complete_profile' })
  if (!profile.teamPartnerNumber) todos.push({ id: 'team_partner_missing', code: 'team_partner_missing' })
  if (settings.features.partnerProgram && await affiliateEligible(profile) && await taxProfileMissing(userId)) {
    todos.push({ id: 'tax_profile_missing', code: 'tax_profile_missing' })
  }

  return appJson(OverviewResponse, {
    sites: cards,
    unread: {
      submissions: unreadSubmissions,
      support: unreadSupport,
      notifications: notifRow[0]?.n ?? 0,
      chat: chatUnread.count,
    },
    stats: { last7, prev7, last30 },
    accountStatus: { code, online, offline },
    todos,
    news,
  })
}
