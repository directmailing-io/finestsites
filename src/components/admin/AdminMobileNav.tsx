'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { signOut } from '@/lib/auth/client'

export function AdminMobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowMore(false)
  }, [pathname])

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    setShowMore(false)
    await signOut()
    router.push('/login')
  }

  const activeOverview  = isActive('/admin')
  const activeUsers     = isActive('/admin/users')
  const activeTemplates = isActive('/admin/templates')

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
      <div
        className="lg:hidden fixed left-0 right-0 z-[46] rounded-t-3xl transition-transform duration-300 ease-out"
        style={{
          bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
          background: '#fff',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.14)',
          transform: showMore ? 'translateY(0)' : 'translateY(110%)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: '#E5E7EB' }} />
        </div>

        <div className="px-3 pb-3">
          {[
            {
              href: '/admin/affiliate',
              label: 'Affiliate',
              icon: <DrawerAffiliateIcon />,
            },
            {
              href: '/admin/newsletter',
              label: 'Newsletter',
              icon: <DrawerNewsletterIcon />,
            },
            {
              href: '/sites',
              label: 'Zur Webseite',
              icon: <DrawerBackIcon />,
            },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setShowMore(false)}
              className="flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-gray-50"
            >
              <span style={{ color: '#6B7280' }}>{item.icon}</span>
              <span className="text-base font-medium text-gray-800 flex-1">{item.label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Link>
          ))}

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
          href="/admin"
          onClick={() => setShowMore(false)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 active:opacity-60 transition-opacity"
        >
          <TabOverviewIcon active={activeOverview} />
          <span className="text-[10px] font-medium" style={{ color: activeOverview ? '#1a1a1a' : '#9CA3AF' }}>
            Übersicht
          </span>
        </Link>

        <Link
          href="/admin/users"
          onClick={() => setShowMore(false)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 active:opacity-60 transition-opacity"
        >
          <TabUsersIcon active={activeUsers} />
          <span className="text-[10px] font-medium" style={{ color: activeUsers ? '#1a1a1a' : '#9CA3AF' }}>
            Nutzer
          </span>
        </Link>

        <Link
          href="/admin/templates"
          onClick={() => setShowMore(false)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 active:opacity-60 transition-opacity"
        >
          <TabTemplatesIcon active={activeTemplates} />
          <span className="text-[10px] font-medium" style={{ color: activeTemplates ? '#1a1a1a' : '#9CA3AF' }}>
            Templates
          </span>
        </Link>

        <button
          onClick={() => setShowMore(s => !s)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 active:opacity-60 transition-opacity"
        >
          <TabMoreIcon active={showMore} />
          <span className="text-[10px] font-medium" style={{ color: showMore ? '#1a1a1a' : '#9CA3AF' }}>
            Mehr
          </span>
        </button>
      </nav>
    </>
  )
}

// ── Tab Icons ──────────────────────────────────────────────────────────────────

function TabOverviewIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a1a1a' : '#9CA3AF'} strokeWidth={active ? 2 : 1.75}>
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  )
}

function TabUsersIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a1a1a' : '#9CA3AF'} strokeWidth={active ? 2 : 1.75}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}

function TabTemplatesIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a1a1a' : '#9CA3AF'} strokeWidth={active ? 2 : 1.75}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18M9 21V9"/>
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

function DrawerAffiliateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  )
}

function DrawerNewsletterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}

function DrawerBackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M19 12H5M12 5l-7 7 7 7"/>
    </svg>
  )
}

function DrawerLogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}
