'use client'

/**
 * Besucher-Chat im Web-Dashboard: Freischaltung + ungelesene Zahl für die Navigation.
 *
 *   - `enabled` kommt serverseitig aus dem Dashboard-Layout (isVisitorChatEnabledForUser).
 *   - `unread` wird nur bei Freischaltung geholt: GET /api/app/v1/chat/unread alle 30 s,
 *     pausiert bei verborgenem Tab, sofort beim Zurückkommen und beim Wechsel auf /chats.
 *   - Die Chats-Seite setzt den Wert über `setUnread` direkt aus ihrer Liste (unreadTotal).
 *
 * Muster: PlanQuotaContext.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { chatApi } from '@/components/chat/mock'

interface VisitorChatState {
  enabled: boolean
  unread: number
  /** Direkt setzen (z. B. aus der Gesprächsliste). */
  setUnread: (n: number) => void
  /** Zahl neu vom Server holen. */
  refreshUnread: () => Promise<void>
}

const VisitorChatContext = createContext<VisitorChatState | null>(null)

const POLL_MS = 30_000

export function VisitorChatProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [unread, setUnreadState] = useState(0)
  const pathname = usePathname()
  const inFlight = useRef(false)

  const refreshUnread = useCallback(async () => {
    if (!enabled || inFlight.current) return
    inFlight.current = true
    try {
      const res = await chatApi.getUnread()
      setUnreadState(res.count)
    } catch {
      /* alter Wert bleibt */
    } finally {
      inFlight.current = false
    }
  }, [enabled])

  // Alle 30 s, nur bei sichtbarem Tab; beim Zurückkommen sofort.
  useEffect(() => {
    if (!enabled) return
    const tick = () => { if (!document.hidden) refreshUnread() }
    tick()
    const id = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [enabled, refreshUnread])

  // Beim Wechsel auf /chats sofort aktualisieren (die Seite selbst liefert danach unreadTotal).
  useEffect(() => {
    if (enabled && pathname.startsWith('/chats')) refreshUnread()
  }, [enabled, pathname, refreshUnread])

  const setUnread = useCallback((n: number) => setUnreadState(Math.max(0, n)), [])

  return (
    <VisitorChatContext.Provider value={{ enabled, unread, setUnread, refreshUnread }}>
      {children}
    </VisitorChatContext.Provider>
  )
}

export function useVisitorChat(): VisitorChatState {
  const ctx = useContext(VisitorChatContext)
  if (!ctx) {
    return { enabled: false, unread: 0, setUnread: () => {}, refreshUnread: async () => {} }
  }
  return ctx
}
