'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_OPTIONS = [
  { key: 'reviewed', label: 'Geprüft', color: '#B45309' },
  { key: 'published', label: 'Veröffentlicht', color: '#15803D' },
  { key: 'rejected', label: 'Abgelehnt', color: '#DC2626' },
]

export function StatusActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function setStatus(next: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/erfahrungsberichte/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/erfahrungsberichte/${id}`, { method: 'DELETE' })
      if (res.ok) router.push('/admin/erfahrungsberichte')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {STATUS_OPTIONS.map(o => {
        const active = status === o.key
        return (
          <button
            key={o.key}
            onClick={() => setStatus(o.key)}
            disabled={busy || active}
            className="text-xs font-semibold px-3.5 py-2 rounded-full transition-all cursor-pointer disabled:cursor-default"
            style={{
              background: active ? o.color : '#fff',
              color: active ? '#fff' : o.color,
              border: `1px solid ${active ? o.color : '#E5E7EB'}`,
              opacity: busy ? 0.5 : 1,
            }}
          >
            {o.label}
          </button>
        )
      })}
      <button
        onClick={remove}
        disabled={busy}
        className="text-xs font-semibold px-3.5 py-2 rounded-full transition-all cursor-pointer ml-2"
        style={{
          background: confirmDelete ? '#DC2626' : '#fff',
          color: confirmDelete ? '#fff' : '#94A3B8',
          border: `1px solid ${confirmDelete ? '#DC2626' : '#E5E7EB'}`,
          opacity: busy ? 0.5 : 1,
        }}
      >
        {confirmDelete ? 'Wirklich löschen?' : 'Löschen'}
      </button>
    </div>
  )
}
