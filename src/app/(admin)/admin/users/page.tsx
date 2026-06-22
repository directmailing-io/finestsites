import { db } from '@/lib/db'
import { users, userSites } from '@/lib/db/schema'
import { desc, inArray } from 'drizzle-orm'
import Link from 'next/link'

const PLAN_META: Record<string, { label: string; bg: string; text: string }> = {
  starter:   { label: 'Starter',   bg: '#EFF6FF', text: '#1D4ED8' },
  pro:       { label: 'Pro',        bg: '#F5F3FF', text: '#6D28D9' },
  unlimited: { label: 'Unlimited', bg: '#ECFDF5', text: '#065F46' },
}

const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active:   { label: 'Aktiv',     bg: '#F0FDF4', text: '#16A34A', dot: '#22C55E' },
  trialing: { label: 'Trial',     bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
  past_due: { label: 'Überfällig',bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
  canceled: { label: 'Gekündigt', bg: '#F9FAFB', text: '#6B7280', dot: '#D1D5DB' },
}

export default async function AdminUsersPage() {
  const [allUsers, allSites] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        plan: users.plan,
        billingInterval: users.billingInterval,
        subscriptionStatus: users.subscriptionStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt)),
    db
      .select({
        userId: userSites.userId,
        status: userSites.status,
        customDomain: userSites.customDomain,
        customDomainStatus: userSites.customDomainStatus,
      })
      .from(userSites)
      .where(inArray(userSites.status, ['draft', 'published'])),
  ])

  // Count published sites per user + collect active custom domains
  const siteCountByUser: Record<string, number> = {}
  const customDomainByUser: Record<string, string[]> = {}
  for (const site of allSites) {
    if (site.status === 'published') {
      siteCountByUser[site.userId] = (siteCountByUser[site.userId] ?? 0) + 1
    }
    if (site.customDomain && site.customDomainStatus === 'active') {
      customDomainByUser[site.userId] = customDomainByUser[site.userId] ?? []
      customDomainByUser[site.userId].push(site.customDomain)
    }
  }

  const activeCount = allUsers.filter(u => u.subscriptionStatus === 'active').length

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Nutzer</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            {allUsers.length} registriert · {activeCount} aktive Abos
          </p>
        </div>
      </div>

      {/* ── Mobile Cards (below lg) ── */}
      <div className="block lg:hidden">
        {allUsers.map((user) => {
          const planMeta   = PLAN_META[user.plan]   ?? PLAN_META.starter
          const statusMeta = STATUS_META[user.subscriptionStatus ?? ''] ?? null
          const siteCount  = siteCountByUser[user.id] ?? 0
          const initials   = user.email.slice(0, 2).toUpperCase()
          const dateStr    = new Date(user.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
          return (
            <Link key={user.id} href={`/admin/users/${user.id}`}
              className="flex flex-col gap-3 p-4 mb-3 rounded-2xl bg-white active:bg-gray-50"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>

              {/* Top row: avatar + email + chevron */}
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: planMeta.bg, color: planMeta.text }}>
                  {initials}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900">{user.email}</span>
                  <span className="block text-xs font-mono" style={{ color: '#94A3B8' }}>
                    {user.username ? `@${user.username}` : <span className="italic" style={{ color: '#CBD5E1' }}>kein Username</span>}
                  </span>
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" className="flex-shrink-0">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>

              {/* Bottom row: badges + site count + date */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: planMeta.bg, color: planMeta.text }}>
                  {planMeta.label}
                </span>
                {statusMeta && (
                  <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: statusMeta.bg, color: statusMeta.text }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusMeta.dot }} />
                    {statusMeta.label}
                  </span>
                )}
                {siteCount > 0 && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: '#F0FDF4', color: '#16A34A' }}>
                    {siteCount} {siteCount === 1 ? 'Seite' : 'Seiten'}
                  </span>
                )}
                <span className="ml-auto text-xs tabular-nums" style={{ color: '#CBD5E1' }}>{dateStr}</span>
              </div>
            </Link>
          )
        })}

        {allUsers.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: '#F1F5F9' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.75">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">Noch keine Nutzer registriert</p>
          </div>
        )}
      </div>

      {/* ── Desktop Table (lg and above) ── */}
      <div className="hidden lg:block rounded-[20px] bg-white overflow-hidden"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #F1F5F9' }}>

        {/* Header row */}
        <div className="grid px-6 py-3 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            gridTemplateColumns: '2fr 1.2fr 0.9fr 1.1fr 1.4fr 0.7fr 0.6fr 28px',
            background: '#F8FAFC',
            borderBottom: '1px solid #F1F5F9',
            color: '#94A3B8',
          }}>
          <span>Nutzer</span>
          <span>Username</span>
          <span>Plan</span>
          <span>Status</span>
          <span>Domain</span>
          <span className="text-center">Seiten</span>
          <span>Seit</span>
          <span />
        </div>

        {/* Rows */}
        {allUsers.map((user) => {
          const planMeta   = PLAN_META[user.plan]   ?? PLAN_META.starter
          const statusMeta = STATUS_META[user.subscriptionStatus ?? ''] ?? null
          const siteCount  = siteCountByUser[user.id] ?? 0
          const initials   = user.email.slice(0, 2).toUpperCase()

          const userCustomDomains = customDomainByUser[user.id] ?? []
          return (
            <Link key={user.id} href={`/admin/users/${user.id}`}
              className="grid px-6 py-3.5 text-sm items-center transition-colors hover:bg-gray-50 group"
              style={{
                gridTemplateColumns: '2fr 1.2fr 0.9fr 1.1fr 1.4fr 0.7fr 0.6fr 28px',
                borderBottom: '1px solid #F8FAFC',
              }}>

              {/* Email + avatar */}
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: planMeta.bg, color: planMeta.text }}>
                  {initials}
                </span>
                <span className="truncate text-sm font-medium text-gray-900">{user.email}</span>
              </span>

              {/* Username */}
              <span className="font-mono text-xs truncate" style={{ color: '#64748B' }}>
                {user.username
                  ? <span>@{user.username}</span>
                  : <span className="italic" style={{ color: '#CBD5E1' }}>nicht gesetzt</span>}
              </span>

              {/* Plan badge */}
              <span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block"
                  style={{ background: planMeta.bg, color: planMeta.text }}>
                  {planMeta.label}
                </span>
              </span>

              {/* Status */}
              <span>
                {statusMeta ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full w-fit"
                    style={{ background: statusMeta.bg, color: statusMeta.text }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusMeta.dot }} />
                    {statusMeta.label}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                )}
              </span>

              {/* Custom domain */}
              <span className="min-w-0">
                {userCustomDomains.length > 0 ? (
                  <span className="flex items-center gap-1 text-xs font-mono truncate" style={{ color: '#16A34A' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
                      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    <span className="truncate">{userCustomDomains[0]}</span>
                    {userCustomDomains.length > 1 && (
                      <span className="flex-shrink-0 text-[10px] px-1 rounded" style={{ background: '#DCFCE7', color: '#166534' }}>
                        +{userCustomDomains.length - 1}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                )}
              </span>

              {/* Sites count */}
              <span className="flex justify-center">
                {siteCount > 0 ? (
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: '#F0FDF4', color: '#16A34A' }}>
                    {siteCount}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                )}
              </span>

              {/* Date */}
              <span className="text-xs" style={{ color: '#94A3B8' }}>
                {new Date(user.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </span>

              {/* Arrow */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="#CBD5E1" strokeWidth="2"
                className="transition-colors group-hover:stroke-gray-400">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </Link>
          )
        })}

        {allUsers.length === 0 && (
          <div className="px-6 py-16 text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: '#F1F5F9' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.75">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">Noch keine Nutzer registriert</p>
          </div>
        )}

      </div>
    </div>
  )
}
