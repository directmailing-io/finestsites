import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  starter: { bg: '#EFF6FF', text: '#1D4ED8' },
  pro: { bg: '#F5F3FF', text: '#7C3AED' },
  unlimited: { bg: '#F0FDF4', text: '#16A34A' },
}

export default async function AdminUsersPage() {
  const admin = createAdminClient()

  const [{ data: users }, { data: allSites }] = await Promise.all([
    admin
      .from('users')
      .select('id, email, username, plan, billing_interval, subscription_status, created_at')
      .order('created_at', { ascending: false }),
    admin
      .from('user_sites')
      .select('user_id, status, username, templates(title, domain)')
      .eq('status', 'published'),
  ])

  // Build map userId → published sites
  const sitesByUser: Record<string, Array<{ username: string; domain: string; title: string }>> = {}
  for (const site of allSites ?? []) {
    const tpl = (Array.isArray(site.templates) ? site.templates[0] : site.templates) as { title: string; domain: string } | null
    if (!site.username || !tpl?.domain) continue
    if (!sitesByUser[site.user_id]) sitesByUser[site.user_id] = []
    sitesByUser[site.user_id].push({ username: site.username, domain: tpl.domain, title: tpl.title })
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Nutzer</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {users?.length ?? 0} registrierte Nutzer
        </p>
      </div>

      <div className="rounded-[24px] bg-white overflow-hidden"
        style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>

        {/* Table header */}
        <div className="grid gap-4 px-6 py-3 text-xs font-medium"
          style={{ gridTemplateColumns: '1.2fr 1fr 0.8fr 0.8fr 2fr 0.8fr auto', background: '#F9FAFB', borderBottom: '1px solid var(--border)', color: '#6B7280' }}>
          <span>Nutzer</span>
          <span>Username</span>
          <span>Plan</span>
          <span>Status</span>
          <span>Aktive Websites</span>
          <span>Registriert</span>
          <span />
        </div>

        {/* Rows */}
        {users?.map((user: any) => {
          const planColor = PLAN_COLORS[user.plan] ?? PLAN_COLORS.starter
          const isActive = user.subscription_status === 'active'
          const publishedSites = sitesByUser[user.id] ?? []
          return (
            <Link key={user.id} href={`/admin/users/${user.id}`}
              className="grid gap-4 px-6 py-4 text-sm items-start transition-colors hover:bg-gray-50"
              style={{ gridTemplateColumns: '1.2fr 1fr 0.8fr 0.8fr 2fr 0.8fr auto', borderBottom: '1px solid #F3F4F6' }}>
              <span className="text-gray-900 truncate pt-0.5">{user.email}</span>
              <span className="font-mono text-xs text-gray-500 pt-0.5">
                {user.username ?? <span className="italic text-gray-400">nicht gesetzt</span>}
              </span>
              <span className="pt-0.5">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full inline-block"
                  style={{ background: planColor.bg, color: planColor.text }}>
                  {user.plan}
                </span>
              </span>
              <span className="pt-0.5">
                <span className="text-xs px-2.5 py-1 rounded-full inline-block"
                  style={{
                    background: isActive ? '#F0FDF4' : '#FEF2F2',
                    color: isActive ? '#16A34A' : '#DC2626',
                  }}>
                  {isActive ? 'aktiv' : user.subscription_status ?? 'inaktiv'}
                </span>
              </span>

              {/* Active sites */}
              <span className="flex flex-col gap-1">
                {publishedSites.length === 0 ? (
                  <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>
                ) : (
                  publishedSites.map(site => (
                    <span key={`${site.username}.${site.domain}`}
                      className="inline-flex items-center gap-1 text-xs font-mono"
                      style={{ color: '#2563EB' }}
                      onClick={e => { e.preventDefault(); window.open(`https://${site.username}.${site.domain}`, '_blank') }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                      </svg>
                      {site.username}.{site.domain}
                    </span>
                  ))
                )}
              </span>

              <span className="text-xs pt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {new Date(user.created_at).toLocaleDateString('de-DE')}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" className="mt-0.5">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Link>
          )
        })}

        {(!users || users.length === 0) && (
          <div className="px-6 py-12 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Noch keine Nutzer registriert.
          </div>
        )}
      </div>
    </div>
  )
}
