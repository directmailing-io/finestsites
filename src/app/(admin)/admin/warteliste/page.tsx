'use client'

'use client'

import { useState, useEffect } from 'react'
import RichTextarea from '@/components/admin/RichTextarea'
import { markupToHtml } from '@/lib/email/markup'


interface WaitlistEntry {
  id: string
  email: string
  name: string | null
  source: string | null
  confirmed: boolean
  confirmedAt: string | null
  unsubscribedAt: string | null
  createdAt: string
}

interface Broadcast {
  id: string
  subject: string
  body: string
  sent_count: number
  failed_count: number
  recipients: { email: string; name: string | null }[]
  sent_at: string
}

interface Stats { total: number; confirmed: number; unsubscribed: number }

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, confirmed: 0, unsubscribed: 0 })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'list' | 'compose' | 'verlauf'>('list')

  // Compose state
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  // Verlauf: expanded broadcast
  const [expandedBroadcast, setExpandedBroadcast] = useState<string | null>(null)

  function loadData() {
    fetch('/api/admin/waitlist')
      .then(r => r.json())
      .then(d => {
        setEntries(d.entries ?? [])
        setStats(d.stats ?? {})
        setBroadcasts(d.broadcasts ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  function csvExport() {
    const rows = [['E-Mail', 'Name', 'Status', 'Quelle', 'Eingetragen am']]
    entries.forEach(e => rows.push([
      e.email,
      e.name ?? '',
      e.unsubscribedAt ? 'Abgemeldet' : e.confirmed ? 'Bestätigt' : 'Ausstehend',
      e.source ?? '',
      new Date(e.createdAt).toLocaleDateString('de-DE'),
    ]))
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `insider-club-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) return
    setSending(true)
    setSendResult(null)
    setSendError(null)
    try {
      const res = await fetch('/api/admin/waitlist/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      })
      const data = await res.json()
      if (!res.ok) { setSendError(data.error ?? 'Fehler'); return }
      setSendResult(data)
      setSubject('')
      setBody('')
      loadData()
    } catch {
      setSendError('Netzwerkfehler.')
    } finally {
      setSending(false)
    }
  }

  const active = entries.filter(e => !e.unsubscribedAt)

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Insider-Club</h1>
        <p className="text-sm text-gray-500 mt-1">Mitglieder des Insider-Clubs</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Eingetragen', value: stats.total, color: '#111' },
          { label: 'Bestätigt', value: stats.confirmed, color: '#16A34A' },
          { label: 'Abgemeldet', value: stats.unsubscribed, color: '#9CA3AF' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #F1F1F1' }}>
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-semibold text-gray-400 mt-1 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-[14px] w-fit" style={{ background: '#F1F5F9' }}>
        {([
          { key: 'list', label: `Einträge (${entries.length})` },
          { key: 'compose', label: 'E-Mail senden' },
          { key: 'verlauf', label: `Verlauf${broadcasts.length ? ` (${broadcasts.length})` : ''}` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 text-sm font-medium rounded-[10px] transition-all"
            style={{
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? '#111827' : '#6B7280',
              boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LIST TAB ── */}
      {tab === 'list' && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #F1F1F1', background: '#fff' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F5F5F5' }}>
            <p className="text-sm font-semibold text-gray-700">{active.length} aktive Einträge</p>
            <button onClick={csvExport} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: '#F5F5F5', color: '#374151' }}>
              CSV Export
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Lädt…</div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">Noch keine Einträge.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #F5F5F5' }}>
                  {['E-Mail', 'Name', 'Status', 'Quelle', 'Datum'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #FAFAFA' }}>
                    <td className="px-5 py-3 text-gray-800">{e.email}</td>
                    <td className="px-5 py-3 text-gray-500">{e.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      {e.unsubscribedAt ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>Abgemeldet</span>
                      ) : e.confirmed ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#D1FAE5', color: '#065F46' }}>Bestätigt</span>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>Ausstehend</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{e.source ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{new Date(e.createdAt).toLocaleDateString('de-DE')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── COMPOSE TAB ── */}
      {tab === 'compose' && (
        <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #F1F1F1' }}>
          <h2 className="text-base font-bold text-gray-900 mb-1">E-Mail an alle Insider senden</h2>
          <p className="text-xs text-gray-400 mb-5">{stats.confirmed} Empfänger · Abgemeldet werden automatisch ausgeschlossen</p>

          {sendResult && (
            <div className="mb-4 text-sm font-medium px-4 py-3 rounded-xl" style={{ background: '#D1FAE5', color: '#065F46' }}>
              ✓ {sendResult.sent} E-Mails gesendet{sendResult.failed > 0 ? `, ${sendResult.failed} fehlgeschlagen` : ''}
            </div>
          )}
          {sendError && (
            <div className="mb-4 text-sm font-medium px-4 py-3 rounded-xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>
              {sendError}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Betreff"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full text-sm px-4 py-3 rounded-xl outline-none"
              style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA' }}
              onFocus={e => (e.target.style.borderColor = '#111')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
            />

            {/* {{vorname}} hint */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <span>
                Personalisierung: Nutze{' '}
                <code className="font-mono font-semibold bg-blue-100 px-1 rounded">{'{{vorname}}'}</code>
                {' '}im Betreff oder Text. Wird durch den Vornamen des Empfängers ersetzt (Fallback: &quot;du&quot;).
              </span>
            </div>

            <RichTextarea
              value={body}
              onChange={setBody}
              placeholder={"Hey {{vorname}},\n\ndein Text hier...\n\n(Leerzeile = neuer Absatz, **fett**, [Text](URL))"}
              rows={10}
            />
            <div className="text-xs text-gray-400">
              {`Signatur „Viele Grüße, Daniel von FinestSites" und Abmelde-Link werden automatisch angehängt.`}
            </div>
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim() || stats.confirmed === 0}
              className="self-start px-6 py-3 rounded-xl text-sm font-semibold transition-opacity"
              style={{
                background: '#111',
                color: '#fff',
                opacity: (sending || !subject.trim() || !body.trim()) ? 0.4 : 1,
              }}
            >
              {sending ? 'Wird gesendet…' : `Jetzt an ${stats.confirmed} senden`}
            </button>
          </div>
        </div>
      )}

      {/* ── VERLAUF TAB ── */}
      {tab === 'verlauf' && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #F1F1F1', background: '#fff' }}>
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Lädt…</div>
          ) : broadcasts.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">Noch keine E-Mails gesendet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #F5F5F5' }}>
                  {['Betreff', 'Gesendet', 'Empfänger', 'Fehlgeschlagen', 'Datum'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {broadcasts.map(b => (
                  <>
                    <tr key={b.id} onClick={() => setExpandedBroadcast(expandedBroadcast === b.id ? null : b.id)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{ borderBottom: expandedBroadcast === b.id ? 'none' : '1px solid #FAFAFA' }}>
                      <td className="px-5 py-3 text-gray-800 font-medium max-w-[200px] truncate">{b.subject}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#D1FAE5', color: '#065F46' }}>
                          {b.sent_count}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {Array.isArray(b.recipients) ? b.recipients.length : 0} Empfänger
                      </td>
                      <td className="px-5 py-3">
                        {b.failed_count > 0 ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#991B1B' }}>{b.failed_count}</span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(b.sent_at)}</td>
                    </tr>
                    {expandedBroadcast === b.id && (
                      <tr key={`${b.id}-detail`} style={{ borderBottom: '1px solid #FAFAFA' }}>
                        <td colSpan={5} className="px-5 pb-5">
                          <div className="flex flex-col gap-3">
                            {/* Mail-Inhalt */}
                            <div className="rounded-xl p-4" style={{ background: '#F9FAFB', border: '1px solid #F1F1F1' }}>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Inhalt</p>
                              <div
                                className="text-sm"
                                dangerouslySetInnerHTML={{ __html: markupToHtml(b.body) }}
                              />
                            </div>
                            {/* Empfänger */}
                            <div className="rounded-xl p-4" style={{ background: '#F9FAFB', border: '1px solid #F1F1F1' }}>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Empfänger ({Array.isArray(b.recipients) ? b.recipients.length : 0})
                              </p>
                              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                                {(Array.isArray(b.recipients) ? b.recipients : []).map((r, i) => (
                                  <span key={i} className="px-2 py-1 rounded-lg text-xs text-gray-600" style={{ background: '#fff', border: '1px solid #E5E7EB' }}>
                                    {r.name ? `${r.name} <${r.email}>` : r.email}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
