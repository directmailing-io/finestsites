'use client'

import { useEffect, useState } from 'react'

const POLL_MS = 5 * 60 * 1000
/** Fensterereignis, mit dem Seiten (Detail gelesen, Karte weggewischt) den Zähler sofort nachziehen. */
export const NEWS_UNREAD_EVENT = 'newsUnreadUpdate'

export function broadcastNewsUnread(unreadCount: number) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NEWS_UNREAD_EVENT, { detail: { unreadCount } }))
}

/**
 * Anzahl ungelesener Neuigkeiten für die Seitenleiste: `GET /api/news/unread` beim Start, alle
 * 5 Minuten und bei Fokus des Fensters; zusätzlich sofort über `broadcastNewsUnread`.
 */
export function useNewsUnread(enabled = true): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    const load = () => {
      fetch('/api/news/unread', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (alive && d && typeof d.unreadCount === 'number') setCount(d.unreadCount) })
        .catch(() => {})
    }
    load()
    const timer = window.setInterval(load, POLL_MS)
    const onFocus = () => { if (document.visibilityState === 'visible') load() }
    const onEvent = (e: Event) => {
      const n = (e as CustomEvent<{ unreadCount: number }>).detail?.unreadCount
      if (typeof n === 'number') setCount(n)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener(NEWS_UNREAD_EVENT, onEvent)
    return () => {
      alive = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener(NEWS_UNREAD_EVENT, onEvent)
    }
  }, [enabled])

  return count
}
