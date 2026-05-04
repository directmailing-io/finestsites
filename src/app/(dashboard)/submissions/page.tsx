'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubmissionSite {
  title: string
  domain: string
}

interface Submission {
  id: string
  user_site_id: string
  form_name: string
  data: Record<string, string>
  read_at: string | null
  archived_at: string | null
  created_at: string
  site: SubmissionSite | null
}

type StatusFilter = 'all' | 'unread' | 'archived'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `vor ${m} Min.`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h} Std.`
  const d = Math.floor(h / 24)
  if (d < 7) return `vor ${d} ${d === 1 ? 'Tag' : 'Tagen'}`
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(new Date(iso))
}

function fullDate(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function submissionPreview(data: Record<string, string>): string {
  return Object.values(data).filter(Boolean).slice(0, 3).join(' · ') || '—'
}

function csvExport(submissions: Submission[]) {
  if (submissions.length === 0) return
  const allKeys = [...new Set(submissions.flatMap(s => Object.keys(s.data)))]
  const header = ['Datum', 'Website', 'Formular', ...allKeys].join(',')
  const rows = submissions.map(s => {
    const base = [fullDate(s.created_at), s.site?.title ?? s.user_site_id, s.form_name]
    const vals = allKeys.map(k => `"${(s.data[k] ?? '').replace(/"/g, '""')}"`)
    return [...base, ...vals].join(',')
  })
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `anfragen-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function DetailSheet({
  submission,
  onClose,
  onDelete,
  onMarkUnread,
  onArchive,
}: {
  submission: Submission
  onClose: () => void
  onDelete: (id: string) => void
  onMarkUnread: (id: string) => void
  onArchive: (id: string, archived: boolean) => void
}) {
  const isArchived = !!submission.archived_at

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Sheet — bottom sheet on mobile, right panel on desktop */}
      <div
        className="fixed z-50 flex flex-col bg-white overflow-y-auto
          inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl
          lg:inset-x-auto lg:right-0 lg:top-0 lg:bottom-0 lg:max-h-none lg:rounded-none w-full lg:w-[420px]"
        style={{
          boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
          animation: 'slideIn 0.25s ease-out',
        }}>

        {/* Drag handle — mobile only */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: '#E5E7EB' }} />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #F3F4F6' }}>
          <button onClick={onClose}
            className="p-1.5 rounded-[8px] transition-all"
            style={{ color: '#9CA3AF' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: '#E3D7FF', color: '#4A2D9A' }}>
                {submission.form_name}
              </span>
              {!submission.read_at && (
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#7C3AED' }} />
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
              {submission.site?.title ?? '—'} · {fullDate(submission.created_at)}
            </p>
          </div>
        </div>

        {/* Fields */}
        <div className="flex-1 px-5 py-5 flex flex-col gap-4">
          {Object.entries(submission.data).map(([key, value]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
                {key}
              </label>
              <p className="text-sm text-gray-800 break-words leading-relaxed"
                style={{ whiteSpace: 'pre-wrap' }}>
                {value || <span className="text-gray-300 italic">Leer</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-5 pb-6 pt-3 flex-shrink-0"
          style={{ borderTop: '1px solid #F3F4F6' }}>
          <div className="flex gap-2">
            <button
              onClick={() => onMarkUnread(submission.id)}
              disabled={!submission.read_at}
              className="flex-1 py-2 text-sm font-medium rounded-[10px] transition-all disabled:opacity-40"
              style={{ background: '#F3F4F6', color: '#374151' }}
              onMouseEnter={e => { if (submission.read_at) (e.currentTarget as HTMLElement).style.background = '#E5E7EB' }}
              onMouseLeave={e => (e.currentTarget.style.background = '#F3F4F6')}>
              Als ungelesen
            </button>
            <button
              onClick={() => onArchive(submission.id, !isArchived)}
              className="flex-1 py-2 text-sm font-medium rounded-[10px] transition-all"
              style={{ background: '#F3F4F6', color: '#374151' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#E5E7EB')}
              onMouseLeave={e => (e.currentTarget.style.background = '#F3F4F6')}>
              {isArchived ? 'Wiederherstellen' : 'Archivieren'}
            </button>
          </div>
          <button
            onClick={() => { onDelete(submission.id); onClose() }}
            className="w-full py-2 text-sm font-medium rounded-[10px] transition-all"
            style={{ background: '#FEF2F2', color: '#DC2626' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#FEE2E2')}
            onMouseLeave={e => (e.currentTarget.style.background = '#FEF2F2')}>
            Löschen
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @media (min-width: 1024px) {
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        }
      `}</style>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Submission | null>(null)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ status })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (siteFilter !== 'all') params.set('siteId', siteFilter)
    const res = await fetch(`/api/submissions?${params}`)
    const data = await res.json()
    setSubmissions(data.submissions ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [status, debouncedSearch, siteFilter])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  // Unique sites from loaded submissions for filter dropdown
  const siteOptions = [
    { id: 'all', title: 'Alle Seiten' },
    ...Object.values(
      submissions.reduce<Record<string, { id: string; title: string }>>((acc, s) => {
        if (!acc[s.user_site_id]) acc[s.user_site_id] = { id: s.user_site_id, title: s.site?.title ?? s.user_site_id }
        return acc
      }, {})
    ),
  ]

  async function markRead(id: string, siteId: string) {
    await fetch(`/api/sites/${siteId}/submissions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    })
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, read_at: new Date().toISOString() } : s))
    if (selected?.id === id) setSelected(s => s ? { ...s, read_at: new Date().toISOString() } : s)
  }

  async function markUnread(id: string) {
    const s = submissions.find(s => s.id === id)
    if (!s) return
    await fetch(`/api/sites/${s.user_site_id}/submissions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: false }),
    })
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, read_at: null } : s))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, read_at: null } : prev)
  }

  async function archive(id: string, archived: boolean) {
    const s = submissions.find(s => s.id === id)
    if (!s) return
    await fetch(`/api/sites/${s.user_site_id}/submissions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    })
    if (status !== 'archived' && archived) {
      setSubmissions(prev => prev.filter(s => s.id !== id))
    } else if (status === 'archived' && !archived) {
      setSubmissions(prev => prev.filter(s => s.id !== id))
    } else {
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, archived_at: archived ? new Date().toISOString() : null } : s))
    }
    if (selected?.id === id) setSelected(null)
  }

  async function deleteOne(id: string) {
    const s = submissions.find(s => s.id === id)
    if (!s) return
    await fetch(`/api/sites/${s.user_site_id}/submissions/${id}`, { method: 'DELETE' })
    setSubmissions(prev => prev.filter(s => s.id !== id))
    setTotal(t => Math.max(0, t - 1))
    setSelected(null)
  }

  function handleRowClick(s: Submission) {
    if (bulkMode) {
      setBulkSelected(prev => {
        const next = new Set(prev)
        if (next.has(s.id)) next.delete(s.id)
        else next.add(s.id)
        return next
      })
    } else {
      setSelected(s)
      if (!s.read_at) markRead(s.id, s.user_site_id)
    }
  }

  async function bulkMarkRead() {
    await Promise.all([...bulkSelected].map(id => {
      const s = submissions.find(s => s.id === id)
      if (s) return fetch(`/api/sites/${s.user_site_id}/submissions/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      })
    }))
    setSubmissions(prev => prev.map(s => bulkSelected.has(s.id) ? { ...s, read_at: new Date().toISOString() } : s))
    setBulkSelected(new Set())
    setBulkMode(false)
  }

  async function bulkDelete() {
    if (!confirm(`${bulkSelected.size} Anfragen löschen?`)) return
    await Promise.all([...bulkSelected].map(id => {
      const s = submissions.find(s => s.id === id)
      if (s) return fetch(`/api/sites/${s.user_site_id}/submissions/${id}`, { method: 'DELETE' })
    }))
    setSubmissions(prev => prev.filter(s => !bulkSelected.has(s.id)))
    setTotal(t => Math.max(0, t - bulkSelected.size))
    setBulkSelected(new Set())
    setBulkMode(false)
  }

  const unreadCount = submissions.filter(s => !s.read_at).length

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Anfragen</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            {loading ? '…' : `${total} Anfrage${total !== 1 ? 'n' : ''} gesamt`}
            {unreadCount > 0 && ` · ${unreadCount} ungelesen`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { setBulkMode(m => !m); setBulkSelected(new Set()) }}
            className="px-3 sm:px-4 py-2 text-sm font-medium rounded-[12px] transition-all"
            style={{
              background: bulkMode ? '#1a1a1a' : '#F3F4F6',
              color: bulkMode ? 'white' : '#374151',
            }}>
            {bulkMode ? 'Abbrechen' : 'Auswählen'}
          </button>
          <button
            onClick={() => csvExport(submissions)}
            disabled={submissions.length === 0}
            className="px-3 sm:px-4 py-2 text-sm font-medium rounded-[12px] flex items-center gap-1.5 transition-all disabled:opacity-40"
            style={{ background: '#F3F4F6', color: '#374151' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-[14px] w-fit"
        style={{ background: '#F3F4F6' }}>
        {([
          { key: 'all', label: 'Alle' },
          { key: 'unread', label: 'Ungelesen' },
          { key: 'archived', label: 'Archiviert' },
        ] as { key: StatusFilter; label: string }[]).map(t => (
          <button key={t.key} onClick={() => { setStatus(t.key); setBulkSelected(new Set()) }}
            className="px-4 py-1.5 text-sm font-medium rounded-[10px] transition-all"
            style={{
              background: status === t.key ? '#FFFFFF' : 'transparent',
              color: status === t.key ? '#1a1a1a' : '#6B7280',
              boxShadow: status === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Anfragen durchsuchen…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-[12px] outline-none transition-all"
            style={{ border: '1.5px solid #E5E7EB', background: 'white' }}
            onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded"
              style={{ color: '#9CA3AF' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {siteOptions.length > 2 && (
          <select
            value={siteFilter}
            onChange={e => setSiteFilter(e.target.value)}
            className="px-3 py-2.5 text-sm rounded-[12px] outline-none appearance-none cursor-pointer"
            style={{ border: '1.5px solid #E5E7EB', background: 'white', paddingRight: '2rem' }}>
            {siteOptions.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[72px] rounded-[16px] animate-pulse"
              style={{ background: '#F3F4F6' }} />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-[24px] text-center"
          style={{ background: '#F8FAFC', border: '1px solid #E5E7EB' }}>
          <div className="w-14 h-14 rounded-[20px] flex items-center justify-center mb-4"
            style={{ background: 'white', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
          </div>
          {status === 'unread' ? (
            <>
              <h3 className="font-semibold text-gray-700 mb-1">Alles gelesen</h3>
              <p className="text-sm" style={{ color: '#94A3B8' }}>Keine ungelesenen Anfragen.</p>
            </>
          ) : status === 'archived' ? (
            <>
              <h3 className="font-semibold text-gray-700 mb-1">Keine archivierten Anfragen</h3>
              <p className="text-sm" style={{ color: '#94A3B8' }}>Archivierte Anfragen erscheinen hier.</p>
            </>
          ) : search ? (
            <>
              <h3 className="font-semibold text-gray-700 mb-1">Keine Ergebnisse für &bdquo;{search}&ldquo;</h3>
              <p className="text-sm" style={{ color: '#94A3B8' }}>Versuche einen anderen Suchbegriff.</p>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-gray-700 mb-2">Noch keine Anfragen</h3>
              <p className="text-sm max-w-xs leading-relaxed" style={{ color: '#94A3B8' }}>
                Sobald ein Besucher ein Formular auf deiner Website ausfüllt, erscheint es hier.
              </p>
              <Link href="/sites"
                className="mt-5 px-5 py-2.5 text-sm font-semibold text-white rounded-[12px]"
                style={{ background: '#1a1a1a' }}>
                Meine Seiten
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {submissions.map(s => {
            const isUnread = !s.read_at
            const isSelected = selected?.id === s.id
            const isBulkChecked = bulkSelected.has(s.id)

            return (
              <div key={s.id}
                onClick={() => handleRowClick(s)}
                className="flex items-center gap-4 px-5 py-4 rounded-[16px] cursor-pointer transition-all select-none"
                style={{
                  background: isSelected ? '#F5F5F5' : 'white',
                  boxShadow: isSelected ? '0 0 0 2px #D1D5DB' : '0 2px 8px rgba(0,0,0,0.04)',
                  border: `1px solid ${isSelected ? '#D1D5DB' : '#F1F5F9'}`,
                }}>

                {/* Bulk checkbox or unread dot */}
                {bulkMode ? (
                  <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all"
                    style={{
                      border: '2px solid',
                      borderColor: isBulkChecked ? '#1a1a1a' : '#D1D5DB',
                      background: isBulkChecked ? '#1a1a1a' : 'white',
                    }}>
                    {isBulkChecked && (
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2">
                        <path d="M2 5l2 2 4-4"/>
                      </svg>
                    )}
                  </div>
                ) : (
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: isUnread ? '#1a1a1a' : '#E5E7EB' }} />
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: '#E3D7FF', color: '#4A2D9A' }}>
                      {s.form_name}
                    </span>
                    {s.site && (
                      <span className="text-xs text-gray-400 truncate">{s.site.title}</span>
                    )}
                  </div>
                  <p className="text-sm truncate" style={{ color: isUnread ? '#111827' : '#6B7280', fontWeight: isUnread ? '500' : '400' }}>
                    {submissionPreview(s.data)}
                  </p>
                </div>

                {/* Time */}
                <span className="text-xs flex-shrink-0" style={{ color: '#9CA3AF' }}>
                  {timeAgo(s.created_at)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail sheet */}
      {selected && (
        <DetailSheet
          submission={selected}
          onClose={() => setSelected(null)}
          onDelete={deleteOne}
          onMarkUnread={markUnread}
          onArchive={archive}
        />
      )}

      {/* Bulk action bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-[20px]"
          style={{ background: '#1a1a1a', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', color: 'white' }}>
          <span className="text-sm font-medium">{bulkSelected.size} ausgewählt</span>
          <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <button onClick={bulkMarkRead}
            className="text-sm font-medium transition-all"
            style={{ color: 'rgba(255,255,255,0.8)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}>
            Als gelesen
          </button>
          <button onClick={bulkDelete}
            className="text-sm font-medium px-3 py-1 rounded-[8px] transition-all"
            style={{ background: '#DC2626', color: 'white' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#B91C1C')}
            onMouseLeave={e => (e.currentTarget.style.background = '#DC2626')}>
            Löschen
          </button>
        </div>
      )}
    </div>
  )
}
