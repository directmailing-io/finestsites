import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { UsernameForm } from './UsernameForm'

export default async function OnboardingUsernamePage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  })

  // Username already set — send to dashboard
  if (profile?.username) redirect('/sites')

  return <UsernameForm />
}
