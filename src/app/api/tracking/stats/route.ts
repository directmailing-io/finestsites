/**
 * Auswertung für den Nutzer: Seitenaufrufe, Kontakte, Anfragen der letzten 30 Tage,
 * je Seite und je Kampagne (aus utm_* der Anzeigen-Links). Kommt aus unserer eigenen
 * Statistik, funktioniert also auch ohne Einwilligung und ohne Adblocker-Verluste.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { siteEvents, userSites } from '@/lib/db/schema'
import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const days = Math.min(90, Math.max(7, parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10) || 30))
  const since = new Date(Date.now() - days * 86400_000)

  const sites = await db.select({ id: userSites.id }).from(userSites).where(eq(userSites.userId, user.id))
  const ids = sites.map(s => s.id)
  if (ids.length === 0) return NextResponse.json({ days, totals: { pageviews: 0, contacts: 0, leads: 0, consentYes: 0, consentNo: 0 }, bySite: [], byCampaign: [] })

  const where = and(inArray(siteEvents.siteId, ids), gte(siteEvents.occurredAt, since))
  const count = (type: string) => sql<number>`count(*) filter (where ${siteEvents.eventType} = ${type})`.mapWith(Number)
  const consent = (choice: string) => sql<number>`count(*) filter (where ${siteEvents.eventType} = 'consent' and ${siteEvents.meta}->>'choice' = ${choice})`.mapWith(Number)

  const [totals] = await db.select({
    pageviews: count('pageview'), contacts: count('contact'), leads: count('lead'), consentYes: consent('yes'), consentNo: consent('no'),
  }).from(siteEvents).where(where)

  const bySite = await db.select({
    siteId: siteEvents.siteId, host: sql<string>`max(${siteEvents.host})`,
    pageviews: count('pageview'), contacts: count('contact'), leads: count('lead'),
  }).from(siteEvents).where(where).groupBy(siteEvents.siteId)

  const byCampaign = await db.select({
    source: sql<string>`coalesce(nullif(${siteEvents.utmSource}, ''), ${siteEvents.source}, 'direkt')`,
    campaign: sql<string>`coalesce(nullif(${siteEvents.utmCampaign}, ''), '')`,
    pageviews: count('pageview'), contacts: count('contact'), leads: count('lead'),
  }).from(siteEvents).where(where)
    .groupBy(sql`1`, sql`2`)
    .orderBy(sql`3 desc`)
    .limit(40)

  return NextResponse.json({ days, totals, bySite, byCampaign })
}
