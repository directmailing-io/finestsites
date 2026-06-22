import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminMobileNav } from '@/components/admin/AdminMobileNav'
import { getServerUser } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isAdmin: true },
  })
  if (!profile?.isAdmin) redirect('/sites')

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      <AdminSidebar />
      <main className="flex-1 min-w-0 p-6 lg:p-8 pb-28 lg:pb-8">
        {children}
      </main>
      <AdminMobileNav />
    </div>
  )
}
