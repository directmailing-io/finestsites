'use client'

import Link from 'next/link'
import { Megaphone } from "lucide-react"
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { signOut } from '@/lib/auth/client'
import { usePlanQuota } from '@/components/dashboard/PlanQuotaContext'
import { useVisitorChat } from '@/components/chat/VisitorChatContext'
import { useNewsUnread } from '@/components/news/useNewsUnread'

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const quota = usePlanQuota()
  const visitorChat = useVisitorChat()
  const [showMore, setShowMore] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [chatUnread, setChatUnread] = useState(0)

  // Hide on editor pages — must be after all hooks
  const isEditorPage = /^\/sites\/[^/]+\/edit/.test(pathname)
  const newsUnread = useNewsUnread(!isEditorPage)

  useEffect(() => {
    if (isEditorPage) return
    fetch('/api/submissions/unread-count')
      .then(r => r.json())
      .then(d => setUnreadCount(d.count ?? 0))
      .catch(() => {})
  }, [isEditorPage])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowMore(false)
    if (pathname.startsWith('/submissions')) {
      const id = setTimeout(() => setUnreadCount(0), 0)
      return () => clearTimeout(id)
    }
  }, [pathname])

  // Listen for unread count updates from SupportChat
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<{ count: number }>).detail
      setChatUnread(detail?.count ?? 0)
    }
    window.addEventListener('supportUnreadUpdate', handler)
    return () => window.removeEventListener('supportUnreadUpdate', handler)
  }, [])

  if (isEditorPage) return null

  function isActive(href: string) {
    if (href === '/sites') return pathname === '/sites' || pathname.startsWith('/sites/')
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    setShowMore(false)
    await signOut()
    router.push('/login')
  }

  const activeSites = isActive('/sites')
  const activeSubmissions = isActive('/submissions')
  const activeChats = isActive('/chats')
  const activePartner = isActive('/affiliate')

  return (
    <>
      {/* Overlay */}
      {showMore && (
        <div
          className="lg:hidden fixed inset-0 z-[45]"
          style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)' }}
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More drawer */}
      {showMore && (
      <div
        className="lg:hidden fixed left-0 right-0 z-[46] rounded-t-3xl"
        style={{
          bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
          background: '#fff',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.14)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: '#E5E7EB' }} />
        </div>

        <div className="px-3 pb-3">
          {/* Support — seit 02.11.2026 hier statt in der Leiste (dort jetzt Partnerbereich), wie in der App */}
          <Link
            href="/support"
            className="flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-gray-50"
          >
            <span style={{ color: '#6B7280' }}><TabChatIcon active={false} /></span>
            <span className="text-base font-medium text-gray-800 flex-1">Support</span>
            {chatUnread > 0 && (
              <span className="min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center"
                style={{ background: '#DC2626', color: '#fff' }}>
                {chatUnread > 99 ? '99+' : chatUnread}
              </span>
            )}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </Link>

          <Link
            href="/neuigkeiten"
            className="flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-gray-50"
          >
            <span style={{ color: '#6B7280' }}><DrawerNewsIcon /></span>
            <span className="text-base font-medium text-gray-800 flex-1">Neuigkeiten</span>
            {newsUnread > 0 && (
              <span className="min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center"
                style={{ background: '#7C3AED', color: '#fff' }}>
                {newsUnread > 99 ? '99+' : newsUnread}
              </span>
            )}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </Link>

          <Link
            href="/settings"
            className="flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-gray-50"
          >
            <span style={{ color: '#6B7280' }}><DrawerSettingsIcon /></span>
            <span className="text-base font-medium text-gray-800 flex-1">Einstellungen</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </Link>

          <div className="h-px mx-4 my-1" style={{ background: '#F3F4F6' }} />

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-red-50"
          >
            <span style={{ color: '#DC2626' }}><DrawerLogoutIcon /></span>
            <span className="text-base font-medium text-red-600">Abmelden</span>
          </button>
        </div>
      </div>
      )}

      {/* Bottom Tab Bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch"
        style={{
          background: 'rgba(250,250,250,0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '0.5px solid rgba(0,0,0,0.1)',
          height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <Link
          href="/sites"
          onClick={() => setShowMore(false)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 active:opacity-60 transition-opacity"
        >
          <TabGlobeIcon active={activeSites} />
          <span className="text-[10px] font-medium" style={{ color: activeSites ? '#1a1a1a' : '#9CA3AF' }}>
            Webseite
          </span>
        </Link>

        <Link
          href="/submissions"
          onClick={() => setShowMore(false)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 relative active:opacity-60 transition-opacity"
        >
          <span className="relative">
            <TabInboxIcon active={activeSubmissions} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: '#DC2626', color: 'white' }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>
          <span className="text-[10px] font-medium" style={{ color: activeSubmissions ? '#1a1a1a' : '#9CA3AF' }}>
            Anfragen
          </span>
        </Link>

        {visitorChat.enabled && (
          <Link
            href="/chats"
            onClick={() => setShowMore(false)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 relative active:opacity-60 transition-opacity"
          >
            <span className="relative">
              <TabChatsIcon active={activeChats} />
              {visitorChat.unread > 0 && (
                <span
                  className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{ background: '#DC2626', color: 'white' }}
                >
                  {visitorChat.unread > 99 ? '99+' : visitorChat.unread}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium" style={{ color: activeChats ? '#1a1a1a' : '#9CA3AF' }}>
              Chats
            </span>
          </Link>
        )}

        {/* Partnerbereich in der Leiste (Daniel 02.11.2026); ohne Tarif gesperrt wie früher im Mehr-Fenster */}
        {quota.plan !== null ? (
          <Link
            href="/affiliate"
            onClick={() => setShowMore(false)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 active:opacity-60 transition-opacity"
          >
            <span style={{ color: activePartner ? '#1a1a1a' : '#9CA3AF' }}><TabPartnerIcon active={activePartner} /></span>
            <span className="text-[10px] font-medium" style={{ color: activePartner ? '#1a1a1a' : '#9CA3AF' }}>
              Partner
            </span>
          </Link>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-0.5" style={{ opacity: 0.45 }} aria-label="Partnerbereich, gesperrt">
            <span style={{ color: '#9CA3AF' }}><TabPartnerIcon active={false} /></span>
            <span className="text-[10px] font-medium" style={{ color: '#9CA3AF' }}>Partner</span>
          </div>
        )}

        <button
          onClick={() => setShowMore(s => !s)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 active:opacity-60 transition-opacity"
        >
          <span className="relative">
            <TabMoreIcon active={showMore} />
            {chatUnread > 0 && (
              <span
                className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: '#DC2626', color: 'white' }}
              >
                {chatUnread > 99 ? '99+' : chatUnread}
              </span>
            )}
            {newsUnread > 0 && chatUnread === 0 && (
              /* ungelesene Neuigkeiten: lila Punkt am „Mehr“-Reiter */
              <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full" style={{ background: '#7C3AED', boxShadow: '0 0 0 2px rgba(250,250,250,0.94)' }} />
            )}
          </span>
          <span className="text-[10px] font-medium" style={{ color: showMore ? '#1a1a1a' : '#9CA3AF' }}>
            Mehr
          </span>
        </button>
      </nav>
    </>
  )
}

// ── Tab Icons (filled when active, outline when not) ──────────────────────────

function TabGlobeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a1a1a' : '#9CA3AF'} strokeWidth={active ? 2 : 1.75}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  )
}

function TabInboxIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a1a1a' : '#9CA3AF'} strokeWidth={active ? 2 : 1.75}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
    </svg>
  )
}

function TabChatsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a1a1a' : '#9CA3AF'} strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/>
      <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>
    </svg>
  )
}

function TabPartnerIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function TabChatIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a1a1a' : '#9CA3AF'} strokeWidth={active ? 2 : 1.75}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )
}

function TabMoreIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a1a1a' : '#9CA3AF'} strokeWidth={active ? 2 : 1.75}>
      <circle cx="12" cy="12" r="1" fill={active ? '#1a1a1a' : '#9CA3AF'}/>
      <circle cx="19" cy="12" r="1" fill={active ? '#1a1a1a' : '#9CA3AF'}/>
      <circle cx="5" cy="12" r="1" fill={active ? '#1a1a1a' : '#9CA3AF'}/>
    </svg>
  )
}

// ── Drawer Icons ──────────────────────────────────────────────────────────────


function DrawerNewsIcon() {
  return <Megaphone size={20} strokeWidth={1.75} aria-hidden />
}

function DrawerSettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}

function DrawerLogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}
