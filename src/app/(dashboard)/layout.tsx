import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardSidebar } from '@/components/dashboard/Sidebar'
import { MobileNav } from '@/components/dashboard/MobileNav'
import { PlanQuotaProvider } from '@/components/dashboard/PlanQuotaContext'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('username, subscription_status')
    .eq('id', user.id)
    .single()

  // Must have an active subscription before accessing dashboard
  // Exception: the owner/admin account bypasses this check entirely
  const ADMIN_EMAIL = 'daniel-kurzeja@live.de'
  const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
  if (user.email !== ADMIN_EMAIL && (!profile?.subscription_status || !ACTIVE_STATUSES.includes(profile.subscription_status))) {
    redirect('/onboarding/plan')
  }

  // Must have completed username setup
  if (!profile?.username) {
    redirect('/onboarding/username')
  }

  return (
    <PlanQuotaProvider>
      <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
        <DashboardSidebar />
        <main className="flex-1 min-w-0 px-5 pt-6 pb-28 sm:px-8 sm:pt-8 sm:pb-28 lg:px-12 lg:py-10">
          {children}
        </main>
        <MobileNav />
      </div>
    </PlanQuotaProvider>
  )
}
