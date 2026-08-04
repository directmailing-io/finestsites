import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import Link from 'next/link'
import { AutoRefresh } from './AutoRefresh'
import { SitesTable, type SiteTableRow } from './SitesTable'
import { cardStyle, fmtDuration, fmtNum, parseRange, pct, perDay, RangePills, sinceSql, sourceLabel, StatTile } from './shared'

export const dynamic = 'force-dynamic'

type TotalsRow = {
  views: number
  visitors: number
  mobile_views: number
}

type CountRow = { n: number }

type TopSourceRow = { source: string }

type TemplateRow = {
  template_id: string
  title: string | null
  views: number
  visitors: number
  mobile_views: number
  tablet_views: number
  desktop_views: number
}

type AvgDurationRow = {
  template_id: string
  avg_seconds: number | null
}

type SiteRow = {
  site_id: string
  host: string
  email: string | null
  template_title: string | null
  live: number
  views: number
  visitors: number
  mobile_views: number
  last_view: Date
}

type SiteSourceRow = {
  site_id: string
  source: string
}

type SiteSubmissionRow = {
  site_id: string
  n: number
}

export default async function AnalyticsPage({ searchParams }: {
  searchParams: Promise<{ range?: string }>
}) {
  const range = parseRange((await searchParams).range)
  const since = sinceSql(range)

  const [totalsRows, liveTotalRows, submissionRows, topSourceRows, templateRows, siteRows, siteSourceRows, siteSubmissionRows, avgDurationRows, templateDurationRows] =
    await Promise.all([
      db.execute<TotalsRow>(sql`
        SELECT
          COUNT(*)::int AS views,
          COUNT(DISTINCT visitor_hash)::int AS visitors,
          COUNT(*) FILTER (WHERE device = 'mobile')::int AS mobile_views
        FROM site_events
        WHERE event_type = 'pageview' AND occurred_at >= ${since}
      `),
      db.execute<CountRow>(sql`
        SELECT COUNT(DISTINCT visitor_hash)::int AS n
        FROM site_events
        WHERE event_type = 'pageview' AND occurred_at >= now() - interval '5 minutes'
      `),
      db.execute<CountRow>(sql`
        SELECT COUNT(*)::int AS n
        FROM form_submissions
        WHERE is_spam = false AND created_at >= ${since}
      `),
      db.execute<TopSourceRow>(sql`
        SELECT source
        FROM site_events
        WHERE event_type = 'pageview' AND occurred_at >= ${since} AND source IS NOT NULL
        GROUP BY source
        ORDER BY COUNT(*) DESC
        LIMIT 1
      `),
      db.execute<TemplateRow>(sql`
        SELECT
          e.template_id,
          t.title,
          COUNT(*)::int AS views,
          COUNT(DISTINCT e.visitor_hash)::int AS visitors,
          COUNT(*) FILTER (WHERE e.device = 'mobile')::int AS mobile_views,
          COUNT(*) FILTER (WHERE e.device = 'tablet')::int AS tablet_views,
          COUNT(*) FILTER (WHERE e.device = 'desktop')::int AS desktop_views
        FROM site_events e
        LEFT JOIN templates t ON t.id = e.template_id
        WHERE e.event_type = 'pageview' AND e.occurred_at >= ${since}
        GROUP BY e.template_id, t.title
        ORDER BY views DESC
      `),
      db.execute<SiteRow>(sql`
        SELECT
          e.site_id,
          MAX(e.host) AS host,
          u.email,
          MAX(t.title) AS template_title,
          COUNT(DISTINCT e.visitor_hash) FILTER (WHERE e.occurred_at >= now() - interval '5 minutes')::int AS live,
          COUNT(*)::int AS views,
          COUNT(DISTINCT e.visitor_hash)::int AS visitors,
          COUNT(*) FILTER (WHERE e.device = 'mobile')::int AS mobile_views,
          MAX(e.occurred_at) AS last_view
        FROM site_events e
        LEFT JOIN user_sites s ON s.id = e.site_id
        LEFT JOIN users u ON u.id = s.user_id
        LEFT JOIN templates t ON t.id = e.template_id
        WHERE e.event_type = 'pageview' AND e.occurred_at >= ${since}
        GROUP BY e.site_id, u.email
        ORDER BY views DESC
      `),
      db.execute<SiteSourceRow>(sql`
        SELECT DISTINCT ON (site_id) site_id, source
        FROM (
          SELECT site_id, source, COUNT(*) AS cnt
          FROM site_events
          WHERE event_type = 'pageview' AND occurred_at >= ${since} AND source IS NOT NULL
          GROUP BY site_id, source
        ) x
        ORDER BY site_id, cnt DESC
      `),
      db.execute<SiteSubmissionRow>(sql`
        SELECT user_site_id AS site_id, COUNT(*)::int AS n
        FROM form_submissions
        WHERE is_spam = false AND created_at >= ${since}
        GROUP BY user_site_id
      `),
      db.execute<{ avg_seconds: number | null }>(sql`
        SELECT AVG((meta->>'seconds')::numeric)::float AS avg_seconds
        FROM site_events
        WHERE event_type = 'duration' AND occurred_at >= ${since}
      `),
      db.execute<AvgDurationRow>(sql`
        SELECT template_id, AVG((meta->>'seconds')::numeric)::float AS avg_seconds
        FROM site_events
        WHERE event_type = 'duration' AND occurred_at >= ${since}
        GROUP BY template_id
      `),
    ])

  const totals = totalsRows[0] ?? { views: 0, visitors: 0, mobile_views: 0 }
  const liveTotal = liveTotalRows[0]?.n ?? 0
  const submissionsTotal = submissionRows[0]?.n ?? 0
  const topSource = topSourceRows[0]?.source ?? null

  const avgDuration = avgDurationRows[0]?.avg_seconds ?? null
  const durationByTemplate = new Map(templateDurationRows.map(r => [r.template_id, r.avg_seconds]))

  const sourceBySite = new Map(siteSourceRows.map(r => [r.site_id, r.source]))
  const submissionsBySite = new Map(siteSubmissionRows.map(r => [r.site_id, r.n]))

  const tableRows: SiteTableRow[] = siteRows.map(r => ({
    siteId: r.site_id,
    host: r.host,
    email: r.email,
    template: r.template_title ?? 'Gelöschtes Template',
    live: r.live,
    views: r.views,
    visitors: r.visitors,
    submissions: submissionsBySite.get(r.site_id) ?? 0,
    mobilePct: pct(r.mobile_views, r.views),
    source: sourceLabel(sourceBySite.get(r.site_id) ?? null),
    lastView: new Date(r.last_view).toISOString(),
  }))

  return (
    <div style={{ maxWidth: 1180 }}>
      <AutoRefresh />
      <div className="mb-6">
        <Link href="/admin" className="flex items-center gap-2 text-sm mb-5" style={{ color: '#94A3B8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Zurück zum Dashboard
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Analytics</h1>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
              Seitenaufrufe aller veröffentlichten Webseiten
            </p>
          </div>
          <RangePills current={range} basePath="/admin/analytics" />
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <StatTile label="Jetzt online" value={fmtNum(liveTotal)} sub="letzte 5 Minuten"
          color={liveTotal > 0 ? '#15803D' : '#94A3B8'} />
        <StatTile label="Aufrufe" value={fmtNum(totals.views)} sub={`letzte ${range} Tage`} color="#1D4ED8" />
        <StatTile label="Besucher" value={fmtNum(totals.visitors)} sub={`letzte ${range} Tage`} />
        <StatTile label="Formulare" value={fmtNum(submissionsTotal)} sub={`letzte ${range} Tage`} />
        <StatTile label="Ø Verweildauer" value={fmtDuration(avgDuration)} sub="pro Besuch" />
        <StatTile label="Mobile-Anteil" value={`${pct(totals.mobile_views, totals.views)} %`} sub="der Aufrufe" />
        <StatTile label="Top-Quelle" value={topSource ? sourceLabel(topSource) : '—'} sub="meiste Aufrufe" />
      </div>

      {/* Templates kompakt */}
      {templateRows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {templateRows.map(tpl => {
            const mobilePct = pct(tpl.mobile_views, tpl.views)
            const tabletPct = pct(tpl.tablet_views, tpl.views)
            const desktopPct = pct(tpl.desktop_views, tpl.views)
            return (
              <Link key={tpl.template_id} href={`/admin/analytics/template/${tpl.template_id}?range=${range}`}
                className="rounded-[20px] p-5 bg-white block transition-shadow hover:shadow-md" style={cardStyle}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {tpl.title ?? 'Gelöschtes Template'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-medium flex-shrink-0" style={{ color: '#94A3B8' }}>
                    Details
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </span>
                </div>
                <div className="flex items-baseline gap-5 flex-wrap mb-3">
                  <div className="flex flex-col">
                    <span className="text-xl font-bold tracking-tight" style={{ color: '#1D4ED8' }}>{fmtNum(tpl.views)}</span>
                    <span className="text-[10px]" style={{ color: '#94A3B8' }}>Aufrufe</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold tracking-tight text-gray-900">{fmtNum(tpl.visitors)}</span>
                    <span className="text-[10px]" style={{ color: '#94A3B8' }}>Besucher</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold tracking-tight text-gray-900">{perDay(tpl.views, range)}</span>
                    <span className="text-[10px]" style={{ color: '#94A3B8' }}>Ø/Tag</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold tracking-tight text-gray-900">
                      {fmtDuration(durationByTemplate.get(tpl.template_id) ?? null)}
                    </span>
                    <span className="text-[10px]" style={{ color: '#94A3B8' }}>Ø Verweildauer</span>
                  </div>
                </div>
                {/* Geräte-Split */}
                <div className="flex h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: '#F1F5F9' }}>
                  {mobilePct > 0 && <div style={{ width: `${mobilePct}%`, background: '#3B82F6' }} />}
                  {tabletPct > 0 && <div style={{ width: `${tabletPct}%`, background: '#A5B4FC' }} />}
                  {desktopPct > 0 && <div style={{ width: `${desktopPct}%`, background: '#CBD5E1' }} />}
                </div>
                <div className="flex items-center gap-3 text-[11px]" style={{ color: '#64748B' }}>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#3B82F6' }} />
                    Mobil {mobilePct} %
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#A5B4FC' }} />
                    Tablet {tabletPct} %
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: '#CBD5E1' }} />
                    Desktop {desktopPct} %
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Alle Seiten */}
      <SitesTable rows={tableRows} range={range} />
    </div>
  )
}
