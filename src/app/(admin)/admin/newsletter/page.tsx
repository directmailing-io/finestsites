'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import RichTextarea from '@/components/admin/RichTextarea'
import { markupToHtml } from '@/lib/email/markup'

interface UserRow {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  username: string | null
  plan: string
  subscription_status: string | null
  publishedTemplateIds: string[]
  has_any_site: boolean
}
interface TemplateRow { id: string; title: string; tags: string[] }
interface HistoryEntry {
  id: string; subject: string; body: string
  recipient_filter: string; specific_emails: string[] | null
  sent: number; failed: number; total: number; sent_at: string
}

// ── Saved templates (localStorage) ────────────────────────────────────────────
interface SavedTemplate { id: string; name: string; subject: string; body: string }
const LS_KEY = 'fs_email_templates'
function lsLoad(): SavedTemplate[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') } catch { return [] }
}
function lsSave(templates: SavedTemplate[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(templates))
}

function HistoryCard({ entry, onLoad }: { entry: HistoryEntry; onLoad: (subject: string, body: string) => void }) {
  const [open, setOpen] = useState(false)
  const emails: string[] = entry.specific_emails ?? []

  return (
    <div className="rounded-[20px] p-5 bg-white" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{entry.subject}</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
            {historyFilterLabel(entry.recipient_filter, entry.specific_emails, entry.total)} · {formatDate(entry.sent_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onLoad(entry.subject, entry.body)}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all"
            style={{ background: '#F1F5F9', color: '#374151', border: '1px solid #E5E7EB' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E5E7EB')}
            onMouseLeave={e => (e.currentTarget.style.background = '#F1F5F9')}
            title="Als Vorlage in Erstellen laden">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Laden
          </button>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: entry.failed > 0 ? '#FEF2F2' : '#F0FDF4', color: entry.failed > 0 ? '#DC2626' : '#16A34A' }}>
            {entry.failed > 0 ? `${entry.sent}/${entry.total} gesendet` : `${entry.sent} gesendet`}
          </span>
        </div>
      </div>
      <p className="text-sm mt-3" style={{ color: '#6B7280', whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {entry.body}
      </p>
      {emails.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: '#6B7280' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
            {emails.length} Empfänger {open ? 'ausblenden' : 'anzeigen'}
          </button>
          {open && (
            <div className="mt-2 rounded-[12px] overflow-hidden" style={{ border: '1px solid #E5E7EB', maxHeight: 220, overflowY: 'auto' }}>
              {emails.map((email, i) => (
                <div key={email} className="px-3 py-2 text-xs font-mono"
                  style={{ color: '#374151', background: i % 2 === 0 ? '#F9FAFB' : '#fff', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none' }}>
                  {email}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
interface ApiData { users: UserRow[]; templates: TemplateRow[]; history: HistoryEntry[] }

interface ActiveFilters {
  plans: Set<string>
  subscriptionStatus: Set<string>
  siteStatus: Set<string>
  templateIds: Set<string>
  templateTags: Set<string>
}
const EMPTY_FILTERS: ActiveFilters = {
  plans: new Set(), subscriptionStatus: new Set(), siteStatus: new Set(),
  templateIds: new Set(), templateTags: new Set(),
}

const DEFAULT_SIGNATURE = '\n\nBeste Grüße\nDaniel von FinestSites'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function historyFilterLabel(filterJson: string, specific: string[] | null, total: number): string {
  try {
    const f = JSON.parse(filterJson)
    if (f.mode === 'specific') return `${specific?.length ?? total} bestimmte Nutzer`
    if (f.mode === 'all') return `Alle Nutzer (${total})`
    const parts: string[] = []
    if (f.plans?.length) parts.push(f.plans.join(', '))
    if (f.subscriptionStatus?.length) parts.push(f.subscriptionStatus.includes('active') ? 'Aktiv' : 'Inaktiv')
    if (f.templateIds?.length) parts.push(`${f.templateIds.length} Webseite(n)`)
    if (f.templateTags?.length) parts.push(`Tags: ${f.templateTags.join(', ')}`)
    if (f.siteStatus?.length) {
      const m: Record<string, string> = { published: 'veröffentlichte Seite', any: 'beliebige Seite', none: 'keine Seite' }
      parts.push(f.siteStatus.map((s: string) => m[s] ?? s).join(' oder '))
    }
    return (parts.length ? parts.join(' · ') : 'Gefiltert') + ` (${total})`
  } catch { return `${total} Empfänger` }
}

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value); else next.add(value)
  return next
}

function applyFilters(users: UserRow[], templates: TemplateRow[], mode: 'all' | 'filtered' | 'specific', filters: ActiveFilters, specificUsers: UserRow[]): UserRow[] {
  if (mode === 'specific') return specificUsers
  if (mode === 'all') return users

  const tagTemplateIds = new Map<string, Set<string>>()
  for (const t of templates) {
    for (const tag of t.tags) {
      if (!tagTemplateIds.has(tag)) tagTemplateIds.set(tag, new Set())
      tagTemplateIds.get(tag)!.add(t.id)
    }
  }

  return users.filter(u => {
    if (filters.plans.size > 0 && !filters.plans.has(u.plan)) return false
    if (filters.subscriptionStatus.size > 0) {
      const isActive = u.subscription_status === 'active'
      const match = (filters.subscriptionStatus.has('active') && isActive) || (filters.subscriptionStatus.has('inactive') && !isActive)
      if (!match) return false
    }
    if (filters.siteStatus.size > 0) {
      const hasPublished = u.publishedTemplateIds.length > 0
      const match =
        (filters.siteStatus.has('published') && hasPublished) ||
        (filters.siteStatus.has('any') && u.has_any_site) ||
        (filters.siteStatus.has('none') && !u.has_any_site)
      if (!match) return false
    }
    if (filters.templateIds.size > 0) {
      if (!u.publishedTemplateIds.some(tid => filters.templateIds.has(tid))) return false
    }
    if (filters.templateTags.size > 0) {
      const matchingTplIds = new Set([...filters.templateTags].flatMap(tag => [...(tagTemplateIds.get(tag) ?? [])]))
      if (!u.publishedTemplateIds.some(tid => matchingTplIds.has(tid))) return false
    }
    return true
  })
}

function Chip({ label, active, onClick, onRemove }: { label: string; active: boolean; onClick?: () => void; onRemove?: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
      style={{ background: active ? '#111827' : '#F1F5F9', color: active ? '#fff' : '#374151', border: `1px solid ${active ? '#111827' : '#E5E7EB'}` }}>
      {label}
      {onRemove && (
        <span onClick={e => { e.stopPropagation(); onRemove() }} style={{ color: active ? 'rgba(255,255,255,0.6)' : '#9CA3AF' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </span>
      )}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94A3B8' }}>{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export default function NewsletterPage() {
  const [tab, setTab] = useState<'compose' | 'history'>('compose')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState(DEFAULT_SIGNATURE)
  const [mode, setMode] = useState<'all' | 'filtered' | 'specific'>('all')
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS)
  const [selectedUsers, setSelectedUsers] = useState<UserRow[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [templateSearch, setTemplateSearch] = useState('')
  const [data, setData] = useState<ApiData | null>(null)
  const [preview, setPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([])
  const [saveNameInput, setSaveNameInput] = useState('')
  const [showSaveRow, setShowSaveRow] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    fetch('/api/admin/newsletter').then(r => r.json()).then(d => !d.error && setData(d))
    setSavedTemplates(lsLoad())
  }, [])

  function handleLoadTemplate(tpl: SavedTemplate) {
    setSubject(tpl.subject)
    setBody(tpl.body)
    setTab('compose')
  }

  function handleSaveTemplate() {
    const name = saveNameInput.trim()
    if (!name) return
    const next = [...savedTemplates, { id: Date.now().toString(), name, subject, body }]
    setSavedTemplates(next)
    lsSave(next)
    setSaveNameInput('')
    setShowSaveRow(false)
  }

  function handleDeleteTemplate(id: string) {
    const next = savedTemplates.filter(t => t.id !== id)
    setSavedTemplates(next)
    lsSave(next)
  }

  function handleLoadFromHistory(subject: string, body: string) {
    setSubject(subject)
    setBody(body)
    setTab('compose')
  }

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const t of data?.templates ?? []) for (const tag of t.tags) tags.add(tag)
    return [...tags].sort()
  }, [data?.templates])

  const filteredRecipients = useMemo(
    () => applyFilters(data?.users ?? [], data?.templates ?? [], mode, filters, selectedUsers),
    [data, mode, filters, selectedUsers]
  )

  const hasActiveFilters = Object.values(filters).some((s: Set<string>) => s.size > 0)

  function buildPayload() {
    if (mode === 'specific') return { mode: 'specific' as const, specificEmails: selectedUsers.map(u => u.email) }
    if (mode === 'all') return { mode: 'all' as const }
    return {
      mode: 'filtered' as const,
      plans: [...filters.plans],
      subscriptionStatus: [...filters.subscriptionStatus],
      siteStatus: [...filters.siteStatus],
      templateIds: [...filters.templateIds],
      templateTags: [...filters.templateTags],
    }
  }

  async function handleSend() {
    setError(''); setSending(true); setConfirm(false); setResult(null)
    try {
      const res = await fetch('/api/admin/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, filters: buildPayload() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Fehler beim Senden.'); return }
      setResult(json)
      fetch('/api/admin/newsletter').then(r => r.json()).then(d => !d.error && setData(d))
    } catch { setError('Netzwerkfehler.') } finally { setSending(false) }
  }

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && filteredRecipients.length > 0

  function interpolatePreview(text: string): string {
    // Use first recipient for preview, or mock data
    const sample = filteredRecipients[0]
    return text.replace(/\{\{(\w+)(?:\|([^}]*))?\}\}/g, (_match, field: string, fallback: string | undefined) => {
      const fb = fallback ?? ''
      switch (field) {
        case 'vorname':  return sample?.firstName?.trim() || fb || 'du'
        case 'nachname': return sample?.lastName?.trim()  || fb || ''
        case 'username': return sample?.username?.trim()  || fb || ''
        case 'email':    return sample?.email || fb || 'nutzer@beispiel.de'
        default:         return _match
      }
    })
  }

  function previewHtml() {
    const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`
    const previewBody = interpolatePreview(body)
    const bodyContent = previewBody.trim()
      ? markupToHtml(previewBody)
      : `<p style="color:#B0A89E;font-size:15px;font-family:${FONT};">Inhalt hier…</p>`
    return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F5F3F0;font-family:${FONT};">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F5F3F0;padding:48px 16px 56px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">
      <tr>
        <td align="center" style="padding-bottom:28px;">
          <a href="https://finestsites.io" style="display:inline-block;text-decoration:none;">
            <img src="https://finestsites.io/logos/logo-black.svg" alt="FinestSites" width="140" style="display:block;width:140px;height:auto;border:0;"/>
          </a>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;border-radius:20px;border:1px solid #E8E4DE;padding:44px;">
          <div style="font-size:15px;color:#555047;line-height:1.8;font-family:${FONT};">
            ${bodyContent}
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0;">
            <tr><td style="border-top:1px solid #F0EDE8;height:1px;font-size:0;line-height:0;">&nbsp;</td></tr>
          </table>
          <p style="margin:0;font-size:14px;color:#6B6560;line-height:1.7;font-family:${FONT};">
            Viele Grüße,<br/>
            <strong style="color:#111111;">Daniel von FinestSites</strong>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 0 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#B0A89E;line-height:1.7;font-family:${FONT};">
            Du bekommst diese Mail, weil du ein FinestSites-Konto hast.<br/>
            <span style="color:#B0A89E;text-decoration:underline;">Abmelden</span>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`
  }

  const card = { background: '#fff', borderRadius: 20, padding: 20, border: '1px solid #F1F5F9', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }

  // Templates not yet selected + matching search
  const availableTemplates = (data?.templates ?? []).filter(
    t => !filters.templateIds.has(t.id) && t.title.toLowerCase().includes(templateSearch.toLowerCase())
  )

  return (
    <div style={{ maxWidth: 960 }}>
      <div className="mb-6">
        <Link href="/admin" className="flex items-center gap-2 text-sm mb-5" style={{ color: '#94A3B8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Zurück zum Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Newsletter</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Nachricht an deine Nutzer senden</p>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-[14px] w-fit" style={{ background: '#F1F5F9' }}>
        {(['compose', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium rounded-[10px] transition-all"
            style={{ background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#111827' : '#6B7280', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {t === 'compose' ? 'Erstellen' : `Verlauf${data?.history?.length ? ` (${data.history.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* ── COMPOSE ── */}
      {tab === 'compose' && (
        <>
          {result && (
            <div className="mb-6 rounded-[20px] p-6 bg-white" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #D1FAE5' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#F0FDF4' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Newsletter gesendet</p>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                    {result.sent} von {result.total} E-Mails erfolgreich{result.failed > 0 && ` · ${result.failed} fehlgeschlagen`}
                  </p>
                </div>
              </div>
              <button onClick={() => { setResult(null); setSubject(''); setBody(DEFAULT_SIGNATURE); setSelectedUsers([]); setFilters(EMPTY_FILTERS); setMode('all') }}
                className="text-sm font-medium underline underline-offset-4" style={{ color: '#374151' }}>
                Neuen Newsletter erstellen
              </button>
            </div>
          )}

          {!result && (
            <div className="grid gap-5" style={{ gridTemplateColumns: preview ? '1fr 1fr' : '1fr' }}>
              <div className="flex flex-col gap-4">

                {/* RECIPIENT SECTION */}
                <div style={card}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#94A3B8' }}>Empfänger</p>

                  {/* Mode */}
                  <div className="flex gap-2 mb-5">
                    {([{ key: 'all', label: 'Alle Nutzer' }, { key: 'filtered', label: 'Gefiltert' }, { key: 'specific', label: 'Manuell' }] as const).map(opt => (
                      <button key={opt.key} onClick={() => setMode(opt.key)}
                        className="px-4 py-2 rounded-[10px] text-sm font-medium transition-all"
                        style={{ background: mode === opt.key ? '#111827' : '#F9FAFB', color: mode === opt.key ? '#fff' : '#374151', border: `1px solid ${mode === opt.key ? '#111827' : '#E5E7EB'}` }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* FILTERED MODE */}
                  {mode === 'filtered' && (
                    <div className="flex flex-col gap-5 mb-4 pt-4" style={{ borderTop: '1px solid #F1F5F9' }}>

                      <Section title="Tarif">
                        {['starter', 'pro', 'unlimited'].map(p => (
                          <Chip key={p} label={p.charAt(0).toUpperCase() + p.slice(1)}
                            active={filters.plans.has(p)}
                            onClick={() => setFilters(f => ({ ...f, plans: toggle(f.plans, p) }))} />
                        ))}
                      </Section>

                      <Section title="Abo-Status">
                        <Chip label="Aktiv" active={filters.subscriptionStatus.has('active')}
                          onClick={() => setFilters(f => ({ ...f, subscriptionStatus: toggle(f.subscriptionStatus, 'active') }))} />
                        <Chip label="Noch nicht aktiv" active={filters.subscriptionStatus.has('inactive')}
                          onClick={() => setFilters(f => ({ ...f, subscriptionStatus: toggle(f.subscriptionStatus, 'inactive') }))} />
                      </Section>

                      <Section title="Webseite (allgemein)">
                        <Chip label="Mind. 1 veröffentlichte Seite" active={filters.siteStatus.has('published')}
                          onClick={() => setFilters(f => ({ ...f, siteStatus: toggle(f.siteStatus, 'published') }))} />
                        <Chip label="Mind. 1 Seite (beliebig)" active={filters.siteStatus.has('any')}
                          onClick={() => setFilters(f => ({ ...f, siteStatus: toggle(f.siteStatus, 'any') }))} />
                        <Chip label="Keine Webseite" active={filters.siteStatus.has('none')}
                          onClick={() => setFilters(f => ({ ...f, siteStatus: toggle(f.siteStatus, 'none') }))} />
                      </Section>

                      {/* SPECIFIC TEMPLATES */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94A3B8' }}>Bestimmte Webseite veröffentlicht</p>
                        {filters.templateIds.size > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {[...filters.templateIds].map(tid => {
                              const tpl = data?.templates.find(t => t.id === tid)
                              return (
                                <Chip key={tid} label={tpl?.title ?? tid} active
                                  onRemove={() => setFilters(f => ({ ...f, templateIds: toggle(f.templateIds, tid) }))} />
                              )
                            })}
                          </div>
                        )}
                        {data?.templates.length === 0 ? (
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>Noch keine veröffentlichten Templates vorhanden.</p>
                        ) : (
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                            </svg>
                            <input type="text" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}
                              placeholder="Template suchen…"
                              className="w-full pl-8 pr-4 py-2 text-sm rounded-[10px] outline-none"
                              style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', color: '#111827' }}
                              onFocus={e => (e.target.style.borderColor = '#111827')}
                              onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                          </div>
                        )}
                        {availableTemplates.length > 0 && (
                          <div className="mt-2 rounded-[10px] overflow-hidden" style={{ border: '1px solid #E5E7EB', maxHeight: 160, overflowY: 'auto' }}>
                            {availableTemplates.map((t, i) => (
                              <button key={t.id}
                                onClick={() => { setFilters(f => ({ ...f, templateIds: toggle(f.templateIds, t.id) })); setTemplateSearch('') }}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left"
                                style={{ color: '#374151', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none', background: '#fff' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                                <span>{t.title}</span>
                                {t.tags.length > 0 && (
                                  <span className="text-xs flex gap-1 ml-3 flex-shrink-0">
                                    {t.tags.slice(0, 3).map(tag => (
                                      <span key={tag} className="px-1.5 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#6B7280' }}>{tag}</span>
                                    ))}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* TAGS */}
                      {allTags.length > 0 && (
                        <Section title="Nach Tag filtern">
                          {allTags.map(tag => (
                            <Chip key={tag} label={tag} active={filters.templateTags.has(tag)}
                              onClick={() => setFilters(f => ({ ...f, templateTags: toggle(f.templateTags, tag) }))} />
                          ))}
                        </Section>
                      )}

                      {hasActiveFilters && (
                        <button onClick={() => setFilters(EMPTY_FILTERS)}
                          className="text-xs self-start underline underline-offset-2" style={{ color: '#94A3B8' }}>
                          Alle Filter zurücksetzen
                        </button>
                      )}
                    </div>
                  )}

                  {/* SPECIFIC MODE */}
                  {mode === 'specific' && (
                    <div className="flex flex-col gap-3 mb-4 pt-4" style={{ borderTop: '1px solid #F1F5F9' }}>
                      {selectedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedUsers.map(u => {
                            const name = [u.firstName, u.lastName].filter(Boolean).join(' ')
                            return (
                              <span key={u.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                                style={{ background: '#F1F5F9', color: '#374151' }}>
                                {name || u.email}
                                {name && <span style={{ color: '#9CA3AF' }}>·</span>}
                                {name && <span style={{ color: '#9CA3AF' }}>{u.email}</span>}
                                <button onClick={() => setSelectedUsers(p => p.filter(x => x.id !== u.id))} style={{ color: '#9CA3AF' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      )}
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                        </svg>
                        <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                          placeholder="Name, E-Mail oder Username suchen…"
                          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-[12px] outline-none"
                          style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', color: '#111827' }}
                          onFocus={e => (e.target.style.borderColor = '#111827')}
                          onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                      </div>
                      {userSearch && (() => {
                        const q = userSearch.toLowerCase()
                        const hits = (data?.users ?? []).filter(u =>
                          !selectedUsers.find(s => s.id === u.id) && (
                            u.email.toLowerCase().includes(q) ||
                            (u.firstName ?? '').toLowerCase().includes(q) ||
                            (u.lastName ?? '').toLowerCase().includes(q) ||
                            (u.username ?? '').toLowerCase().includes(q)
                          )
                        ).slice(0, 50)
                        return hits.length > 0 ? (
                          <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid #E5E7EB', maxHeight: 200, overflowY: 'auto' }}>
                            {hits.map((u, i) => {
                              const name = [u.firstName, u.lastName].filter(Boolean).join(' ')
                              return (
                                <button key={u.id}
                                  onClick={() => { setSelectedUsers(p => [...p, u]); setUserSearch('') }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left"
                                  style={{ color: '#374151', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none', background: '#fff' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                                  <span className="flex-1 min-w-0">
                                    {name && <span className="block text-xs font-medium text-gray-900 truncate">{name}</span>}
                                    <span className="block truncate" style={{ color: name ? '#6B7280' : '#374151', fontSize: name ? 11 : 13 }}>{u.email}</span>
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#F1F5F9', color: '#6B7280' }}>{u.plan}</span>
                                </button>
                              )
                            })}
                          </div>
                        ) : null
                      })()}
                    </div>
                  )}

                  {/* Count */}
                  <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: filteredRecipients.length > 0 ? '#16A34A' : '#E5E7EB' }} />
                    <p className="text-sm font-medium" style={{ color: filteredRecipients.length > 0 ? '#111827' : '#9CA3AF' }}>
                      {data ? `${filteredRecipients.length} Empfänger` : 'Wird geladen…'}
                    </p>
                    {mode === 'filtered' && hasActiveFilters && filteredRecipients.length === 0 && (
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>Kein Nutzer entspricht dieser Kombination.</p>
                    )}
                  </div>
                </div>

                {/* Saved templates */}
                {savedTemplates.length > 0 && (
                  <div style={card}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#94A3B8' }}>Gespeicherte Vorlagen</p>
                    <div className="flex flex-col gap-2">
                      {savedTemplates.map(tpl => (
                        <div key={tpl.id} className="flex items-center gap-2 p-3 rounded-[12px]" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{tpl.name}</p>
                            <p className="text-xs truncate mt-0.5" style={{ color: '#94A3B8' }}>{tpl.subject}</p>
                          </div>
                          <button
                            onClick={() => handleLoadTemplate(tpl)}
                            className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                            style={{ background: '#111827', color: '#fff' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#374151')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#111827')}>
                            Laden
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(tpl.id)}
                            className="flex-shrink-0 p-1.5 rounded-lg transition-all"
                            style={{ color: '#9CA3AF' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
                            title="Vorlage löschen">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subject + body */}
                <div style={card} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Betreff</label>
                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                      placeholder="z.B. Neue Templates verfügbar"
                      className="w-full px-4 py-3 text-sm rounded-[12px] outline-none transition-all"
                      style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', color: '#111827' }}
                      onFocus={e => (e.target.style.borderColor = '#111827')}
                      onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Inhalt</label>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className="text-xs" style={{ color: '#CBD5E1' }}>Platzhalter:</span>
                        {[
                          { label: '{{vorname}}', title: 'Vorname (Fallback: "du")' },
                          { label: '{{nachname}}', title: 'Nachname' },
                          { label: '{{email}}', title: 'E-Mail-Adresse' },
                        ].map(p => (
                          <button key={p.label} title={p.title}
                            onClick={() => setBody(b => b + p.label)}
                            className="text-xs px-2 py-0.5 rounded-md font-mono transition-all"
                            style={{ background: '#F1F5F9', color: '#6366F1', border: '1px solid #E0E7FF' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#E0E7FF')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#F1F5F9')}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <RichTextarea
                      value={body}
                      onChange={setBody}
                      placeholder={"Hey {{vorname}},\n\ndein Text hier...\n\n(Leerzeile = neuer Absatz, **fett**, [Text](URL))"}
                      rows={12}
                    />
                    <p className="text-xs" style={{ color: '#CBD5E1' }}>
                      Platzhalter werden pro Nutzer ersetzt. <span className="font-mono">&#123;&#123;vorname&#125;&#125;</span> → Vorname, falls vorhanden, sonst <em>&bdquo;du&ldquo;</em>. Fallback anpassen: <span className="font-mono">&#123;&#123;vorname|Hallo&#125;&#125;</span>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={() => setPreview(v => !v)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-sm font-medium transition-all"
                    style={{ background: preview ? '#F0FDF4' : '#F9FAFB', color: preview ? '#16A34A' : '#374151', border: `1px solid ${preview ? '#D1FAE5' : '#E5E7EB'}` }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                    {preview ? 'Vorschau ausblenden' : 'Vorschau anzeigen'}
                  </button>
                  <button onClick={() => { setShowSaveRow(v => !v); setSaveNameInput('') }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-sm font-medium transition-all"
                    style={{ background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#F9FAFB')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Als Vorlage speichern
                  </button>
                  <button onClick={() => { if (canSend) setConfirm(true) }} disabled={!canSend || sending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-sm font-semibold transition-all"
                    style={{ background: canSend && !sending ? '#111827' : '#E5E7EB', color: canSend && !sending ? '#fff' : '#9CA3AF', cursor: canSend && !sending ? 'pointer' : 'not-allowed', boxShadow: canSend && !sending ? '0 4px 14px rgba(17,24,39,0.2)' : 'none' }}>
                    {sending ? (
                      <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>Wird gesendet…</>
                    ) : (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Newsletter senden</>
                    )}
                  </button>
                </div>
                {showSaveRow && (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={saveNameInput}
                      onChange={e => setSaveNameInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate(); if (e.key === 'Escape') setShowSaveRow(false) }}
                      placeholder="Vorlagen-Name, z. B. WhatsApp Fokusgruppe"
                      className="flex-1 px-4 py-2.5 text-sm rounded-[12px] outline-none"
                      style={{ background: '#F9FAFB', border: '1.5px solid #111827', color: '#111827' }} />
                    <button onClick={handleSaveTemplate} disabled={!saveNameInput.trim()}
                      className="px-4 py-2.5 rounded-[12px] text-sm font-semibold transition-all"
                      style={{ background: saveNameInput.trim() ? '#111827' : '#E5E7EB', color: saveNameInput.trim() ? '#fff' : '#9CA3AF' }}>
                      Speichern
                    </button>
                    <button onClick={() => setShowSaveRow(false)} className="px-3 py-2.5 rounded-[12px] text-sm" style={{ color: '#94A3B8' }}>Abbrechen</button>
                  </div>
                )}
                {error && <p className="text-sm px-1" style={{ color: '#DC2626' }}>{error}</p>}
              </div>

              {preview && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: '#94A3B8' }}>Vorschau</p>
                  <div className="rounded-[20px] overflow-hidden" style={{ border: '1px solid #E5E7EB', height: 580 }}>
                    <iframe ref={iframeRef} title="E-Mail-Vorschau" className="w-full h-full" srcDoc={previewHtml()} sandbox="allow-same-origin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── HISTORY ── */}
      {tab === 'history' && (
        <div className="flex flex-col gap-3">
          {!data?.history?.length ? (
            <div className="rounded-[20px] p-10 bg-white text-center" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>
              <p className="text-sm" style={{ color: '#94A3B8' }}>Noch keine Newsletter gesendet.</p>
            </div>
          ) : data.history.map(entry => (
            <HistoryCard key={entry.id} entry={entry} onLoad={handleLoadFromHistory} />
          ))}
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setConfirm(false)}>
          <div className="rounded-[24px] p-6 w-full max-w-sm mx-4 bg-white" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-[14px] flex items-center justify-center mb-4" style={{ background: '#FEF9C3' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 text-base mb-1">Newsletter wirklich senden?</h3>
            <p className="text-sm mb-5" style={{ color: '#6B7280' }}>
              Du sendest an <strong className="text-gray-900">{filteredRecipients.length} Empfänger</strong>. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(false)} className="flex-1 py-2.5 rounded-[12px] text-sm font-medium" style={{ background: '#F3F4F6', color: '#374151' }}>Abbrechen</button>
              <button onClick={handleSend} className="flex-1 py-2.5 rounded-[12px] text-sm font-semibold" style={{ background: '#111827', color: '#fff' }}>Jetzt senden</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
