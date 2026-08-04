import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import Link from 'next/link'
import {
  cardStyle, fmtNum, parseRange, pct, perDay, RangePills, relTime, sinceSql, sourceLabel, StatTile,
} from './shared'

export const dynamic = 'force-dynamic'

const MAX_SITE_ROWS = 15

type TotalsRow = {
  views: number
  visitors: number
  mobile_views: number
}

type SourceRow = {
  template_id: string
  source: string | null
  cnt: number
}

type TemplateRow = {
  template_id: string
  title: string | null
  views: number
  visitors: number
  mobile_views: number
}

type SiteRow = {
  site_id: string
  template_id: string
  host: string
  email: string | null
  views: number
  visitors: number
  last_view: Date
}

export default async function AnalyticsPage({ searchParams }: {
  searchParams: Promise<{ range?: string }>
}) {
  const range = parseRange((await searchParams).range)
  const since = sinceSql(range)

  const [totalsRows, templateRows, sourceRows, siteRows] = await Promise.all([
    db.execute<TotalsRow>(sql`
      SELECT
        COUNT(*)::int AS views,
        COUNT(DISTINCT visitor_hash)::int AS visitors,
        COUNT(*) FILTER (WHERE device = 'mobile')::int AS mobile_views
      FROM site_events
      WHERE event_type = 'pageview' AND occurred_at >= ${since}
    `),
    db.execute<TemplateRow>(sql`
      SELECT
        e.template_id,
        t.title,
        COUNT(*)::int AS views,
        COUNT(DISTINCT e.visitor_hash)::int AS visitors,
        COUNT(*) FILTER (WHERE e.device = 'mobile')::int AS mobile_views
      FROM site_events e
      LEFT JOIN templates t ON t.id = e.template_id
      WHERE e.event_type = 'pageview' AND e.occurred_at >= ${since}
      GROUP BY e.template_id, t.title
      ORDER BY views DESC
    `),
    db.execute<SourceRow>(sql`
      SELECT template_id, source, cnt FROM (
        SELECT
          template_id,
          source,
          COUNT(*)::int AS cnt,
          ROW_NUMBER() OVER (PARTITION BY template_id ORDER BY COUNT(*) DESC) AS rn
        FROM site_events
        WHERE event_type = 'pageview' AND occurred_at >= ${since} AND source IS NOT NULL
        GROUP BY template_id, source
      ) ranked
      WHERE rn <= 3
      ORDER BY cnt DESC
    `),
    db.execute<SiteRow>(sql`
      SELECT
        e.site_id,
        e.template_id,
        MAX(e.host) AS host,
        u.email,
        COUNT(*)::int AS views,
        COUNT(DISTINCT e.visitor_hash)::int AS visitors,
        MAX(e.occurred_at) AS last_view
      FROM site_events e
      LEFT JOIN user_sites s ON s.id = e.site_id
      LEFT JOIN users u ON u.id = s.user_id
      WHERE e.event_type = 'pageview' AND e.occurred_at >= ${since}
      GROUP BY e.site_id, e.template_id, u.email
      ORDER BY views DESC
    `),
  ])

  const totals = totalsRows[0] ?? { views: 0, visitors: 0, mobile_views: 0 }

  // Top-Quelle global (aus den Template-Top-Quellen aggregiert)
  const globalSources = new Map<string, number>()
  for (const r of sourceRows) {
    const key = r.source ?? ''
    globalSources.set(key, (globalSources.get(key) ?? 0) + r.cnt)
  }
  const topSource = [...globalSources.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const sourcesByTemplate = new Map<string, SourceRow[]>()
  for (const r of sourceRows) {
    const list = sourcesByTemplate.get(r.template_id) ?? []
    list.push(r)
    sourcesByTemplate.set(r.template_id, list)
  }

  const sitesByTemplate = new Map<string, SiteRow[]>()
  for (const r of siteRows) {
    const list = sitesByTemplate.get(r.template_id) ?? []
    list.push(r)
    sitesByTemplate.set(r.template_id, list)
  }

  return (
    <div style={{ maxWidth: 1100 }}>
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

      {totals.views === 0 ? (
        <div className="rounded-[20px] bg-white p-10 text-center" style={cardStyle}>
          <p className="text-sm font-medium text-gray-900">Noch keine Aufrufe erfasst</p>
          <p className="text-xs mt-1 max-w-md mx-auto leading-relaxed" style={{ color: '#94A3B8' }}>
            Die Erfassung läuft ab jetzt: Sobald Besucher eine veröffentlichte Seite aufrufen,
            erscheinen hier Aufrufe, Besucher und Quellen — aufgeschlüsselt nach Template und Seite.
          </p>
        </div>
      ) : (
        <>
          {/* Gesamtzahlen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatTile label="Aufrufe" value={fmtNum(totals.views)} sub={`letzte ${range} Tage`} color="#1D4ED8" />
            <StatTile label="Besucher" value={fmtNum(totals.visitors)} sub={`letzte ${range} Tage`} />
            <StatTile label="Mobile-Anteil" value={`${pct(totals.mobile_views, totals.views)} %`} sub="der Aufrufe" />
            <StatTile label="Top-Quelle" value={topSource ? sourceLabel(topSource) : '—'} sub="meiste Aufrufe" />
          </div>

          {/* Pro Template */}
          <div className="flex flex-col gap-6">
            {templateRows.map(tpl => {
              const sites = sitesByTemplate.get(tpl.template_id) ?? []
              const topSources = sourcesByTemplate.get(tpl.template_id) ?? []
              const hidden = Math.max(sites.length - MAX_SITE_ROWS, 0)

              return (
                <div key={tpl.template_id} className="rounded-[20px] bg-white overflow-hidden" style={cardStyle}>
                  {/* Template-Kopf */}
                  <div className="px-6 pt-5 pb-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <h2 className="text-base font-semibold text-gray-900">
                        {tpl.title ?? 'Gelöschtes Template'}
                      </h2>
                      {topSources.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {topSources.map(s => (
                            <span key={s.source ?? 'null'}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                              style={{ background: '#F1F5F9', color: '#475569' }}>
                              {sourceLabel(s.source)} · {fmtNum(s.cnt)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-baseline gap-6 mt-3 flex-wrap">
                      <div className="flex flex-col">
                        <span className="text-xl font-bold tracking-tight" style={{ color: '#1D4ED8' }}>{fmtNum(tpl.views)}</span>
                        <span className="text-[11px]" style={{ color: '#94A3B8' }}>Aufrufe</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xl font-bold tracking-tight text-gray-900">{fmtNum(tpl.visitors)}</span>
                        <span className="text-[11px]" style={{ color: '#94A3B8' }}>Besucher</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xl font-bold tracking-tight text-gray-900">{perDay(tpl.views, range)}</span>
                        <span className="text-[11px]" style={{ color: '#94A3B8' }}>Ø Aufrufe/Tag</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xl font-bold tracking-tight text-gray-900">{pct(tpl.mobile_views, tpl.views)} %</span>
                        <span className="text-[11px]" style={{ color: '#94A3B8' }}>Mobil</span>
                      </div>
                    </div>
                  </div>

                  {/* Site-Ranking */}
                  <div className="grid px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) 90px 90px 110px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', color: '#94A3B8' }}>
                    <span>Host</span>
                    <span>Besitzer</span>
                    <span className="text-right">Aufrufe</span>
                    <span className="text-right">Besucher</span>
                    <span className="text-right">Letzter Aufruf</span>
                  </div>
                  <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
                    {sites.slice(0, MAX_SITE_ROWS).map(site => (
                      <div key={site.site_id}
                        className="grid items-center px-6 py-3"
                        style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) 90px 90px 110px' }}>
                        <Link href={`/admin/analytics/site/${site.site_id}?range=${range}`}
                          className="text-sm font-medium text-gray-900 hover:underline truncate pr-3">
                          {site.host}
                        </Link>
                        <span className="text-xs truncate pr-3" style={{ color: site.email ? '#6B7280' : '#CBD5E1' }}>
                          {site.email ?? 'Seite gelöscht'}
                        </span>
                        <span className="text-sm font-semibold text-right text-gray-900">{fmtNum(site.views)}</span>
                        <span className="text-sm text-right" style={{ color: '#6B7280' }}>{fmtNum(site.visitors)}</span>
                        <span className="text-xs text-right" style={{ color: '#94A3B8' }}>
                          {relTime(new Date(site.last_view))}
                        </span>
                      </div>
                    ))}
                  </div>
                  {hidden > 0 && (
                    <p className="px-6 py-3 text-xs" style={{ color: '#94A3B8', borderTop: '1px solid #F1F5F9' }}>
                      + {fmtNum(hidden)} weitere
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
