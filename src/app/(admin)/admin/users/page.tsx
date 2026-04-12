import { createAdminClient } from '@/lib/supabase/admin'

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  starter: { bg: '#EFF6FF', text: '#1D4ED8' },
  pro: { bg: '#F5F3FF', text: '#7C3AED' },
  unlimited: { bg: '#F0FDF4', text: '#16A34A' },
}

export default async function AdminUsersPage() {
  const admin = createAdminClient()
  const { data: users } = await admin
    .from('users')
    .select('id, email, username, plan, billing_interval, subscription_status, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Nutzer</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {users?.length ?? 0} registrierte Nutzer
        </p>
      </div>

      <div className="rounded-[24px] bg-white overflow-hidden"
        style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>

        {/* Table header */}
        <div className="grid grid-cols-5 gap-4 px-6 py-3 text-xs font-medium"
          style={{ background: '#F9FAFB', borderBottom: '1px solid var(--border)', color: '#6B7280' }}>
          <span>Nutzer</span>
          <span>Username</span>
          <span>Plan</span>
          <span>Status</span>
          <span>Registriert</span>
        </div>

        {/* Rows */}
        {users?.map((user: any) => {
          const planColor = PLAN_COLORS[user.plan] ?? PLAN_COLORS.starter
          const isActive = user.subscription_status === 'active'
          return (
            <div key={user.id}
              className="grid grid-cols-5 gap-4 px-6 py-4 text-sm items-center"
              style={{ borderBottom: '1px solid #F3F4F6' }}>
              <span className="text-gray-900 truncate">{user.email}</span>
              <span className="font-mono text-xs text-gray-500">
                {user.username ?? <span className="italic text-gray-400">nicht gesetzt</span>}
              </span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full inline-block w-fit"
                style={{ background: planColor.bg, color: planColor.text }}>
                {user.plan}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full inline-block w-fit"
                style={{
                  background: isActive ? '#F0FDF4' : '#FEF2F2',
                  color: isActive ? '#16A34A' : '#DC2626',
                }}>
                {isActive ? 'aktiv' : user.subscription_status ?? 'inaktiv'}
              </span>
              <span style={{ color: 'var(--muted-foreground)' }}>
                {new Date(user.created_at).toLocaleDateString('de-DE')}
              </span>
            </div>
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
