import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

/**
 * Drop-in replacement for the Supabase pattern:
 *   const supabase = await createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 */
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function getServerUser() {
  const session = await getServerSession()
  return session?.user ?? null
}

/** For API routes that receive a NextRequest / Request */
export async function getSessionFromRequest(req: Request) {
  return auth.api.getSession({ headers: req.headers })
}

export async function getUserFromRequest(req: Request) {
  const session = await getSessionFromRequest(req)
  return session?.user ?? null
}
