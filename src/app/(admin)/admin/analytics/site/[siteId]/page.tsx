import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  BreakdownCard, cardStyle, countryName, deviceLabel, fmtNum, parseRange, pct, perDay,
  RangePills, sinceSql, sourceLabel, StatTile,
} from '../../shared'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SiteInfoRow = {
  email: string | null
  template_title: string | null
}

type LatestEventRow = {
  host: string
  template_title: string | null
}

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

/** Letzte `days` Kalendertage (Europe/Berlin) als YYYY-MM-DD, aufsteigend. */
function dayKeys(days: number): string[] {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
  const base = new Date(`${today}T00:00:00Z`).getTime()
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    keys.push(new Date(base - i * 86_400_000).toISOString().slice(0, 10))
  }
  return keys
}

function dayLabel(key: string): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

export default async function SiteAnalyticsPage({ params, searchParams }: {
  params: Promise<{ siteId: string }>
  searchParams: Promise<{ range?: string }>
}) {
  const { siteId } = await params
  if (!UUID_RE.test(siteId)) notFound()

  const range = parseRange((await searchParams).range)
  const since = sinceSql(range)

  const breakdown = (column: 'source' | 'device' | 'browser' | 'country' | 'path', limit: number) =>
    db.execute<BreakdownRow>(sql`
      SELECT ${sql.raw(column)} AS key, COUNT(*)::int AS cnt
      FROM site_events
      WHERE event_type = 'pageview' AND site_id = ${siteId} AND occurred_at >= ${since}
      GROUP BY 1
      ORDER BY cnt DESC
      LIMIT ${limit}
    `)

  const [siteInfoRows, latestEventRows, totalsRows, dayRows, sources, devices, browsers, countries, paths] =
    await Promise.all([
      db.execute<SiteInfoRow>(sql`
        SELECT u.email, t.title AS template_title
        FROM user_sites s
        LEFT JOIN users u ON u.id = s.user_id
        LEFT JOIN templates t ON t.id = s.template_id
        WHERE s.id = ${siteId}
      `),
      db.execute<LatestEventRow>(sql`
        SELECT e.host, t.title AS template_title
        FROM site_events e
        LEFT JOIN templates t ON t.id = e.template_id
        WHERE e.site_id = ${siteId} AND e.event_type = 'pageview'
        ORDER BY e.occurred_at DESC
        LIMIT 1
      `),
      db.execute<TotalsRow>(sql`
        SELECT
          COUNT(*)::int AS views,
          COUNT(DISTINCT visitor_hash)::int AS visitors,
          COUNT(*) FILTER (WHERE device = 'mobile')::int AS mobile_views
        FROM site_events
        WHERE event_type = 'pageview' AND site_id = ${siteId} AND occurred_at >= ${since}
      `),
      db.execute<DayRow>(sql`
        SELECT
          to_char((occurred_at AT TIME ZONE 'Europe/Berlin')::date, 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS views
        FROM site_events
        WHERE event_type = 'pageview' AND site_id = ${siteId} AND occurred_at >= ${since}
        GROUP BY 1
        ORDER BY 1
      `),
      breakdown('source', 13),
      breakdown('device', 4),
      breakdown('browser', 8),
      breakdown('country', 10),
      breakdown('path', 10),
    ])

  const siteInfo = siteInfoRows[0]
  const latestEvent = latestEventRows[0]
  if (!siteInfo && !latestEvent) notFound()

  const totals = totalsRows[0] ?? { views: 0, visitors: 0, mobile_views: 0 }
  const host = latestEvent?.host ?? 'Unbekannter Host'
  const templateTitle = siteInfo?.template_title ?? latestEvent?.template_title ?? 'Unbekanntes Template'

  // Tagesreihe auffüllen (Tage ohne Events = 0)
  const viewsByDay = new Map(dayRows.map(r => [r.day, r.views]))
  const series = dayKeys(range).map(key => ({ key, views: viewsByDay.get(key) ?? 0 }))
  const maxDay = Math.max(...series.map(s => s.views), 1)

  const toEntries = (rows: BreakdownRow[], label: (key: string | null) => string) =>
    rows.map(r => ({ label: label(r.key), count: r.cnt }))

  return (
    <div style={{ maxWidth: 1100 }}>
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
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{host}</h1>
            <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
              {templateTitle}
              {siteInfo?.email ? <> · {siteInfo.email}</> : <> · Seite gelöscht</>}
            </p>
          </div>
          <RangePills current={range} basePath={`/admin/analytics/site/${siteId}`} />
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Aufrufe" value={fmtNum(totals.views)} sub={`letzte ${range} Tage`} color="#1D4ED8" />
        <StatTile label="Besucher" value={fmtNum(totals.visitors)} sub={`letzte ${range} Tage`} />
        <StatTile label="Ø Aufrufe/Tag" value={perDay(totals.views, range)} sub="im Zeitraum" />
        <StatTile label="Mobile-Anteil" value={`${pct(totals.mobile_views, totals.views)} %`} sub="der Aufrufe" />
      </div>

      {/* Tagesverlauf */}
      <div className="rounded-[20px] p-5 bg-white mb-6" style={cardStyle}>
        <span className="text-sm font-semibold text-gray-900 block mb-4">Aufrufe pro Tag</span>
        {totals.views === 0 ? (
          <p className="text-xs" style={{ color: '#94A3B8' }}>Keine Aufrufe im Zeitraum</p>
        ) : (
          <>
            <div className="flex items-end gap-px h-40">
              {series.map(s => (
                <div key={s.key}
                  className="flex-1 flex flex-col justify-end h-full"
                  title={`${dayLabel(s.key)}: ${fmtNum(s.views)} ${s.views === 1 ? 'Aufruf' : 'Aufrufe'}`}>
                  <div
                    className="w-full rounded-t-[3px]"
                    style={{
                      height: s.views > 0 ? `${Math.max((s.views / maxDay) * 100, 3)}%` : 2,
                      background: s.views > 0 ? '#3B82F6' : '#F1F5F9',
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[11px]" style={{ color: '#94A3B8' }}>{dayLabel(series[0].key)}</span>
              <span className="text-[11px]" style={{ color: '#94A3B8' }}>{dayLabel(series[series.length - 1].key)}</span>
            </div>
          </>
        )}
      </div>

      {/* Aufschlüsselungen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BreakdownCard title="Quellen" total={totals.views} entries={toEntries(sources, sourceLabel)} />
        <BreakdownCard title="Geräte" total={totals.views} entries={toEntries(devices, deviceLabel)} />
        <BreakdownCard title="Browser" total={totals.views} entries={toEntries(browsers, k => k ?? 'Unbekannt')} />
        <BreakdownCard title="Länder" total={totals.views} entries={toEntries(countries, countryName)} />
        <BreakdownCard title="Seiten" total={totals.views} entries={toEntries(paths, k => k ?? '/')} />
      </div>
    </div>
  )
}
