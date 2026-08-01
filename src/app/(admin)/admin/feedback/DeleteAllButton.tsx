'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteAllButton({ count }: { count: number }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (count === 0) return null

  async function deleteAll() {
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/feedback', { method: 'DELETE' })
      if (res.ok) router.refresh()
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" style={{ color: '#B91C1C' }}>
          Wirklich alle {count} Antworten unwiderruflich löschen?
        </span>
        <button onClick={deleteAll} disabled={deleting}
          className="text-xs font-semibold px-3 py-1.5 rounded-full text-white"
          style={{ background: '#DC2626', opacity: deleting ? 0.6 : 1 }}>
          {deleting ? 'Lösche…' : 'Ja, löschen'}
        </button>
        <button onClick={() => setConfirming(false)} disabled={deleting}
          className="text-xs font-medium px-3 py-1.5 rounded-full"
          style={{ background: '#F1F5F9', color: '#64748B' }}>
          Abbrechen
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="text-xs font-medium px-3 py-1.5 rounded-full"
      style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
      Alle Antworten löschen
    </button>
  )
}
