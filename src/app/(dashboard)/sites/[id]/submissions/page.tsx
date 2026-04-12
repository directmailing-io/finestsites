'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

interface Submission {
  id: string
  form_name: string
  data: Record<string, string>
  ip_address: string | null
  read_at: string | null
  created_at: string
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export default function SubmissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Submission | null>(null)
  const [activeForm, setActiveForm] = useState<string>('all')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/sites/${id}/submissions`)
      .then(r => r.json())
      .then(data => { setSubmissions(Array.isArray(data) ? data : []); setLoading(false) })
  }, [id])

  const forms = ['all', ...new Set(submissions.map(s => s.form_name))]
  const filtered = activeForm === 'all' ? submissions : submissions.filter(s => s.form_name === activeForm)
  const unread = submissions.filter(s => !s.read_at).length

  async function deleteSubmission(submissionId: string) {
    setDeleting(submissionId)
    await fetch(`/api/sites/${id}/submissions?submissionId=${submissionId}`, { method: 'DELETE' })
    setSubmissions(prev => prev.filter(s => s.id !== submissionId))
    if (selected?.id === submissionId) setSelected(null)
    setDeleting(null)
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.push(`/sites/${id}/edit`)}
          className="flex items-center gap-2 text-sm mb-4"
          style={{ color: 'var(--muted-foreground)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Zurück zum Editor
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
              Formular-Eingaben
              {unread > 0 && (
                <span className="text-sm px-2.5 py-0.5 rounded-full font-semibold"
                  style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                  {unread} neu
                </span>
              )}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {submissions.length} Eingang{submissions.length !== 1 ? 'änge' : ''} gesamt
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const csv = ['Datum,Formular,' + Object.keys(submissions[0]?.data ?? {}).join(',')]
                filtered.forEach(s => {
                  const row = [formatDate(s.created_at), s.form_name, ...Object.values(s.data).map(v => `"${v}"`)]
                  csv.push(row.join(','))
                })
                const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `submissions-${new Date().toISOString().slice(0,10)}.csv`
                a.click()
              }}
              disabled={submissions.length === 0}
              className="px-4 py-2 text-sm font-medium rounded-[14px] flex items-center gap-2 transition-all disabled:opacity-40"
              style={{ background: '#F3F4F6', color: '#374151' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              CSV Export
            </button>
          </div>
        </div>
      </div>

      {/* Form filter tabs */}
      {forms.length > 2 && (
        <div className="flex gap-2 mb-4">
          {forms.map(f => (
            <button key={f} onClick={() => setActiveForm(f)}
              className="text-sm px-3 py-1.5 rounded-[10px] font-medium transition-all"
              style={{
                background: activeForm === f ? '#1a1a1a' : '#F3F4F6',
                color: activeForm === f ? 'white' : '#6B7280',
              }}>
              {f === 'all' ? 'Alle' : f}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-[24px] bg-white"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid var(--border)' }}>
          <div className="w-14 h-14 rounded-[18px] flex items-center justify-center mb-4"
            style={{ background: '#F3F4F6' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <h3 className="font-semibold text-gray-700 mb-1">Noch keine Eingaben</h3>
          <p className="text-sm max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
            Sobald jemand ein Formular auf deiner Website ausfüllt, erscheint es hier.
          </p>
          <div className="mt-4 px-4 py-3 rounded-[14px] text-xs text-left"
            style={{ background: '#F8F9FF', border: '1px solid #E0E7FF', color: '#4338CA', maxWidth: '360px' }}>
            <p className="font-semibold mb-1">Formular ins Template einbauen:</p>
            <code className="text-xs leading-relaxed whitespace-pre-wrap">{`<form action="/.finestsites/forms/kontakt" method="POST">
  <input name="email" type="email" required>
  <textarea name="nachricht"></textarea>
  <button type="submit">Senden</button>
</form>`}</code>
          </div>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Submissions list */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {filtered.map(s => (
              <div key={s.id}
                onClick={() => setSelected(s)}
                className="px-5 py-4 rounded-[18px] bg-white cursor-pointer transition-all flex items-center gap-4"
                style={{
                  boxShadow: selected?.id === s.id ? '0 0 0 2px #1a1a1a' : '0 2px 12px rgba(0,0,0,0.06)',
                  border: '1px solid var(--border)',
                }}>
                {/* Unread dot */}
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: s.read_at ? '#E5E7EB' : '#3B82F6' }} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: '#F0F4FF', color: '#4338CA' }}>
                      {s.form_name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {formatDate(s.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 truncate">
                    {Object.entries(s.data).slice(0, 3).map(([k, v]) => `${v}`).join(' · ')}
                  </p>
                </div>

                <button onClick={e => { e.stopPropagation(); deleteSubmission(s.id) }}
                  disabled={deleting === s.id}
                  className="p-1.5 rounded-[8px] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#DC2626')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#9CA3AF')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-80 flex-shrink-0 rounded-[20px] bg-white p-5 flex flex-col gap-4 self-start sticky top-4"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.10)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: '#F0F4FF', color: '#4338CA' }}>{selected.form_name}</span>
                <button onClick={() => setSelected(null)}
                  className="p-1 rounded-[8px]" style={{ color: '#9CA3AF' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {formatDate(selected.created_at)}
                {selected.ip_address && ` · ${selected.ip_address}`}
              </p>

              <div className="flex flex-col gap-3">
                {Object.entries(selected.data).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">{key}</label>
                    <p className="text-sm text-gray-800 break-words">{value || '—'}</p>
                  </div>
                ))}
              </div>

              <button onClick={() => deleteSubmission(selected.id)}
                disabled={deleting === selected.id}
                className="mt-2 w-full py-2 text-sm font-medium rounded-[12px] transition-all"
                style={{ background: '#FEF2F2', color: '#DC2626' }}>
                Löschen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
