'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

export type SiteTableRow = {
  siteId: string
  host: string
  email: string | null
  template: string
  live: number
  views: number
  visitors: number
  submissions: number
  mobilePct: number
  source: string
  lastView: string
}

type SortKey = 'host' | 'live' | 'views' | 'visitors' | 'submissions' | 'mobilePct' | 'lastView'

const COLUMNS: { key: SortKey | null; label: string; align: 'left' | 'right' }[] = [
  { key: 'host', label: 'Host', align: 'left' },
  { key: null, label: 'Besitzer', align: 'left' },
  { key: null, label: 'Template', align: 'left' },
  { key: 'live', label: 'Live', align: 'right' },
  { key: 'views', label: 'Aufrufe', align: 'right' },
  { key: 'visitors', label: 'Besucher', align: 'right' },
  { key: 'submissions', label: 'Formulare', align: 'right' },
  { key: 'mobilePct', label: 'Mobil', align: 'right' },
  { key: null, label: 'Quelle', align: 'left' },
  { key: 'lastView', label: 'Letzter Aufruf', align: 'right' },
]

function relTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diffMin < 1) return 'gerade eben'
  if (diffMin < 60) return `vor ${diffMin} Min.`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return h === 1 ? 'vor 1 Std.' : `vor ${h} Std.`
  const d = Math.floor(h / 24)
  if (d === 1) return 'gestern'
  return `vor ${d} Tagen`
}

const fmt = (n: number) => n.toLocaleString('de-DE')

export function SitesTable({ rows, range }: { rows: SiteTableRow[]; range: number }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'views', dir: 'desc' })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q
      ? rows.filter(r =>
          r.host.toLowerCase().includes(q) ||
          (r.email ?? '').toLowerCase().includes(q) ||
          r.template.toLowerCase().includes(q))
      : rows

    const dir = sort.dir === 'asc' ? 1 : -1
    return [...matched].sort((a, b) => {
      const va = a[sort.key]
      const vb = b[sort.key]
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * dir
      return ((va as number) - (vb as number)) * dir
    })
  }, [rows, query, sort])

  const toggleSort = (key: SortKey) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))

  return (
    <div className="rounded-[20px] bg-white overflow-hidden"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>
      {/* Suche */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-4 flex-wrap">
        <span className="text-sm font-semibold text-gray-900">
          Alle Seiten <span className="font-normal" style={{ color: '#94A3B8' }}>· {fmt(filtered.length)}</span>
        </span>
        <label className="flex items-center gap-2.5 rounded-full px-4 py-2.5 flex-1 min-w-[220px] max-w-sm"
          style={{ background: '#F1F5F9' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" className="flex-shrink-0">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Host, E-Mail oder Template suchen …"
            className="bg-transparent outline-none text-sm w-full"
            style={{ color: '#111827' }}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Suche leeren"
              className="flex-shrink-0 rounded-full p-0.5" style={{ color: '#94A3B8' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 1020 }}>
          <thead>
            <tr className="text-[11px] uppercase tracking-wider select-none"
              style={{ background: '#F8FAFC', color: '#94A3B8' }}>
              {COLUMNS.map(col => (
                <th key={col.label}
                  className={`px-4 py-3 font-semibold whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.key ? 'cursor-pointer hover:text-gray-600' : ''}`}
                  onClick={col.key ? () => toggleSort(col.key!) : undefined}>
                  {col.label}
                  {col.key === sort.key && <span className="ml-1">{sort.dir === 'desc' ? '↓' : '↑'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#F8FAFC' }}>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-xs" style={{ color: '#94A3B8' }}>
                  {query ? <>Keine Treffer für „{query}“</> : 'Noch keine Aufrufe im Zeitraum'}
                </td>
              </tr>
            ) : filtered.map(r => (
              <tr key={r.siteId} className="hover:bg-[#FAFBFC]">
                <td className="px-4 py-3 max-w-[260px]">
                  <Link href={`/admin/analytics/site/${r.siteId}?range=${range}`}
                    className="font-medium text-gray-900 hover:underline block truncate">
                    {r.host}
                  </Link>
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <span className="text-xs block truncate" style={{ color: r.email ? '#6B7280' : '#CBD5E1' }}>
                    {r.email ?? 'Seite gelöscht'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-xs" style={{ color: '#6B7280' }}>{r.template}</span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {r.live > 0 ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: '#15803D' }}>
                      <span className="inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#22C55E' }} />
                      {fmt(r.live)}
                    </span>
                  ) : (
                    <span style={{ color: '#E2E8F0' }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(r.views)}</td>
                <td className="px-4 py-3 text-right" style={{ color: '#6B7280' }}>{fmt(r.visitors)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {r.submissions > 0
                    ? <span className="font-semibold" style={{ color: '#1D4ED8' }}>{fmt(r.submissions)}</span>
                    : <span style={{ color: '#E2E8F0' }}>—</span>}
                </td>
                <td className="px-4 py-3 text-right" style={{ color: '#6B7280' }}>{r.mobilePct} %</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-xs" style={{ color: '#6B7280' }}>{r.source}</span>
                </td>
                <td className="px-4 py-3 text-right text-xs whitespace-nowrap" style={{ color: '#94A3B8' }} suppressHydrationWarning>
                  {relTime(r.lastView)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
