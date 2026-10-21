/**
 * GET /api/app/v1/overview — Startbildschirm: Seiten-Karten, Ungelesen-Zähler,
 * Besucher/Kontakte/Anfragen der letzten 7 und 30 Tage (eigene Statistik aus site_events,
 * gleiche Zählweise wie /api/tracking/stats).
 */
import { db } from '@/lib/db'
import { formSubmissions, siteEvents, supportConversations, userNotifications } from '@/lib/db/schema'
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { appError, appJson, requireAppUser, toIso } from '@/lib/app-api/http'
import { domainInfo, loadProfile, loadSites, siteStatus, siteUrl, thumbnailOf } from '@/lib/app-api/account'
import { OverviewResponse, type PeriodStats } from '@/lib/contracts/app-v1/overview'

export const dynamic = 'force-dynamic'

const EMPTY: PeriodStats = { visitors: 0, pageviews: 0, contacts: 0, leads: 0 }

async function periodStats(siteIds: string[], days: number): Promise<PeriodStats> {
  if (siteIds.length === 0) return EMPTY
  const since = new Date(Date.now() - days * 86400_000)
  const count = (type: string) => sql<number>`count(*) filter (where ${siteEvents.eventType} = ${type})`.mapWith(Number)
  const [row] = await db.select({
    visitors: sql<number>`count(distinct ${siteEvents.visitorHash}) filter (where ${siteEvents.eventType} = 'pageview')`.mapWith(Number),
    pageviews: count('pageview'),
    contacts: count('contact'),
    leads: count('lead'),
  }).from(siteEvents).where(and(inArray(siteEvents.siteId, siteIds), gte(siteEvents.occurredAt, since)))
  return {
    visitors: row?.visitors ?? 0,
    pageviews: row?.pageviews ?? 0,
    contacts: row?.contacts ?? 0,
    leads: row?.leads ?? 0,
  }
}

export async function GET(req: Request) {
  const auth = await requireAppUser(req, 'overview', 60)
  if (auth.response) return auth.response
  const userId = auth.user.id

  const [profile, sites] = await Promise.all([loadProfile(userId), loadSites(userId)])
  if (!profile) return appError('UNAUTHORIZED')
  const siteIds = sites.map(s => s.id)

  const [unreadBySite, supportRow, notifRow, last7, last30] = await Promise.all([
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
    periodStats(siteIds, 30),
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
    publishedAt: toIso(s.publishedAt),
    updatedAt: toIso(s.updatedAt)!,
  }))

  return appJson(OverviewResponse, {
    sites: cards,
    unread: {
      // Gleiche Regel wie /api/submissions/unread-count (nur Entwürfe + veröffentlichte Seiten)
      submissions: sites.filter(s => s.status === 'draft' || s.status === 'published')
        .reduce((sum, s) => sum + (unreadMap.get(s.id) ?? 0), 0),
      support: supportRow[0]?.n ?? 0,
      notifications: notifRow[0]?.n ?? 0,
    },
    stats: { last7, last30 },
  })
}
