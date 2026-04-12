import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

export default async function AdminPage() {
  const admin = createAdminClient()

  const [
    { count: totalTemplates },
    { count: publishedTemplates },
    { count: totalUsers },
    { count: totalSites },
  ] = await Promise.all([
    admin.from('templates').select('*', { count: 'exact', head: true }),
    admin.from('templates').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    admin.from('users').select('*', { count: 'exact', head: true }),
    admin.from('user_sites').select('*', { count: 'exact', head: true }).eq('status', 'published'),
  ])

  const stats = [
    { label: 'Templates gesamt', value: totalTemplates ?? 0, color: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    { label: 'Veröffentlicht', value: publishedTemplates ?? 0, color: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
    { label: 'Nutzer', value: totalUsers ?? 0, color: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
    { label: 'Aktive Seiten', value: totalSites ?? 0, color: '#FDF2F8', text: '#DB2777', border: '#FBCFE8' },
  ]

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Admin-Übersicht</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Systemweite Statistiken und Verwaltung.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="p-5 rounded-[24px] bg-white"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
            <div className="text-3xl font-bold mb-1" style={{ color: stat.text }}>{stat.value}</div>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { href: '/admin/templates/new', label: 'Neues Template erstellen', icon: '➕', desc: 'Template hochladen und Felder definieren' },
          { href: '/admin/templates', label: 'Templates verwalten', icon: '📐', desc: 'Alle Templates bearbeiten und veröffentlichen' },
          { href: '/admin/users', label: 'Nutzer verwalten', icon: '👥', desc: 'Nutzerübersicht und Account-Details' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="flex items-center gap-4 p-5 rounded-[24px] bg-white transition-all"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
            <div className="w-12 h-12 rounded-[16px] flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: '#F3F4F6' }}>
              {item.icon}
            </div>
            <div>
              <div className="font-medium text-gray-900 text-sm">{item.label}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{item.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
