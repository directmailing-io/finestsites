'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatNewsDateTime } from '@/components/news/news-ui'
import { adminFetch, AdminApiError, AUDIENCE_LABELS, StatusPill, ConfirmDialog, type AdminNewsItem } from './_lib'

/**
 * Admin → Neuigkeiten: Kennzahlen, Tabelle mit Status/Push/Gelesen/Knopf, Knopf „Neue Neuigkeit“.
 * Quelle: GET /api/admin/news (mit Statistik je Neuigkeit).
 */
export default function AdminNewsListPage() {
  const router = useRouter()
  const [items, setItems] = useState<AdminNewsItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; kind: 'archive' | 'delete' } | null>(null)

  async function load() {
    try {
      const d = await adminFetch<{ items: AdminNewsItem[] }>('/api/admin/news')
      setItems(d.items)
      setError(null)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Die Neuigkeiten konnten nicht geladen werden.')
    }
  }

  useEffect(() => { void load() }, [])

  const kpi = useMemo(() => {
    const list = items ?? []
    const published = list.filter(i => i.status === 'published')
    const drafts = list.filter(i => i.status === 'draft')
    // „letzte“ = zuletzt veröffentlichte (auch archivierte zählen für die Statistik)
    const last = list.filter(i => i.publishedAt).sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))[0] ?? null
    const readRate = last && last.pushQueued > 0 ? Math.round((last.readCount / last.pushQueued) * 100) : null
    return { published: published.length, drafts: drafts.length, last, readRate }
  }, [items])

  async function runAction() {
    if (!confirm) return
    setBusyId(confirm.id)
    try {
      if (confirm.kind === 'archive') await adminFetch(`/api/admin/news/${confirm.id}/archive`, { method: 'POST' })
      else await adminFetch(`/api/admin/news/${confirm.id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Aktion fehlgeschlagen.')
    } finally {
      setBusyId(null)
      setConfirm(null)
    }
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Neuigkeiten</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            Ankündigungen für Web und App · Push höchstens einmal am Tag
          </p>
        </div>
        <Link href="/admin/neuigkeiten/neu"
          className="inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold text-white transition-transform active:scale-[0.98]"
          style={{ background: '#111827', boxShadow: '0 2px 8px rgba(17,24,39,0.18)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Neue Neuigkeit
        </Link>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label="Veröffentlicht" value={items ? String(kpi.published) : '–'} hint="sichtbar in Web und App" />
        <Kpi label="Entwürfe" value={items ? String(kpi.drafts) : '–'} hint="noch nicht veröffentlicht" />
        <Kpi
          label="Push-Empfänger · letzte"
          value={items ? (kpi.last ? (kpi.last.pushSentAt ? String(kpi.last.pushQueued) : 'ohne Push') : '–') : '–'}
          hint={kpi.last ? truncate(kpi.last.title, 34) : 'noch keine Veröffentlichung'}
          accent
        />
        <Kpi
          label="Gelesen · letzte"
          value={items ? (kpi.last ? (kpi.readRate != null ? `${kpi.readRate} %` : String(kpi.last.readCount)) : '–') : '–'}
          hint={kpi.last ? (kpi.readRate != null ? `${kpi.last.readCount} von ${kpi.last.pushQueued} Push-Empfängern` : `${kpi.last.readCount === 1 ? 'Nutzer hat' : 'Nutzer haben'} sie geöffnet`) : 'noch keine Veröffentlichung'}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>{error}</div>
      )}

      {/* Tabelle */}
      <div className="rounded-[16px] bg-white overflow-x-auto" style={{ border: '1px solid #EEF0F3', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <table className="w-full text-sm" style={{ minWidth: 860, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {[
                { label: 'Titel' }, { label: 'Status' }, { label: 'Veröffentlicht am' },
                { label: 'Push', right: true }, { label: 'Gelesen', right: true }, { label: 'Knopf getippt', right: true }, { label: '', right: true },
              ].map((h, i) => (
                <th key={i} className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide ${h.right ? 'text-right' : 'text-left'}`}
                  style={{ color: '#94A3B8', borderBottom: '1px solid #EEF0F3' }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items === null && !error && (
              [1, 2, 3].map(i => (
                <tr key={i} className="animate-pulse" style={{ borderTop: '1px solid #F3F4F6' }}>
                  <td className="px-4 py-3.5" colSpan={7}><div className="h-3.5 rounded-full bg-gray-100 w-1/2" /></td>
                </tr>
              ))
            )}
            {items && items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-14 text-center">
                <div className="text-sm font-semibold text-gray-900">Noch keine Neuigkeit</div>
                <div className="text-sm mt-1" style={{ color: '#94A3B8' }}>Schreib die erste – mit Live-Vorschau für iPhone, Android und App.</div>
                <Link href="/admin/neuigkeiten/neu" className="inline-flex mt-4 px-4 h-9 items-center rounded-xl text-sm font-semibold" style={{ background: '#F1F5F9', color: '#111827' }}>Neue Neuigkeit</Link>
              </td></tr>
            )}
            {items?.map(item => {
              const busy = busyId === item.id
              return (
                <tr key={item.id} className="group transition-colors hover:bg-[#FAFAFA]" style={{ borderTop: '1px solid #F3F4F6', cursor: 'pointer' }}
                  onClick={() => router.push(`/admin/neuigkeiten/${item.id}`)}>
                  <td className="px-4 py-3 text-left" style={{ maxWidth: 360 }}>
                    <div className="font-medium text-gray-900 truncate">{item.title}</div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: '#94A3B8' }}>
                      {item.pushTitle}{item.audience !== 'all' ? ` · ${AUDIENCE_LABELS[item.audience]}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-left"><StatusPill status={item.status} /></td>
                  <td className="px-4 py-3 text-left whitespace-nowrap" style={{ color: item.publishedAt ? '#111827' : '#94A3B8' }}>
                    {item.publishedAt ? formatNewsDateTime(item.publishedAt) : '–'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {item.status === 'draft' ? <span style={{ color: '#CBD5E1' }}>–</span>
                      : item.pushSentAt ? <span className="font-medium text-gray-900">{item.pushQueued}</span>
                      : <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#64748B' }}>ohne Push</span>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-medium" style={{ color: item.status === 'draft' ? '#CBD5E1' : '#111827' }}>
                    {item.status === 'draft' ? '–' : item.readCount}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-medium" style={{ color: item.status === 'draft' || !item.ctaLabel ? '#CBD5E1' : '#111827' }}>
                    {item.status === 'draft' ? '–' : item.ctaLabel ? item.ctaCount : '–'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      <Link href={`/admin/neuigkeiten/${item.id}`}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-gray-200"
                        style={{ background: '#F1F5F9', color: '#374151' }}>
                        {item.status === 'archived' ? 'Ansehen' : 'Bearbeiten'}
                      </Link>
                      {item.status === 'published' && (
                        <button type="button" disabled={busy} onClick={() => setConfirm({ id: item.id, kind: 'archive' })}
                          className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-amber-100"
                          style={{ background: '#FFF7ED', color: '#9A3412', opacity: busy ? 0.5 : 1 }}>
                          Archivieren
                        </button>
                      )}
                      {item.status === 'draft' && (
                        <button type="button" disabled={busy} onClick={() => setConfirm({ id: item.id, kind: 'delete' })}
                          className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-red-100"
                          style={{ background: '#FEF2F2', color: '#B91C1C', opacity: busy ? 0.5 : 1 }}>
                          Löschen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'archive' ? 'Neuigkeit archivieren?' : 'Entwurf löschen?'}
          text={confirm.kind === 'archive'
            ? 'Sie verschwindet sofort aus Web und App. Die Statistik bleibt erhalten.'
            : 'Der Entwurf wird endgültig gelöscht.'}
          confirmLabel={confirm.kind === 'archive' ? 'Archivieren' : 'Löschen'}
          danger={confirm.kind === 'delete'}
          busy={busyId === confirm.id}
          onCancel={() => setConfirm(null)}
          onConfirm={runAction}
        />
      )}
    </div>
  )
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s }

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-[16px] bg-white px-4 py-3.5" style={{ border: '1px solid #EEF0F3', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{label}</div>
      <div className="text-2xl font-semibold tracking-tight mt-1" style={{ color: accent ? '#6D28D9' : '#111827' }}>{value}</div>
      {hint && <div className="text-xs mt-0.5 truncate" style={{ color: '#94A3B8' }}>{hint}</div>}
    </div>
  )
}
