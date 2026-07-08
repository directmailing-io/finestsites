'use client'

import { useEffect, useRef, useState } from 'react'

interface PendingRequest {
  id: string
  token: string
  adminName: string
  expiresAt: string
}

type BannerView =
  | 'pending'    // waiting for user to approve/reject
  | 'approved'   // user approved, waiting for admin to enter
  | 'active'     // admin is currently in the account
  | 'ended'      // session just ended — show briefly then hide

export default function ImpersonationBanner() {
  const [view, setView] = useState<BannerView | null>(null)
  const [request, setRequest] = useState<PendingRequest | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const prevStateRef = useRef<string | null>(null)
  const endedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    function connect() {
      if (esRef.current) esRef.current.close()

      const es = new EventSource('/api/impersonate/stream')
      esRef.current = es

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as { state: string | null; request: PendingRequest | null }
          const prev = prevStateRef.current
          const next = data.state

          // Detect transition: active → nothing = session just ended
          if (prev === 'active' && next === null) {
            prevStateRef.current = 'ended'
            setView('ended')
            setRequest(null)
            if (endedTimerRef.current) clearTimeout(endedTimerRef.current)
            endedTimerRef.current = setTimeout(() => {
              setView(null)
              prevStateRef.current = null
            }, 6000)
            return
          }

          // Don't overwrite 'ended' while the timer runs
          if (prevStateRef.current === 'ended') return

          prevStateRef.current = next

          if (next === 'pending') {
            setView('pending')
            setRequest(data.request)
          } else if (next === 'active') {
            setView('active')
            setRequest(data.request)
          } else if (next === 'approved') {
            setView('approved')
            setRequest(data.request)
          } else {
            if (view !== 'approved') {
              setView(null)
              setRequest(null)
            }
          }
        } catch { /* ignore parse errors */ }
      }

      es.onerror = () => {
        es.close()
        // Reconnect after 5s on error
        setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      esRef.current?.close()
      if (endedTimerRef.current) clearTimeout(endedTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const respond = async (action: 'approve' | 'reject') => {
    if (!request) return
    setActionLoading(true)
    try {
      await fetch(`/api/impersonate/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: request.token }),
      })
      if (action === 'approve') {
        prevStateRef.current = 'approved'
        setView('approved')
      } else {
        prevStateRef.current = null
        setView(null)
        setRequest(null)
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false)
    }
  }

  if (!view) return null

  const bannerBase: React.CSSProperties = {
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
  }

  if (view === 'pending') {
    return (
      <div style={{ ...bannerBase, background: '#1E3A5F' }}>
        <span style={{ lineHeight: 1.4 }}>
          <strong>{request?.adminName}</strong> vom FinestSites-Support möchte deinen Account kurz ansehen, um dir zu helfen.
        </span>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => respond('reject')}
            disabled={actionLoading}
            style={{
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            Ablehnen
          </button>
          <button
            onClick={() => respond('approve')}
            disabled={actionLoading}
            style={{
              background: '#22C55E',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            {actionLoading ? 'Bitte warten…' : 'Freigeben'}
          </button>
        </div>
      </div>
    )
  }

  if (view === 'approved') {
    return (
      <div style={{ ...bannerBase, background: '#166534' }}>
        <span>Freigabe erteilt. Der Support-Admin betritt deinen Account gleich.</span>
      </div>
    )
  }

  if (view === 'active') {
    return (
      <div style={{ ...bannerBase, background: '#7C3AED' }}>
        <span>
          <strong>{request?.adminName}</strong> sieht gerade deinen Account, um dir zu helfen.
        </span>
      </div>
    )
  }

  if (view === 'ended') {
    return (
      <div style={{ ...bannerBase, background: '#374151' }}>
        <span>Support-Sitzung beendet. Dein Account ist wieder nur für dich.</span>
      </div>
    )
  }

  return null
}
