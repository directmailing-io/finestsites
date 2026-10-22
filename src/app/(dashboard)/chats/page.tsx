import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { isVisitorChatEnabledForUser } from '@/lib/chat/flags'
import ChatsView from '@/components/chat/ChatsView'

export const metadata = { title: 'Chats – FinestSites' }

/**
 * Bereich „Chats“ (Besucher-Chat). Nur für freigeschaltete Konten – sonst 404,
 * damit der Bereich für alle anderen nicht existiert.
 */
export default async function ChatsPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  const enabled = await isVisitorChatEnabledForUser(user.id).catch(() => false)
  if (!enabled) notFound()

  return (
    <Suspense fallback={null}>
      <ChatsView />
    </Suspense>
  )
}
