'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/shared/Logo'

const navItems = [
  {
    href: '/admin',
    label: 'Übersicht',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/>
        <rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>
      </svg>
    ),
  },
  {
    href: '/admin/templates',
    label: 'Templates',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
    ),
  },
  {
    href: '/admin/users',
    label: 'Nutzer',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/admin/affiliate',
    label: 'Affiliate',
    icon: (active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
  {
    href: '/admin/newsletter',
    label: 'Newsletter',
    icon: (_active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
  {
    href: '/admin/warteliste',
    label: 'Warteliste',
    icon: (_active: boolean) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
    ),
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex w-[240px] flex-col flex-shrink-0 p-4 gap-2"
      style={{ borderRight: '1px solid var(--border)', background: '#FFFFFF', minHeight: '100vh' }}>

      <div className="px-3 py-4 mb-1">
        <Logo variant="black" height={22} />
        <div className="mt-2 px-0">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: '#FEF9C3', color: '#92400E' }}>
            Admin
          </span>
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = item.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all rounded-[14px]"
              style={{
                color: isActive ? '#1a1a1a' : '#6B7280',
                background: isActive ? '#F3F4F6' : 'transparent',
              }}>
              <span style={{ color: isActive ? '#1a1a1a' : '#9CA3AF' }}>
                {item.icon(isActive)}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <Link href="/sites"
          className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-[14px] transition-all"
          style={{ color: '#6B7280' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Zur Webseite
        </Link>
      </div>
    </aside>
  )
}
