'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Logo } from '@/components/shared/Logo'
import { signOut } from '@/lib/auth/client'
import { useRouter } from 'next/navigation'
import { usePlanQuota } from '@/components/dashboard/PlanQuotaContext'

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const quota = usePlanQuota()

  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetch('/api/submissions/unread-count')
      .then(r => r.json())
      .then(data => setUnreadCount(data.count ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (pathname.startsWith('/submissions')) {
      // defer to avoid synchronous setState in effect
      const id = setTimeout(() => setUnreadCount(0), 0)
      return () => clearTimeout(id)
    }
  }, [pathname])

  async function handleLogout() {
    await signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/sites') return pathname === '/sites' || pathname.startsWith('/sites/')
    return pathname.startsWith(href)
  }

  const PLAN_LABELS: Record<string, string> = { starter: 'Starter', pro: 'Pro', unlimited: 'Unlimited', secret: 'Secret' }

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
        {quota.plan && quota.plan !== 'unlimited' && !quota.loading && (
          <div className="relative group mb-1">
            <Link
              href="/billing"
              className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors hover:bg-gray-100"
              style={{ background: quota.atLimit ? '#FEF2F2' : '#F3F4F6' }}>
              <span className="text-xs font-medium" style={{ color: quota.atLimit ? '#DC2626' : '#6B7280' }}>
                {quota.atLimit ? 'Limit erreicht' : PLAN_LABELS[quota.plan]}
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: quota.atLimit ? '#FCA5A5' : '#E5E7EB', color: quota.atLimit ? '#991B1B' : '#374151' }}>
                {quota.atLimit ? 'Upgrade →' : `${quota.used} / ${quota.limit}`}
              </span>
            </Link>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-xl text-xs text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
              style={{ background: '#1a1a1a' }}>
              {quota.used} von {quota.limit} {quota.used === 1 ? 'Webseite' : 'Webseiten'} aktiv
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: '#1a1a1a' }} />
            </div>
          </div>
        )}

        {/* Support Chat Card */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('openSupportChat'))}
          className="w-full text-left mb-2 rounded-2xl overflow-hidden relative group"
          style={{ border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
        >
          <div style={{
            position: 'relative', borderRadius: 16, overflow: 'hidden',
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
            padding: '12px 14px 0',
          }}>
            {/* Text area */}
            <div style={{ paddingBottom: 100 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#22C55E',
                  boxShadow: '0 0 0 2px rgba(34,197,94,0.3)',
                }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#86EFAC', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live Support</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 0 2px', lineHeight: 1.3 }}>
                Wir helfen dir gerne!
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.4 }}>
                Chat starten →
              </p>
            </div>
            {/* Image absolutely positioned bottom-right */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/support-team.jpg"
              alt="Support Team"
              style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 120, height: 90,
                objectFit: 'cover', objectPosition: 'center top',
                maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 40%, transparent 100%)',
              }}
            />
            {/* Hover overlay */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 16,
              background: 'rgba(255,255,255,0)',
              transition: 'background 0.15s',
              pointerEvents: 'none',
            }} className="group-hover:bg-white/5" />
          </div>
        </button>

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
