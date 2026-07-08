import { redirect } from 'next/navigation'
import { getServerUser, getImpersonationState } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { DashboardSidebar } from '@/components/dashboard/Sidebar'
import { MobileNav } from '@/components/dashboard/MobileNav'
import { PlanQuotaProvider } from '@/components/dashboard/PlanQuotaContext'
import SupportChat from '@/components/support/SupportChat'
import ImpersonationBanner from '@/components/dashboard/ImpersonationBanner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, impersonation] = await Promise.all([getServerUser(), getImpersonationState()])

  if (!user) redirect('/login')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { username: true, subscriptionStatus: true },
  })

  const ADMIN_EMAIL = 'info@daniel-kurzeja.de'

  // Only enforce username setup — subscription is not required to use the dashboard.
  // The payment wall is at publish time (enforced in /api/sites/[id]/publish).
  if (!impersonation) {
    if (user.email !== ADMIN_EMAIL && !profile?.username) {
      redirect('/onboarding/username')
    }
  }

  return (
    <PlanQuotaProvider>
      <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
        <DashboardSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          {!impersonation && <ImpersonationBanner />}
          {impersonation && (
            <div style={{
              background: '#7C3AED',
              color: '#fff',
              padding: '8px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              fontSize: 13,
              fontWeight: 500,
              position: 'sticky',
              top: 0,
              zIndex: 100,
            }}>
              <span>
                Du siehst den Account von{' '}
                <strong>@{impersonation.username ?? impersonation.userId.slice(0, 8)}</strong>
                {' '} als Admin.
              </span>
              <form action="/api/impersonate/exit" method="POST">
                <button type="submit" style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: 8,
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                  Sitzung beenden
                </button>
              </form>
            </div>
          )}
          <main className="flex-1 px-5 pt-6 pb-32 sm:px-8 sm:pt-8 sm:pb-32 lg:px-12 lg:py-10">
            {children}
          </main>
        </div>
        <MobileNav />
        {!impersonation && <SupportChat />}
      </div>
    </PlanQuotaProvider>
  )
}
