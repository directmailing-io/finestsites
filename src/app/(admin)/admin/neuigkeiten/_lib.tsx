'use client'

import type { AdminNewsItem } from '@/lib/news/service'

/** Gemeinsame Hilfen der Admin-Seiten „Neuigkeiten“ (nur Typen + reine Funktionen, kein Server-Code). */

export type { AdminNewsItem }

export const STATUS_META: Record<AdminNewsItem['status'], { label: string; bg: string; text: string; dot: string }> = {
  draft:     { label: 'Entwurf',        bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
  published: { label: 'Veröffentlicht', bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  archived:  { label: 'Archiviert',     bg: '#F1F5F9', text: '#64748B', dot: '#CBD5E1' },
}

export const AUDIENCE_LABELS: Record<AdminNewsItem['audience'], string> = {
  'all': 'Alle Konten',
  'plan:starter': 'Nur Starter',
  'plan:pro': 'Nur Pro',
  'plan:unlimited': 'Nur Unlimited',
}

export function StatusPill({ status }: { status: AdminNewsItem['status'] }) {
  const m = STATUS_META[status] ?? STATUS_META.draft
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ background: m.bg, color: m.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  )
}

/** Antwort einer Admin-Route lesen; wirft bei Fehler eine Error mit der deutschen Meldung + optional Feldfehlern. */
export class AdminApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string, public readonly fields?: Record<string, string>) {
    super(message)
    this.name = 'AdminApiError'
  }
}

export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  } catch {
    throw new AdminApiError('Keine Verbindung zum Server. Bitte versuch es gleich noch einmal.', 0)
  }
  const data = await res.json().catch(() => null) as (Record<string, unknown> | null)
  if (!res.ok) {
    const msg = typeof data?.error === 'string' ? data.error : `Fehler ${res.status}`
    const code = typeof data?.code === 'string' ? data.code : undefined
    const fields = data?.fields && typeof data.fields === 'object' ? data.fields as Record<string, string> : undefined
    throw new AdminApiError(msg, res.status, code, fields)
  }
  return data as T
}

/** Kleiner Bestätigungsdialog (Archivieren / Löschen). */
export function ConfirmDialog({ title, text, confirmLabel, danger, busy, onCancel, onConfirm }: {
  title: string; text: string; confirmLabel: string; danger?: boolean; busy?: boolean
  onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="w-full bg-white" style={{ maxWidth: 420, borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', padding: 24 }}>
        <div className="text-base font-bold text-gray-900">{title}</div>
        <p className="text-sm mt-1.5" style={{ color: '#64748B' }}>{text}</p>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onCancel} disabled={busy}
            className="flex-1 h-10 rounded-xl text-sm font-semibold" style={{ background: '#fff', color: '#374151', border: '1px solid #E2E8F0' }}>
            Abbrechen
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className="flex-1 h-10 rounded-xl text-sm font-bold text-white"
            style={{ background: danger ? '#DC2626' : '#111827', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Bitte warten…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
