'use client'

/**
 * Admin: Besucher-Chat ein-/ausschalten, freigeschaltete Konten pflegen, gemeldete Gespräche sehen.
 * Schreibt app_settings visitor_chat_enabled + visitor_chat_users + visitor_chat_app_users über PUT /api/admin/chat/settings.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { chatApi, type AdminChatReport } from '@/components/chat/mock'
import { Switch } from '@/components/chat/Dialogs'
import { reportReasonLabel } from '@/components/chat/utils'

function fmt(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function hoursSince(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

export default function AdminVisitorChatPage() {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [usersText, setUsersText] = useState('demo')
  const [appUsers, setAppUsers] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<{ ok: boolean; text: string } | null>(null)
  const [reports, setReports] = useState<AdminChatReport[]>([])
  const [reportsError, setReportsError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    chatApi.adminGetSettings()
      .then(s => {
        if (!alive) return
        setEnabled(s.enabled)
        setAppUsers(s.appUsers === true)
        const list = s.users ?? []
        const text = list.length ? list.join(', ') : 'demo'
        setUsersText(text)
        setSavedSnapshot(JSON.stringify({ enabled: s.enabled, text, appUsers: s.appUsers === true }))
      })
      .catch(() => { if (alive) setSaveState({ ok: false, text: 'Einstellungen konnten nicht geladen werden.' }) })
      .finally(() => { if (alive) setLoading(false) })
    chatApi.adminGetReports()
      .then(r => { if (alive) setReports(r) })
      .catch(() => { if (alive) setReportsError('Meldungen konnten nicht geladen werden.') })
    return () => { alive = false }
  }, [])

  const users = usersText.split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
  const dirty = JSON.stringify({ enabled, text: usersText, appUsers }) !== savedSnapshot

  async function save() {
    setSaving(true)
    setSaveState(null)
    try {
      const s = await chatApi.adminSaveSettings({ enabled, users, appUsers })
      setEnabled(s.enabled)
      setAppUsers(s.appUsers === true)
      const text = (s.users ?? []).join(', ')
      setUsersText(text)
      setSavedSnapshot(JSON.stringify({ enabled: s.enabled, text, appUsers: s.appUsers === true }))
      setSaveState({ ok: true, text: s.enabled ? 'Gespeichert. Der Chat ist eingeschaltet.' : 'Gespeichert. Der Chat ist ausgeschaltet.' })
    } catch {
      setSaveState({ ok: false, text: 'Speichern fehlgeschlagen. Bitte noch einmal versuchen.' })
    } finally {
      setSaving(false)
    }
  }

  const openReports = reports.filter(r => hoursSince(r.reportedAt) < 24).length

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 px-0 sm:px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Besucher-Chat</h1>
        <p className="text-sm text-gray-500 mt-1">Chat zwischen Seitenbesuchern und Betreibern. Freigeschaltet für einzelne Konten und, wenn unten an, für alle App-Nutzer. Auf einer Seite erscheint er erst, wenn der Nutzer ihn im Editor einschaltet.</p>
      </div>

      {/* Schalter + Konten */}
      <section className="bg-white rounded-2xl p-5 sm:p-6 mb-6" style={{ border: '1px solid var(--border, #E5E7EB)' }} aria-labelledby="chat-settings">
        <h2 id="chat-settings" className="text-base font-semibold text-gray-900 mb-4">Einstellungen</h2>

        <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div>
            <p className="text-[15px] font-medium text-gray-900 m-0">Besucher-Chat</p>
            <p className="text-sm m-0 mt-0.5" style={{ color: '#6B7280' }}>
              {enabled ? 'Eingeschaltet – freigeschaltete Konten können den Chat im Editor einschalten.' : 'Ausgeschaltet – auf keiner Seite erscheint ein Chat (Notaus).'}
            </p>
          </div>
          <Switch checked={enabled} onChange={setEnabled} disabled={loading} label="Besucher-Chat ein- oder ausschalten" />
        </div>

        <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div>
            <p className="text-[15px] font-medium text-gray-900 m-0">Alle App-Nutzer</p>
            <p className="text-sm m-0 mt-0.5" style={{ color: '#6B7280' }}>
              Konten, die die App benutzt haben, sehen „Chats“ und die Editor-Karte. Der Chat ist dort aus, bis sie ihn einschalten und der Auftragsverarbeitung zustimmen.
            </p>
          </div>
          <Switch checked={appUsers} onChange={setAppUsers} disabled={loading} label="Chat für alle App-Nutzer freischalten" />
        </div>

        <label className="block py-4">
          <span className="text-[15px] font-medium text-gray-900">Zusätzlich freigeschaltete Konten</span>
          <span className="block text-sm mt-0.5 mb-2" style={{ color: '#6B7280' }}>Benutzernamen, durch Komma getrennt. Diese Konten sind immer freigeschaltet, auch ohne App.</span>
          <input
            type="text"
            value={usersText}
            onChange={e => setUsersText(e.target.value)}
            disabled={loading}
            placeholder="demo, maria, thomas"
            className="w-full px-4 py-3 text-[15px] rounded-xl outline-none"
            style={{ border: '1.5px solid #E5E7EB', fontFamily: 'inherit', color: '#111' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
            onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {users.length > 0 && (
            <span className="flex flex-wrap gap-1.5 mt-2.5">
              {users.map(u => (
                <span key={u} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: '#F3F4F6', color: '#374151' }}>@{u}</span>
              ))}
            </span>
          )}
        </label>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
          <button
            onClick={save}
            disabled={loading || saving || !dirty}
            className="px-5 py-2.5 text-sm font-semibold rounded-xl text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#1a1a1a' }}
          >
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
          {saveState && (
            <p role="status" className="text-sm m-0" style={{ color: saveState.ok ? '#15803D' : '#B91C1C' }}>{saveState.text}</p>
          )}
        </div>

        <p className="text-xs mt-4 m-0 rounded-xl px-3.5 py-2.5" style={{ background: '#F8FAFC', color: '#64748B' }}>
          Abschaltung wirkt innerhalb von 60 Sekunden auf allen Seiten. Bereits geladene Chat-Fenster zeigen danach nichts mehr an; App und Dashboard blenden den Bereich „Chats“ aus.
        </p>
      </section>

      {/* Meldungen */}
      <section className="bg-white rounded-2xl p-5 sm:p-6" style={{ border: '1px solid var(--border, #E5E7EB)' }} aria-labelledby="chat-reports">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h2 id="chat-reports" className="text-base font-semibold text-gray-900 m-0">Gemeldete Gespräche</h2>
            <p className="text-sm mt-1 m-0" style={{ color: '#6B7280' }}>
              {reports.length === 0 ? 'Keine Meldungen.' : `${reports.length} ${reports.length === 1 ? 'Meldung' : 'Meldungen'}${openReports ? ` · ${openReports} jünger als 24 Stunden` : ''}`}
            </p>
          </div>
          {openReports > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: '#FEF3C7', color: '#92400E' }}>{openReports} offen</span>
          )}
        </div>

        <p className="text-xs rounded-xl px-3.5 py-2.5 mb-4 m-0" style={{ background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
          <strong>Pflicht für den App Store:</strong> Jede Meldung muss innerhalb von 24 Stunden bearbeitet werden (Apple 1.2, Google Play UGC). Der Betreiber hat den Besucher meist schon gesperrt; prüfe den Verlauf und entferne den Inhalt bei Bedarf über das Konto des Betreibers.
        </p>

        {reportsError ? (
          <p className="text-sm" style={{ color: '#B91C1C' }}>{reportsError}</p>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl py-10 text-center" style={{ background: '#FAFAFA' }}>
            <p className="text-sm m-0" style={{ color: '#94A3B8' }}>Sobald ein Betreiber ein Gespräch meldet, erscheint es hier mit den letzten Nachrichten.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3 m-0 p-0 list-none">
            {reports.map(r => {
              const fresh = hoursSince(r.reportedAt) < 24
              const open = expanded === r.conversationId
              const shown = open ? r.lastMessages : r.lastMessages.slice(-3)
              return (
                <li key={r.conversationId} className="rounded-2xl p-4" style={{ border: `1px solid ${fresh ? '#FDE68A' : '#E5E7EB'}`, background: fresh ? '#FFFDF5' : '#fff' }}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#FEE2E2', color: '#991B1B' }}>{reportReasonLabel(r.reason)}</span>
                    <Link href="/admin/users" className="text-sm font-semibold text-gray-900 hover:underline">@{r.username}</Link>
                    <a href={`https://${r.siteHost}`} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline" style={{ color: '#6B7280' }}>{r.siteHost}</a>
                    <span className="text-xs ml-auto" style={{ color: '#94A3B8' }}>{fmt(r.reportedAt)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs" style={{ color: '#6B7280' }}>
                    <span>Status: <strong style={{ color: r.status === 'blocked' ? '#991B1B' : '#374151' }}>{r.status === 'blocked' ? 'Besucher gesperrt' : r.status === 'archived' ? 'Archiviert' : 'Offen'}</strong></span>
                    <span className="font-mono" title="Gesprächs-ID">{r.conversationId.slice(0, 8)}…</span>
                  </div>
                  {r.note && (
                    <p className="text-sm mt-3 m-0 rounded-xl px-3.5 py-2.5" style={{ background: '#F8FAFC', color: '#374151' }}>
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em] block mb-1" style={{ color: '#94A3B8' }}>Notiz des Betreibers</span>
                      {r.note}
                    </p>
                  )}
                  <div className="mt-3 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: '#94A3B8' }}>Letzte Nachrichten</span>
                    {shown.map((m, i) => (
                      <div key={i} className={`flex ${m.sender === 'owner' ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[85%] px-3 py-2 rounded-2xl text-[13.5px] leading-snug" style={{ background: m.sender === 'owner' ? '#1a1a1a' : m.sender === 'system' ? '#E5E7EB' : '#F3F4F6', color: m.sender === 'owner' ? '#fff' : '#111', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          <span className="block text-[10px] mb-0.5" style={{ color: m.sender === 'owner' ? 'rgba(255,255,255,0.6)' : '#94A3B8' }}>
                            {m.sender === 'owner' ? 'Betreiber' : m.sender === 'system' ? 'System' : 'Besucher'} · {fmt(m.createdAt)}
                          </span>
                          {m.body}
                        </div>
                      </div>
                    ))}
                    {r.lastMessages.length > 3 && (
                      <button onClick={() => setExpanded(open ? null : r.conversationId)} className="self-start text-xs font-semibold mt-1 underline underline-offset-2" style={{ color: '#374151' }}>
                        {open ? 'Weniger anzeigen' : `Alle ${r.lastMessages.length} Nachrichten anzeigen`}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
