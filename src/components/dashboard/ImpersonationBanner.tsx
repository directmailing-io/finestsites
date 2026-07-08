'use client'

import { useEffect, useRef, useState } from 'react'

interface PendingRequest {
  id: string
  token: string
  adminName: string
  expiresAt: string
}

type Status = 'idle' | 'loading' | 'done'

export default function ImpersonationBanner() {
  const [request, setRequest] = useState<PendingRequest | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = async () => {
    try {
      const res = await fetch('/api/impersonate/pending', { cache: 'no-store' })
      const data = await res.json()
      setRequest(data.request ?? null)
    } catch {
      // ignore network errors
    }
  }

  useEffect(() => {
    poll()
    intervalRef.current = setInterval(poll, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const respond = async (action: 'approve' | 'reject') => {
    if (!request) return
    setStatus('loading')
    try {
      await fetch(`/api/impersonate/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: request.token }),
      })
      setStatus('done')
      setRequest(null)
    } catch {
      setStatus('idle')
    }
  }

  if (!request || status === 'done') return null

  return (
    <div style={{
      background: '#1E3A5F',
      color: '#fff',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 12,
      fontSize: 14,
      fontWeight: 500,
      position: 'sticky',
      top: 0,
      zIndex: 200,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    }}>
      <span style={{ lineHeight: 1.4 }}>
        <strong>{request.adminName}</strong> vom FinestSites-Support möchte deinen Account kurz ansehen, um dir zu helfen.
      </span>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => respond('reject')}
          disabled={status === 'loading'}
          style={{
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: status === 'loading' ? 0.5 : 1,
          }}
        >
          Ablehnen
        </button>
        <button
          onClick={() => respond('approve')}
          disabled={status === 'loading'}
          style={{
            background: '#22C55E',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: status === 'loading' ? 0.5 : 1,
          }}
        >
          {status === 'loading' ? 'Bitte warten…' : 'Freigeben'}
        </button>
      </div>
    </div>
  )
}
