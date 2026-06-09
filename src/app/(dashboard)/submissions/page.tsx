'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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

const AVATAR_PALETTE = [
  { bg: '#FFE5D9', fg: '#9A3412' },
  { bg: '#FFE4E6', fg: '#9F1239' },
  { bg: '#E0E7FF', fg: '#3730A3' },
  { bg: '#D1FAE5', fg: '#065F46' },
  { bg: '#FEF3C7', fg: '#854D0E' },
  { bg: '#DBEAFE', fg: '#1E3A8A' },
  { bg: '#F3E8FF', fg: '#6B21A8' },
  { bg: '#CFFAFE', fg: '#155E75' },
]

function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

function displayName(data: Record<string, string>): string {
  const candidates = ['name', 'Name', 'vorname', 'Vorname', 'firstname', 'fullname']
  for (const k of candidates) if (data[k]?.trim()) return data[k].trim()
  const email = data.email ?? data.Email ?? data.mail
  if (email?.trim()) return email.split('@')[0]
  for (const v of Object.values(data)) if (v?.trim()) return v.trim()
  return 'Anonym'
}

function initials(name: string): string {
  const parts = name.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function previewText(data: Record<string, string>): string {
  const skip = new Set(['name', 'Name', 'vorname', 'Vorname', 'firstname', 'fullname'])
  const vals = Object.entries(data)
    .filter(([k, v]) => !skip.has(k) && v?.trim())
    .map(([, v]) => v.trim())
  return vals.join(' · ')
}

function formLabel(name: string): string {
  if (!name) return ''
  return name.split(/[-_]+/).map(p => p[0]?.toUpperCase() + p.slice(1)).join(' ')
}

function smartTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yest.toDateString()
  if (sameDay) return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(d)
  if (isYesterday) return 'Gestern'
  const diffDays = (now.getTime() - d.getTime()) / 86400000
  if (diffDays < 7) return new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(d)
  if (now.getFullYear() === d.getFullYear()) return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(d)
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

function fullDate(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
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

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const c = avatarColor(name)
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-semibold"
      style={{
        width: size,
        height: size,
        background: c.bg,
        color: c.fg,
        fontSize: size * 0.36,
        letterSpacing: '-0.01em',
      }}>
      {initials(name)}
    </div>
  )
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function isLongValue(value: string): boolean {
  if (!value) return false
  if (value.includes('\n')) return true
  if (value.length > 60) return true
  return false
}

/**
 * Format raw field keys (laendervorwahl, kontakt_tel, score_aktiv) into
 * user-friendly German labels.
 */
function prettyKey(key: string): string {
  const SPECIAL: Record<string, string> = {
    'laendervorwahl': 'Ländervorwahl',
    'vorwahl': 'Vorwahl',
    'telefon': 'Telefon',
    'tel': 'Telefon',
    'kontakt_tel': 'Telefon',
    'kontakt_telefon': 'Telefon',
    'kontakt_telefonvorwahl': 'Vorwahl',
    'kontakt_name': 'Name',
    'kontakt_email': 'E-Mail',
    'email': 'E-Mail',
    'e_mail': 'E-Mail',
    'name': 'Name',
    'vorname': 'Vorname',
    'nachname': 'Nachname',
    'nachricht': 'Nachricht',
    'message': 'Nachricht',
    'kontaktweg': 'Bevorzugter Kontaktweg',
    'ziele': 'Ziele',
    'hintergrund': 'Hintergrund',
    'alter': 'Alter',
    'gewicht': 'Gewicht',
    'darmtyp': 'Darmtyp',
    'datenschutz': 'Datenschutz akzeptiert',
  }
  const lower = key.toLowerCase()
  if (SPECIAL[lower]) return SPECIAL[lower]
  // Generic fallback: snake_case → Title Case
  return key
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
    .join(' ')
}

/**
 * Pre-process a flat field map: merge known prefix+number pairs like
 * (vorwahl, telefon) into a single "Telefon" row with full international format.
 * Also: sort fields by importance (Name → E-Mail → Telefon → rest).
 */
function processSubmissionFields(data: Record<string, string>): Array<{ key: string; label: string; value: string }> {
  const map = { ...data }

  // Phone pairs to merge: [vorwahl_key, number_key, output_label]
  const PHONE_PAIRS: Array<[string, string, string]> = [
    ['laendervorwahl', 'telefon', 'Telefon'],
    ['kontakt_telefonvorwahl', 'kontakt_tel', 'Telefon'],
    ['vorwahl', 'telefonnummer', 'Telefon'],
    ['vorwahl', 'nummer', 'Telefon'],
  ]
  const merged: Array<{ key: string; label: string; value: string }> = []
  const usedKeys = new Set<string>()

  for (const [prefixKey, numberKey, label] of PHONE_PAIRS) {
    if (map[prefixKey] && map[numberKey]) {
      const prefix = map[prefixKey].trim()
      const number = map[numberKey].trim().replace(/^0+/, '') // strip leading zeros
      const combined = prefix
        ? `${prefix.startsWith('+') ? prefix : '+' + prefix} ${number}`
        : number
      merged.push({ key: numberKey, label, value: combined })
      usedKeys.add(prefixKey)
      usedKeys.add(numberKey)
      break // only merge once per submission
    }
  }

  // Other fields, in submission order
  const others: Array<{ key: string; label: string; value: string }> = []
  for (const [k, v] of Object.entries(map)) {
    if (usedKeys.has(k)) continue
    others.push({ key: k, label: prettyKey(k), value: v })
  }

  // Sort priority: name → email → phone → rest. Phone (merged) gets inserted near top.
  const PRIORITY = ['name', 'kontakt_name', 'email', 'e_mail', 'kontakt_email']
  others.sort((a, b) => {
    const pa = PRIORITY.indexOf(a.key.toLowerCase())
    const pb = PRIORITY.indexOf(b.key.toLowerCase())
    if (pa !== -1 && pb !== -1) return pa - pb
    if (pa !== -1) return -1
    if (pb !== -1) return 1
    return 0
  })

  // Find spot to insert phone: after name + email
  const result = [...others]
  if (merged.length > 0) {
    let insertAt = 0
    for (let i = 0; i < result.length; i++) {
      const k = result[i].key.toLowerCase()
      if (['name', 'kontakt_name', 'email', 'e_mail', 'kontakt_email'].includes(k)) {
        insertAt = i + 1
      } else {
        break
      }
    }
    result.splice(insertAt, 0, ...merged)
  }

  return result
}

function DetailModal({
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
  const name = displayName(submission.data)

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const entries = processSubmissionFields(submission.data)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* Modal — bottom sheet on mobile, centered card on desktop */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 pointer-events-none">
        <div
          className="relative bg-white pointer-events-auto flex flex-col w-full sm:w-auto sm:max-w-[720px]
            max-h-[92vh] sm:max-h-[88vh]
            rounded-t-3xl sm:rounded-3xl
            overflow-hidden"
          style={{
            boxShadow: '0 24px 64px rgba(15, 23, 42, 0.20), 0 0 0 1px rgba(0,0,0,0.04)',
            animation: 'modalIn 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
            minWidth: 'min(560px, 92vw)',
          }}>

          {/* Drag handle (mobile) */}
          <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: '#E5E7EB' }} />
          </div>

          {/* Header */}
          <div className="flex items-start gap-4 px-6 sm:px-7 pt-6 pb-5 flex-shrink-0">
            <Avatar name={name} size={56} />
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-xl font-bold text-gray-900 truncate tracking-tight">
                {name}
              </h2>
              <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
                {fullDate(submission.created_at)}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: '#F1F5F9', color: '#475569' }}>
                  {formLabel(submission.form_name)}
                </span>
                {submission.site && (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: '#F1F5F9', color: '#475569' }}>
                    {submission.site.title}
                  </span>
                )}
                {isArchived && (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: '#FEF3C7', color: '#92400E' }}>
                    Archiviert
                  </span>
                )}
              </div>
            </div>

            <button onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
              style={{ background: '#F3F4F6', color: '#374151' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#E5E7EB')}
              onMouseLeave={e => (e.currentTarget.style.background = '#F3F4F6')}
              aria-label="Schließen">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Fields grid (scrollable) */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-7 pb-4"
            style={{ borderTop: '1px solid #F1F5F9' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-5">
              {entries.map(({ key, label, value }) => {
                const isLong = isLongValue(value)
                return (
                  <div key={key}
                    className={`rounded-2xl px-4 py-3.5 flex flex-col gap-1.5 ${isLong ? 'sm:col-span-2' : ''}`}
                    style={{ background: '#F8FAFC' }}>
                    <label className="text-[10px] font-bold uppercase tracking-[0.08em]"
                      style={{ color: '#94A3B8' }}>
                      {label}
                    </label>
                    <p className="text-[14.5px] text-gray-900 break-words leading-relaxed"
                      style={{ whiteSpace: 'pre-wrap' }}>
                      {value || <span className="text-gray-300 italic font-normal">Leer</span>}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 px-6 sm:px-7 pt-4 pb-5 flex-shrink-0"
            style={{ borderTop: '1px solid #F1F5F9', background: '#FCFCFD' }}>
            <button
              onClick={() => { onDelete(submission.id); onClose() }}
              className="px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors"
              style={{ color: '#DC2626' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              Löschen
            </button>

            <div className="flex-1" />

            <button
              onClick={() => onMarkUnread(submission.id)}
              disabled={!submission.read_at}
              className="px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#F3F4F6', color: '#374151' }}
              onMouseEnter={e => { if (submission.read_at) (e.currentTarget as HTMLElement).style.background = '#E5E7EB' }}
              onMouseLeave={e => (e.currentTarget.style.background = '#F3F4F6')}>
              Als ungelesen
            </button>
            <button
              onClick={() => onArchive(submission.id, !isArchived)}
              className="px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors text-white"
              style={{ background: '#1a1a1a' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#333')}
              onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}>
              {isArchived ? 'Wiederherstellen' : 'Archivieren'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { transform: translateY(20px) scale(0.98); opacity: 0; }
          to   { transform: translateY(0)    scale(1);    opacity: 1; }
        }
        @media (max-width: 639px) {
          @keyframes modalIn {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
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
  const [showActions, setShowActions] = useState(false)

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

  const siteOptions = useMemo(() => [
    { id: 'all', title: 'Alle Seiten' },
    ...Object.values(
      submissions.reduce<Record<string, { id: string; title: string }>>((acc, s) => {
        if (!acc[s.user_site_id]) acc[s.user_site_id] = { id: s.user_site_id, title: s.site?.title ?? s.user_site_id }
        return acc
      }, {})
    ),
  ], [submissions])

  const unreadInList = submissions.filter(s => !s.read_at).length

  async function markRead(id: string, siteId: string) {
    await fetch(`/api/sites/${siteId}/submissions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    })
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, read_at: new Date().toISOString() } : s))
    if (selected?.id === id) setSelected(s => s ? { ...s, read_at: new Date().toISOString() } : s)
  }

  async function markUnread(id: string) {
    const s = submissions.find(s => s.id === id)
    if (!s) return
    await fetch(`/api/sites/${s.user_site_id}/submissions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: false }),
    })
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, read_at: null } : s))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, read_at: null } : prev)
  }

  async function archive(id: string, archived: boolean) {
    const s = submissions.find(s => s.id === id)
    if (!s) return
    await fetch(`/api/sites/${s.user_site_id}/submissions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
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
        if (next.has(s.id)) next.delete(s.id); else next.add(s.id)
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

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Anfragen
          </h1>
          <p className="text-base mt-1.5" style={{ color: '#94A3B8' }}>
            {loading
              ? '…'
              : total === 0
                ? 'Noch keine Anfragen'
                : `${total} ${total === 1 ? 'Anfrage' : 'Anfragen'}${unreadInList > 0 ? ` · ${unreadInList} ungelesen` : ''}`}
          </p>
        </div>

        {/* Action menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowActions(v => !v)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ background: showActions ? '#F3F4F6' : 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
            onMouseLeave={e => (e.currentTarget.style.background = showActions ? '#F3F4F6' : 'transparent')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
              <circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>
            </svg>
          </button>

          {showActions && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowActions(false)} />
              <div className="absolute right-0 top-12 z-40 w-52 rounded-2xl bg-white py-1.5"
                style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}>
                <button
                  onClick={() => { setBulkMode(m => !m); setBulkSelected(new Set()); setShowActions(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-gray-50">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 11 12 14 22 4"/>
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                  </svg>
                  {bulkMode ? 'Auswahl beenden' : 'Mehrere auswählen'}
                </button>
                <button
                  onClick={() => { csvExport(submissions); setShowActions(false) }}
                  disabled={submissions.length === 0}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                  Als CSV exportieren
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tabs (underline style) ────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-5"
        style={{ borderBottom: '1px solid #E5E7EB' }}>
        {([
          { key: 'all', label: 'Alle' },
          { key: 'unread', label: 'Ungelesen', badge: status === 'unread' ? 0 : unreadInList },
          { key: 'archived', label: 'Archiviert' },
        ] as { key: StatusFilter; label: string; badge?: number }[]).map(t => {
          const active = status === t.key
          return (
            <button key={t.key}
              onClick={() => { setStatus(t.key); setBulkSelected(new Set()) }}
              className="relative px-4 sm:px-5 py-3 text-sm font-semibold transition-colors flex items-center gap-2"
              style={{
                color: active ? '#1a1a1a' : '#6B7280',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#1a1a1a' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#6B7280' }}>
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="text-[10px] font-bold min-w-[18px] h-[18px] px-1.5 rounded-full flex items-center justify-center"
                  style={{ background: '#1a1a1a', color: 'white' }}>
                  {t.badge}
                </span>
              )}
              <span
                className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full transition-opacity"
                style={{
                  background: '#1a1a1a',
                  opacity: active ? 1 : 0,
                }}
              />
            </button>
          )
        })}
      </div>

      {/* ── Search + filters ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nach Name, E-Mail oder Inhalt suchen…"
            className="w-full pl-11 pr-10 py-3.5 text-[15px] rounded-2xl outline-none transition-all bg-white"
            style={{ border: '1.5px solid #E5E7EB' }}
            onFocus={e => (e.target.style.borderColor = '#1a1a1a')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100"
              style={{ color: '#9CA3AF' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {siteOptions.length > 2 && (
          <select
            value={siteFilter}
            onChange={e => setSiteFilter(e.target.value)}
            className="px-4 py-3.5 text-[15px] rounded-2xl outline-none appearance-none cursor-pointer bg-white"
            style={{ border: '1.5px solid #E5E7EB', paddingRight: '2.5rem',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239CA3AF' stroke-width='1.75' stroke-linecap='round' fill='none'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 1rem center',
            }}>
            {siteOptions.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── List ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-4 px-2 py-4 animate-pulse"
              style={{ borderBottom: '1px solid #F3F4F6' }}>
              <div className="w-12 h-12 rounded-full bg-gray-100 flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-3.5 rounded-full bg-gray-100 w-1/3" />
                <div className="h-3 rounded-full bg-gray-100 w-2/3" />
              </div>
              <div className="w-12 h-3 rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-3xl text-center"
          style={{ background: '#FAFAFA' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          {status === 'unread' ? (
            <>
              <h3 className="font-semibold text-gray-900 text-lg mb-1">Alles gelesen</h3>
              <p className="text-sm" style={{ color: '#94A3B8' }}>Keine ungelesenen Anfragen.</p>
            </>
          ) : status === 'archived' ? (
            <>
              <h3 className="font-semibold text-gray-900 text-lg mb-1">Keine archivierten Anfragen</h3>
              <p className="text-sm" style={{ color: '#94A3B8' }}>Archivierte Anfragen erscheinen hier.</p>
            </>
          ) : search ? (
            <>
              <h3 className="font-semibold text-gray-900 text-lg mb-1">Keine Ergebnisse</h3>
              <p className="text-sm" style={{ color: '#94A3B8' }}>
                Nichts gefunden zu &bdquo;{search}&ldquo;.
              </p>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">Noch keine Anfragen</h3>
              <p className="text-sm max-w-xs leading-relaxed mb-5" style={{ color: '#94A3B8' }}>
                Sobald jemand ein Formular auf deiner Webseite ausfüllt, erscheint die Anfrage hier.
              </p>
              <Link href="/sites"
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
                style={{ background: '#1a1a1a' }}>
                Meine Webseite
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col">
          {submissions.map((s, idx) => {
            const isUnread = !s.read_at
            const isBulkChecked = bulkSelected.has(s.id)
            const name = displayName(s.data)
            const preview = previewText(s.data)
            const isLast = idx === submissions.length - 1

            return (
              <div key={s.id}
                onClick={() => handleRowClick(s)}
                className="group flex items-center gap-3 sm:gap-4 px-2 sm:px-3 py-4 sm:py-5 cursor-pointer transition-colors select-none"
                style={{
                  borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                  background: 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                {/* Bulk checkbox or avatar */}
                {bulkMode ? (
                  <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center transition-all"
                      style={{
                        border: '2px solid',
                        borderColor: isBulkChecked ? '#1a1a1a' : '#D1D5DB',
                        background: isBulkChecked ? '#1a1a1a' : 'white',
                      }}>
                      {isBulkChecked && (
                        <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2.5">
                          <path d="M2 5l2 2 4-4"/>
                        </svg>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Avatar name={name} size={48} />
                    {isUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full"
                        style={{ background: '#1a1a1a', border: '2px solid white' }} />
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[15px] truncate"
                      style={{
                        color: isUnread ? '#0F172A' : '#111827',
                        fontWeight: isUnread ? 700 : 500,
                        letterSpacing: '-0.005em',
                      }}>
                      {name}
                    </p>
                    <span className="text-xs flex-shrink-0 whitespace-nowrap"
                      style={{ color: isUnread ? '#1a1a1a' : '#9CA3AF', fontWeight: isUnread ? 600 : 400 }}>
                      {smartTime(s.created_at)}
                    </span>
                  </div>

                  {preview && (
                    <p className="text-sm mt-1 truncate leading-snug"
                      style={{ color: isUnread ? '#374151' : '#6B7280' }}>
                      {preview}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-medium" style={{ color: '#94A3B8' }}>
                      {formLabel(s.form_name)}
                    </span>
                    {s.site && (
                      <>
                        <span className="text-[11px]" style={{ color: '#CBD5E1' }}>·</span>
                        <span className="text-[11px]" style={{ color: '#94A3B8' }}>{s.site.title}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Detail modal ─────────────────────────────────────────────── */}
      {selected && (
        <DetailModal
          submission={selected}
          onClose={() => setSelected(null)}
          onDelete={deleteOne}
          onMarkUnread={markUnread}
          onArchive={archive}
        />
      )}

      {/* ── Bulk action bar ──────────────────────────────────────────── */}
      {bulkMode && bulkSelected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl"
          style={{ background: '#1a1a1a', boxShadow: '0 8px 32px rgba(0,0,0,0.30)', color: 'white' }}>
          <span className="text-sm font-medium">{bulkSelected.size} ausgewählt</span>
          <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <button onClick={bulkMarkRead}
            className="text-sm font-medium transition-opacity hover:opacity-80">
            Als gelesen
          </button>
          <button onClick={bulkDelete}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
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
