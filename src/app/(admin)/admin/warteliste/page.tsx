'use client'

import { useState, useEffect, useRef } from 'react'

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

interface Stats { total: number; confirmed: number; unsubscribed: number }

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, confirmed: 0, unsubscribed: 0 })
  const [loading, setLoading] = useState(true)

  // Compose state
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/admin/waitlist')
      .then(r => r.json())
      .then(d => { setEntries(d.entries ?? []); setStats(d.stats ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

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
    a.download = `warteliste-${new Date().toISOString().slice(0, 10)}.csv`
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
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Warteliste</h1>
        <p className="text-sm text-gray-500 mt-1">Eingetragene Interessenten vor dem Launch</p>
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

      {/* List */}
      <div className="rounded-2xl overflow-hidden mb-8" style={{ border: '1px solid #F1F1F1', background: '#fff' }}>
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

      {/* Compose broadcast */}
      <div className="rounded-2xl p-6" style={{ background: '#fff', border: '1px solid #F1F1F1' }}>
        <h2 className="text-base font-bold text-gray-900 mb-1">E-Mail an alle Bestätigten senden</h2>
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
          <textarea
            ref={textareaRef}
            placeholder={"Hallo,\n\nDein Nachrichtentext hier...\n\n(Leerzeile = neuer Absatz)"}
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={10}
            className="w-full text-sm px-4 py-3 rounded-xl outline-none resize-none font-mono"
            style={{ border: '1.5px solid #E5E7EB', background: '#FAFAFA', lineHeight: 1.7 }}
            onFocus={e => (e.target.style.borderColor = '#111')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
          />
          <div className="text-xs text-gray-400">
            {`Signatur „Beste Grüße, Daniel von FinestSites" und Abmelde-Link werden automatisch angehängt.`}
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
    </div>
  )
}
