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

  const [plan, setPlan] = useState<string | null>(null)
  const [atLimit, setAtLimit] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(data => {
        const p = data.plan ?? 'starter'
        const limit = PLAN_LIMITS[p] ?? 1
        const used = data.paid_sites_count ?? 0
        setPlan(p)
        setAtLimit(limit !== Infinity && used >= limit)
      })
      .catch(() => {})

    fetch('/api/submissions/unread-count')
      .then(r => r.json())
      .then(data => setUnreadCount(data.count ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (pathname.startsWith('/submissions')) setUnreadCount(0)
  }, [pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/sites') return pathname === '/sites' || (pathname.startsWith('/sites/') && !pathname.startsWith('/sites/library'))
    return pathname.startsWith(href)
  }

  const PLAN_LABELS: Record<string, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited' }

  return (
    <aside
      className="hidden lg:flex w-[220px] flex-col flex-shrink-0"
      style={{
        borderRight: '1px solid #E5E7EB',
        background: '#FAFAFA',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}>

      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <Logo variant="black" height={20} />
      </div>

      {/* ── Primary nav ──────────────────────────────────── */}
      <nav className="flex flex-col px-3 gap-0.5">
        <NavItem href="/dashboard" active={isActive('/dashboard')} icon={<HomeIcon />}>
          Startseite
        </NavItem>
        <NavItem href="/sites" active={isActive('/sites')} icon={<GlobeIcon />}>
          Meine Webseite
        </NavItem>
        <NavItem href="/submissions" active={isActive('/submissions')} icon={<InboxIcon />} badge={unreadCount}>
          Anfragen
        </NavItem>
      </nav>

      {/* Divider */}
      <div className="mx-4 my-4" style={{ borderTop: '1px solid #E5E7EB' }} />

      {/* ── Secondary nav ────────────────────────────────── */}
      <nav className="flex flex-col px-3 gap-0.5">
        <NavItem href="/sites/library" active={isActive('/sites/library')} icon={<LibraryIcon />} secondary>
          Vorlagen
        </NavItem>
        <NavItem href="/affiliate" active={isActive('/affiliate')} icon={<PartnerIcon />} secondary>
          Partnerbereich
        </NavItem>
        <NavItem href="/settings" active={isActive('/settings')} icon={<SettingsIcon />} secondary>
          Einstellungen
        </NavItem>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Plan & Logout ─────────────────────────────────── */}
      <div className="px-3 pb-5 flex flex-col gap-1">
        {/* Plan hint */}
        {plan && plan !== 'unlimited' && (
          <Link
            href="/billing"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl mb-1 transition-colors hover:bg-gray-100"
            style={{ background: atLimit ? '#FEF2F2' : '#F3F4F6' }}>
            <span className="text-xs font-medium" style={{ color: atLimit ? '#DC2626' : '#6B7280' }}>
              {atLimit ? 'Limit erreicht' : PLAN_LABELS[plan]}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: atLimit ? '#FCA5A5' : '#E5E7EB', color: atLimit ? '#991B1B' : '#374151' }}>
              {atLimit ? 'Upgrade →' : 'Free'}
            </span>
          </Link>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full text-left transition-colors hover:bg-red-50"
          style={{ color: '#9CA3AF' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#DC2626'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#9CA3AF'}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Abmelden
        </button>
      </div>
    </aside>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NavItem({
  href, active, icon, badge, secondary, children,
}: {
  href: string
  active: boolean
  icon: React.ReactNode
  badge?: number
  secondary?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
      style={{
        background: active ? '#1a1a1a' : 'transparent',
        color: active ? '#ffffff' : secondary ? '#9CA3AF' : '#374151',
        fontSize: secondary ? '13px' : '14px',
        fontWeight: active ? 600 : secondary ? 400 : 500,
      }}>
      <span style={{ opacity: active ? 1 : secondary ? 0.6 : 0.8 }}>{icon}</span>
      <span className="flex-1">{children}</span>
      {badge != null && badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center"
          style={{ background: active ? 'rgba(255,255,255,0.25)' : '#FEE2E2', color: active ? '#fff' : '#DC2626' }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}
function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  )
}
function InboxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
    </svg>
  )
}
function LibraryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  )
}
function PartnerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )
}
