'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Logo } from '@/components/shared/Logo'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const PLAN_LIMITS: Record<string, number> = { starter: 1, pro: 3, unlimited: Infinity }

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [quota, setQuota] = useState<{ used: number; limit: number; plan: string } | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(data => {
        const plan = data.plan ?? 'starter'
        const limit = PLAN_LIMITS[plan] ?? 1
        setQuota({ used: data.paid_sites_count ?? 0, limit, plan })
      })
      .catch(() => {})

    fetch('/api/submissions/unread-count')
      .then(r => r.json())
      .then(data => setUnreadCount(data.count ?? 0))
      .catch(() => {})
  }, [])

  // Reset badge when navigating to submissions
  useEffect(() => {
    if (pathname.startsWith('/submissions')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadCount(0)
    }
  }, [pathname])

  const navItems = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7" rx="2"/>
          <rect x="14" y="3" width="7" height="7" rx="2"/>
          <rect x="3" y="14" width="7" height="7" rx="2"/>
          <rect x="14" y="14" width="7" height="7" rx="2"/>
        </svg>
      ),
    },
    {
      href: '/sites',
      label: 'Meine Seiten',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      ),
    },
    {
      href: '/sites/library',
      label: 'Webseiten-Bibliothek',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      ),
    },
    {
      href: '/submissions',
      label: 'Meine Anfragen',
      badge: unreadCount,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <path d="M9 12h6M9 16h4"/>
        </svg>
      ),
    },
    {
      href: '/settings',
      label: 'Einstellungen',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      ),
    },
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden lg:flex w-[240px] flex-col flex-shrink-0 p-4 gap-2"
      style={{ borderRight: '1px solid var(--border)', background: '#FFFFFF', height: '100vh', position: 'sticky', top: 0, overflowY: 'auto' }}>

      {/* Logo */}
      <div className="px-3 py-4 mb-2">
        <Logo variant="black" height={22} />
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && item.href !== '/sites' && pathname.startsWith(item.href)) ||
            (item.href === '/sites' && (pathname === '/sites' || (pathname.startsWith('/sites/') && !pathname.startsWith('/sites/library'))))
          const badge = 'badge' in item ? item.badge as number : 0
          return (
            <div key={item.href}>
              <Link href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all rounded-[14px]"
                style={{
                  color: isActive ? '#1a1a1a' : '#6B7280',
                  background: isActive ? '#F3F4F6' : 'transparent',
                }}>
                <span style={{ color: isActive ? '#1a1a1a' : '#9CA3AF' }}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{ background: '#EF4444', color: 'white' }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
              {/* Abrechnung as sub-item under Einstellungen */}
              {item.href === '/settings' && (
                <Link href="/billing"
                  className="flex items-center gap-3 pl-9 pr-3 py-2 text-sm font-medium transition-all rounded-[14px] mt-0.5"
                  style={{
                    color: pathname === '/billing' || pathname.startsWith('/billing') ? '#1a1a1a' : '#9CA3AF',
                    background: pathname === '/billing' || pathname.startsWith('/billing') ? '#F3F4F6' : 'transparent',
                  }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="4" width="22" height="16" rx="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  <span>Abrechnung</span>
                </Link>
              )}
            </div>
          )
        })}
      </nav>

      {/* Quota widget */}
      {quota && (
        <Link href="/billing"
          className="mx-1 mb-2 px-3 py-3 rounded-[14px] flex flex-col gap-2 transition-all"
          style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F1F5F9'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F8FAFC'}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: '#374151' }}>
              {quota.used} von {quota.limit === Infinity ? '∞' : quota.limit} Webseiten
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize"
              style={{
                background: quota.plan === 'unlimited' ? '#ECFDF5' : quota.plan === 'pro' ? '#EDE9FE' : '#F3F4F6',
                color: quota.plan === 'unlimited' ? '#059669' : quota.plan === 'pro' ? '#6D28D9' : '#6B7280',
              }}>
              {quota.plan}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: quota.limit === Infinity ? '0%' : `${Math.min(100, (quota.used / quota.limit) * 100)}%`,
                background: quota.used >= quota.limit
                  ? '#EF4444'
                  : quota.used / quota.limit >= 0.75
                  ? '#F59E0B'
                  : '#1a1a1a',
              }}
            />
          </div>
          {quota.used >= quota.limit && (
            <p className="text-[10px] font-medium" style={{ color: '#EF4444' }}>
              Limit erreicht — upgraden →
            </p>
          )}
        </Link>
      )}

      {/* Bottom: Logout */}
      <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 text-sm w-full rounded-[14px] transition-all"
          style={{ color: '#6B7280' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#FEF2F2'
            ;(e.currentTarget as HTMLElement).style.color = '#DC2626'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#6B7280'
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Abmelden
        </button>
      </div>
    </aside>
  )
}
