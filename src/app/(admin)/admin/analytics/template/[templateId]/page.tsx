import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AutoRefresh } from '../../AutoRefresh'
import { SitesTable, type SiteTableRow } from '../../SitesTable'
import {
  BreakdownCard, countryName, DailyChart, deviceLabel, fmtDuration, fmtNum, parseRange, pct,
  perDay, prevSinceSql, RangePills, sinceSql, sourceLabel, StatTile, trendPct, utmLabel,
} from '../../shared'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type TotalsRow = {
  views: number
  visitors: number
  mobile_views: number
}

type DayRow = {
  day: string
  views: number
}

type BreakdownRow = {
  key: string | null
  cnt: number
}

type SiteRow = {
  site_id: string
  host: string
  email: string | null
  live: number
  views: number
  visitors: number
  mobile_views: number
  last_view: Date
}

export default async function TemplateAnalyticsPage({ params, searchParams }: {
  params: Promise<{ templateId: string }>
  searchParams: Promise<{ range?: string }>
}) {
  const { templateId } = await params
  if (!UUID_RE.test(templateId)) notFound()

  const range = parseRange((await searchParams).range)
  const since = sinceSql(range)
  const prevSince = prevSinceSql(range)

  const breakdown = (column: 'source' | 'device' | 'browser' | 'country' | 'path' | 'referrer_host', limit: number) =>
    db.execute<BreakdownRow>(sql`
      SELECT ${sql.raw(column)} AS key, COUNT(*)::int AS cnt
      FROM site_events
      WHERE event_type = 'pageview' AND template_id = ${templateId} AND occurred_at >= ${since}
      GROUP BY 1
      ORDER BY cnt DESC
      LIMIT ${limit}
    `)

  const [titleRows, totalsRows, prevTotalsRows, liveRows, durationRows, dayRows, siteRows, siteSourceRows, siteSubmissionRows, sources, devices, browsers, countries, paths, referrers, utmRows] =
    await Promise.all([
      db.execute<{ title: string | null }>(sql`
        SELECT title FROM templates WHERE id = ${templateId}
      `),
      db.execute<TotalsRow>(sql`
        SELECT
          COUNT(*)::int AS views,
          COUNT(DISTINCT visitor_hash)::int AS visitors,
          COUNT(*) FILTER (WHERE device = 'mobile')::int AS mobile_views
        FROM site_events
        WHERE event_type = 'pageview' AND template_id = ${templateId} AND occurred_at >= ${since}
      `),
      db.execute<{ views: number; visitors: number }>(sql`
        SELECT
          COUNT(*)::int AS views,
          COUNT(DISTINCT visitor_hash)::int AS visitors
        FROM site_events
        WHERE event_type = 'pageview' AND template_id = ${templateId}
          AND occurred_at >= ${prevSince} AND occurred_at < ${since}
      `),
      db.execute<{ visitors: number }>(sql`
        SELECT COUNT(DISTINCT visitor_hash)::int AS visitors
        FROM site_events
        WHERE event_type = 'pageview' AND template_id = ${templateId}
          AND occurred_at >= now() - interval '5 minutes'
      `),
      db.execute<{ avg_seconds: number | null }>(sql`
        SELECT AVG((meta->>'seconds')::numeric)::float AS avg_seconds
        FROM site_events
        WHERE event_type = 'duration' AND template_id = ${templateId} AND occurred_at >= ${since}
      `),
      db.execute<DayRow>(sql`
        SELECT
          to_char((occurred_at AT TIME ZONE 'Europe/Berlin')::date, 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS views
        FROM site_events
        WHERE event_type = 'pageview' AND template_id = ${templateId} AND occurred_at >= ${since}
        GROUP BY 1
        ORDER BY 1
      `),
      db.execute<SiteRow>(sql`
        SELECT
          e.site_id,
          MAX(e.host) AS host,
          u.email,
          COUNT(DISTINCT e.visitor_hash) FILTER (WHERE e.occurred_at >= now() - interval '5 minutes')::int AS live,
          COUNT(*)::int AS views,
          COUNT(DISTINCT e.visitor_hash)::int AS visitors,
          COUNT(*) FILTER (WHERE e.device = 'mobile')::int AS mobile_views,
          MAX(e.occurred_at) AS last_view
        FROM site_events e
        LEFT JOIN user_sites s ON s.id = e.site_id
        LEFT JOIN users u ON u.id = s.user_id
        WHERE e.event_type = 'pageview' AND e.template_id = ${templateId} AND e.occurred_at >= ${since}
        GROUP BY e.site_id, u.email
        ORDER BY views DESC
      `),
      db.execute<{ site_id: string; source: string }>(sql`
        SELECT DISTINCT ON (site_id) site_id, source
        FROM (
          SELECT site_id, source, COUNT(*) AS cnt
          FROM site_events
          WHERE event_type = 'pageview' AND template_id = ${templateId}
            AND occurred_at >= ${since} AND source IS NOT NULL
          GROUP BY site_id, source
        ) x
        ORDER BY site_id, cnt DESC
      `),
      db.execute<{ site_id: string; n: number }>(sql`
        SELECT f.user_site_id AS site_id, COUNT(*)::int AS n
        FROM form_submissions f
        JOIN user_sites s ON s.id = f.user_site_id
        WHERE f.is_spam = false AND f.created_at >= ${since} AND s.template_id = ${templateId}
        GROUP BY f.user_site_id
      `),
      breakdown('source', 13),
      breakdown('device', 4),
      breakdown('browser', 8),
      breakdown('country', 10),
      breakdown('path', 10),
      breakdown('referrer_host', 10),
      db.execute<{ utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; cnt: number }>(sql`
        SELECT utm_source, utm_medium, utm_campaign, COUNT(*)::int AS cnt
        FROM site_events
        WHERE event_type = 'pageview' AND template_id = ${templateId}
          AND occurred_at >= ${since} AND utm_source IS NOT NULL
        GROUP BY 1, 2, 3
        ORDER BY cnt DESC
        LIMIT 10
      `),
    ])

  const totals = totalsRows[0] ?? { views: 0, visitors: 0, mobile_views: 0 }
  const prevTotals = prevTotalsRows[0] ?? { views: 0, visitors: 0 }
  if (!titleRows[0] && totals.views === 0) notFound()

  const title = titleRows[0]?.title ?? 'Gelöschtes Template'
  const liveVisitors = liveRows[0]?.visitors ?? 0
  const avgDuration = durationRows[0]?.avg_seconds ?? null

  const sourceBySite = new Map(siteSourceRows.map(r => [r.site_id, r.source]))
  const submissionsBySite = new Map(siteSubmissionRows.map(r => [r.site_id, r.n]))

  const tableRows: SiteTableRow[] = siteRows.map(r => ({
    siteId: r.site_id,
    host: r.host,
    email: r.email,
    template: title,
    live: r.live,
    views: r.views,
    visitors: r.visitors,
    submissions: submissionsBySite.get(r.site_id) ?? 0,
    mobilePct: pct(r.mobile_views, r.views),
    source: sourceLabel(sourceBySite.get(r.site_id) ?? null),
    lastView: new Date(r.last_view).toISOString(),
  }))

  const toEntries = (rows: BreakdownRow[], label: (key: string | null) => string) =>
    rows.map(r => ({ label: label(r.key), count: r.cnt }))

  return (
    <div style={{ maxWidth: 1180 }}>
      <AutoRefresh />
      <div className="mb-6">
        <Link href={`/admin/analytics?range=${range}`}
          className="flex items-center gap-2 text-sm mb-5" style={{ color: '#94A3B8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Zurück zur Übersicht
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{title}</h1>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
              Template · {fmtNum(tableRows.length)} {tableRows.length === 1 ? 'Seite' : 'Seiten'} mit Aufrufen
            </p>
          </div>
          <RangePills current={range} basePath={`/admin/analytics/template/${templateId}`} />
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatTile label="Jetzt online" value={fmtNum(liveVisitors)} sub="letzte 5 Minuten"
          color={liveVisitors > 0 ? '#15803D' : '#94A3B8'} />
        <StatTile label="Aufrufe" value={fmtNum(totals.views)} sub={`letzte ${range} Tage`} color="#1D4ED8"
          trend={trendPct(totals.views, prevTotals.views)} />
        <StatTile label="Besucher" value={fmtNum(totals.visitors)} sub={`letzte ${range} Tage`}
          trend={trendPct(totals.visitors, prevTotals.visitors)} />
        <StatTile label="Ø Verweildauer" value={fmtDuration(avgDuration)} sub="pro Besuch" />
        <StatTile label="Ø Aufrufe/Tag" value={perDay(totals.views, range)} sub="im Zeitraum" />
        <StatTile label="Mobile-Anteil" value={`${pct(totals.mobile_views, totals.views)} %`} sub="der Aufrufe" />
      </div>

      {/* Tagesverlauf */}
      <div className="mb-6">
        <DailyChart dayRows={dayRows} range={range} />
      </div>

      {/* Aufschlüsselungen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <BreakdownCard title="Geräte" total={totals.views} entries={toEntries(devices, deviceLabel)} />
        <BreakdownCard title="Quellen" total={totals.views} entries={toEntries(sources, sourceLabel)} />
        <BreakdownCard title="Browser" total={totals.views} entries={toEntries(browsers, k => k ?? 'Unbekannt')} />
        <BreakdownCard title="Länder" total={totals.views} entries={toEntries(countries, countryName)} />
        <BreakdownCard title="Seiten" total={totals.views} entries={toEntries(paths, k => k ?? '/')} />
        <BreakdownCard title="Referrer-Domains" total={totals.views} entries={toEntries(referrers, k => k ?? 'Direkt')} />
        <BreakdownCard title="Kampagnen (UTM)" total={totals.views}
          entries={utmRows.map(r => ({ label: utmLabel(r.utm_source, r.utm_medium, r.utm_campaign), count: r.cnt }))} />
      </div>

      {/* Seiten dieses Templates */}
      <SitesTable rows={tableRows} range={range} />
    </div>
  )
}
