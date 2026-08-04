import Link from 'next/link'
import { sql, type SQL } from 'drizzle-orm'

// ─── Zeitraum ──────────────────────────────────────────────────────────────────

export const RANGES = [7, 30, 90] as const
export type Range = (typeof RANGES)[number]

export function parseRange(value: string | undefined): Range {
  const n = Number(value)
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30
}

/**
 * SQL-Fragment: Beginn des Zeitraums (Mitternacht Europe/Berlin, vor `days - 1`
 * Tagen) — so decken 7 Tage genau die letzten 7 Kalendertage inkl. heute ab und
 * KPIs + Tagesbalken zählen identisch.
 */
export function sinceSql(days: Range): SQL {
  return sql`(date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') - make_interval(days => ${days - 1})) AT TIME ZONE 'Europe/Berlin'`
}

// ─── Labels ────────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  google: 'Google',
  bing: 'Bing',
  linktree: 'Linktree',
  lnko: 'lnko.me',
  twitter: 'X (Twitter)',
  telegram: 'Telegram',
  direct: 'Direkt',
  other: 'Sonstige',
}

export function sourceLabel(source: string | null): string {
  if (!source) return 'Unbekannt'
  return SOURCE_LABELS[source] ?? source
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Mobil',
  tablet: 'Tablet',
  desktop: 'Desktop',
}

export function deviceLabel(device: string | null): string {
  if (!device) return 'Unbekannt'
  return DEVICE_LABELS[device] ?? device
}

const regionNames = new Intl.DisplayNames(['de'], { type: 'region' })

export function countryName(code: string | null): string {
  if (!code) return 'Unbekannt'
  try {
    return regionNames.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

// ─── Formatierung ──────────────────────────────────────────────────────────────

export function fmtNum(n: number): string {
  return n.toLocaleString('de-DE')
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

export function perDay(views: number, days: number): string {
  return (views / days).toLocaleString('de-DE', { maximumFractionDigits: 1 })
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

export const cardStyle = {
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  border: '1px solid #F1F5F9',
} as const

export function RangePills({ current, basePath }: { current: Range; basePath: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full p-1" style={{ background: '#F1F5F9' }}>
      {RANGES.map(r => (
        <Link
          key={r}
          href={`${basePath}?range=${r}`}
          className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
          style={
            current === r
              ? { background: '#FFFFFF', color: '#1a1a1a', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }
              : { color: '#64748B' }
          }>
          {r} Tage
        </Link>
      ))}
    </div>
  )
}

export function StatTile({ label, value, sub, color }: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-[20px] p-5 bg-white flex flex-col gap-1" style={cardStyle}>
      <span className="text-xs font-medium" style={{ color: '#64748B' }}>{label}</span>
      <span className="text-3xl font-bold tracking-tight truncate" style={{ color: color ?? '#111827' }}>{value}</span>
      {sub && <span className="text-[11px]" style={{ color: '#94A3B8' }}>{sub}</span>}
    </div>
  )
}

export function BreakdownCard({ title, entries, total }: {
  title: string
  entries: { label: string; count: number }[]
  total: number
}) {
  const max = Math.max(...entries.map(e => e.count), 1)
  return (
    <div className="rounded-[20px] p-5 bg-white" style={cardStyle}>
      <span className="text-sm font-semibold text-gray-900 block mb-4">{title}</span>
      {entries.length === 0 ? (
        <p className="text-xs" style={{ color: '#94A3B8' }}>Keine Daten im Zeitraum</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map(e => (
            <div key={e.label}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-xs font-medium truncate" style={{ color: '#374151' }}>{e.label}</span>
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#6B7280' }}>
                  {fmtNum(e.count)} · {pct(e.count, total)} %
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F8FAFC' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(e.count / max) * 100}%`, background: '#3B82F6' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
