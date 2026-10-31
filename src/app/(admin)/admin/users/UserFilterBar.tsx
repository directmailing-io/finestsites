'use client'

import { useEffect, useMemo, useState } from 'react'
import type { UserRow } from './AdminUsersTable'
import { PRESETS, activeCount, matches, sameFilters, type FilterGroup, type FilterState } from './user-filters'

/**
 * Suche, Szenarien, aktive Filter und Filterfenster der Nutzerliste.
 * Desktop: Filter klappen unter der Leiste auf. Handy: Blatt von unten mit „n Nutzer anzeigen“.
 * Gestaltung: weiß, Haarlinien, Typografie führt; Akzent nur Tinte (#111827).
 */
const INK = '#111827'
const LINE = '#ECEEF2'
const MUTED = '#8A94A6'

export type SortOption = { value: string; label: string }

export default function UserFilterBar({
  users, groups, filters, setFilters, search, setSearch, resultCount, sortValue, sortOptions, onSort,
}: {
  users: UserRow[]
  groups: FilterGroup[]
  filters: FilterState
  setFilters: (f: FilterState) => void
  search: string
  setSearch: (s: string) => void
  resultCount: number
  sortValue: string
  sortOptions: SortOption[]
  onSort: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const n = activeCount(filters)

  // Handy-Blatt: Seite dahinter nicht mitscrollen
  useEffect(() => {
    if (!open) return
    const mq = window.matchMedia('(max-width: 1023px)')
    if (!mq.matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Anzahl je Option unter allen ANDEREN aktiven Gruppen (+ Suche) – zeigt, was ein Tipp bewirkt
  const q = search.toLowerCase().trim()
  const searched = useMemo(
    () => (q ? users.filter(u => u.email.toLowerCase().includes(q) || (u.username ?? '').toLowerCase().includes(q)) : users),
    [users, q],
  )
  const counts = useMemo(() => {
    const out: Record<string, Record<string, number>> = {}
    for (const g of groups) {
      const base = searched.filter(u => matches(u, groups, filters, g.key))
      out[g.key] = Object.fromEntries(g.options.map(o => [o.value, base.filter(o.test).length]))
    }
    return out
  }, [searched, groups, filters])

  function toggle(groupKey: string, value: string) {
    const cur = filters[groupKey] ?? []
    const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value]
    const copy = { ...filters, [groupKey]: next }
    if (next.length === 0) delete copy[groupKey]
    setFilters(copy)
  }

  const activeChips = groups.flatMap(g =>
    (filters[g.key] ?? []).map(v => ({ g, v, label: g.options.find(o => o.value === v)?.label ?? v })),
  )

  const groupsBody = (
    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map(g => (
        <div key={g.key} className={g.key === 'vorlage' ? 'sm:col-span-2 xl:col-span-3' : undefined}>
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: MUTED }}>{g.label}</span>
            {(filters[g.key]?.length ?? 0) > 0 && (
              <button type="button" onClick={() => { const c = { ...filters }; delete c[g.key]; setFilters(c) }}
                className="text-[12px] font-medium" style={{ color: MUTED }}>
                Zurücksetzen
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {g.options.map(o => {
              const on = filters[g.key]?.includes(o.value) ?? false
              const c = counts[g.key]?.[o.value] ?? 0
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(g.key, o.value)}
                  className="fs-chip inline-flex h-9 items-center gap-2 rounded-full pl-3.5 pr-3 text-[13px] font-medium transition-all"
                  style={on
                    ? { background: INK, color: '#fff', border: `1px solid ${INK}` }
                    : { background: '#fff', color: c === 0 ? '#B6BDC9' : '#1F2937', border: `1px solid ${LINE}` }}
                >
                  {o.label}
                  <span className="tabular-nums text-[11px] font-semibold" style={{ color: on ? 'rgba(255,255,255,0.6)' : '#A3ACBA' }}>{c}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="mb-4">
      {/* ── Leiste: Suche · Filter · Sortierung ── */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search" inputMode="search" placeholder="Suchen …" value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-11 w-full rounded-full bg-white pl-10 pr-9 text-[14px] text-gray-900 outline-none transition-shadow focus:shadow-[0_0_0_4px_rgba(17,24,39,0.06)]"
            style={{ border: `1px solid ${LINE}` }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Suche leeren"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full hover:bg-gray-100"
              style={{ color: MUTED }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="inline-flex h-11 flex-shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors"
          style={n > 0 || open
            ? { background: INK, color: '#fff', border: `1px solid ${INK}` }
            : { background: '#fff', color: INK, border: `1px solid ${LINE}` }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M7 12h10M10 17h4" />
          </svg>
          Filter
          {n > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums" style={{ background: '#fff', color: INK }}>{n}</span>
          )}
        </button>

        <label className="relative hidden h-11 flex-shrink-0 items-center sm:flex">
          <span className="sr-only">Sortieren</span>
          <select
            value={sortValue}
            onChange={e => onSort(e.target.value)}
            className="h-11 appearance-none rounded-full bg-white pl-4 pr-9 text-[14px] font-medium text-gray-800 outline-none"
            style={{ border: `1px solid ${LINE}` }}
          >
            {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.5" className="pointer-events-none absolute right-3.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </label>
      </div>

      {/* ── Szenarien ── */}
      <div className="fs-scroll -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {PRESETS.map(p => {
          const on = sameFilters(filters, p.filters)
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setFilters(on ? {} : p.filters)}
              className="h-8 flex-shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition-colors"
              style={on
                ? { background: '#F3F4F6', color: INK, boxShadow: `inset 0 0 0 1.5px ${INK}` }
                : { background: '#F6F7F9', color: '#4B5563' }}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* ── Desktop: Filter klappen auf ── */}
      {open && (
        <div className="fs-panel mt-3 hidden rounded-[22px] bg-white p-6 lg:block"
          style={{ border: `1px solid ${LINE}`, boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.05)' }}>
          {groupsBody}
          <div className="mt-6 flex items-center justify-between border-t pt-4" style={{ borderColor: LINE }}>
            <span className="text-[13px]" style={{ color: MUTED }}>
              Innerhalb einer Gruppe: eins davon · zwischen Gruppen: alles zusammen
            </span>
            <div className="flex items-center gap-2">
              {n > 0 && (
                <button type="button" onClick={() => setFilters({})} className="h-9 rounded-full px-4 text-[13px] font-semibold" style={{ color: INK }}>
                  Alle zurücksetzen
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-full px-4 text-[13px] font-semibold text-white" style={{ background: INK }}>
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Handy: Blatt von unten ── */}
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Filter">
          <div className="fs-fade absolute inset-0" style={{ background: 'rgba(17,24,39,0.35)' }} onClick={() => setOpen(false)} />
          <div className="fs-sheet absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[28px] bg-white">
            <div className="flex justify-center pt-2.5"><span className="h-1 w-10 rounded-full" style={{ background: '#E5E7EB' }} /></div>
            <div className="flex items-center justify-between px-5 pb-3 pt-2">
              <span className="text-[17px] font-semibold text-gray-900">Filter</span>
              {n > 0 ? (
                <button type="button" onClick={() => setFilters({})} className="text-[14px] font-medium" style={{ color: MUTED }}>Alle zurücksetzen</button>
              ) : (
                <button type="button" onClick={() => setOpen(false)} className="text-[14px] font-medium" style={{ color: MUTED }}>Schließen</button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
              <div className="mb-6">
                <span className="mb-2.5 block text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: MUTED }}>Sortieren</span>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map(o => (
                    <button key={o.value} type="button" onClick={() => onSort(o.value)}
                      className="h-9 rounded-full px-3.5 text-[13px] font-medium"
                      style={sortValue === o.value
                        ? { background: INK, color: '#fff', border: `1px solid ${INK}` }
                        : { background: '#fff', color: '#1F2937', border: `1px solid ${LINE}` }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {groupsBody}
            </div>
            <div className="border-t px-5 pt-3" style={{ borderColor: LINE, paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
              <button type="button" onClick={() => setOpen(false)}
                className="h-12 w-full rounded-full text-[15px] font-semibold text-white" style={{ background: INK }}>
                {resultCount === 1 ? '1 Nutzer anzeigen' : `${resultCount} Nutzer anzeigen`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Aktive Filter ── */}
      {activeChips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeChips.map(({ g, v, label }) => (
            <button
              key={`${g.key}.${v}`}
              type="button"
              onClick={() => toggle(g.key, v)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white pl-3 pr-2 text-[13px]"
              style={{ border: `1px solid ${LINE}`, color: '#1F2937' }}
              aria-label={`Filter ${g.label}: ${label} entfernen`}
            >
              <span style={{ color: MUTED }}>{g.label}:</span>
              <span className="font-semibold">{label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M16 8 8 16M8 8l8 8" /></svg>
            </button>
          ))}
          <button type="button" onClick={() => setFilters({})} className="h-8 px-2 text-[13px] font-semibold" style={{ color: INK }}>
            Zurücksetzen
          </button>
        </div>
      )}

      <style>{`
        .fs-scroll { scrollbar-width: none; } .fs-scroll::-webkit-scrollbar { display: none; }
        .fs-chip:active { transform: scale(0.97); }
        .fs-panel { animation: fs-panel-in .22s cubic-bezier(.2,.7,.2,1) both; }
        .fs-sheet { animation: fs-sheet-in .32s cubic-bezier(.2,.8,.2,1) both; box-shadow: 0 -10px 40px rgba(16,24,40,0.12); }
        .fs-fade { animation: fs-fade-in .2s ease both; }
        @keyframes fs-panel-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        @keyframes fs-sheet-in { from { transform: translateY(100%); } to { transform: none; } }
        @keyframes fs-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .fs-panel, .fs-sheet, .fs-fade { animation: none; } }
      `}</style>
    </div>
  )
}
