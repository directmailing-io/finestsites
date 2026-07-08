import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { users, impersonationRequests } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'

/**
 * Drop-in replacement for the Supabase pattern:
 *   const supabase = await createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 */
export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() })
}

// ── Impersonation helpers ───────────────────────────────────────────────────

/** Resolves an impersonation token to the target user (status must be 'active' and not expired). */
async function resolveImpersonationToken(token: string) {
  const record = await db.query.impersonationRequests.findFirst({
    where: and(
      eq(impersonationRequests.token, token),
      eq(impersonationRequests.status, 'active'),
      gt(impersonationRequests.expiresAt, new Date()),
    ),
  })
  if (!record) return null

  const user = await db.query.users.findFirst({ where: eq(users.id, record.userId) })
  if (!user) return null

  // Return a shape compatible with BetterAuth's session.user
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    image: user.image ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

function parseImpersonationCookie(cookieHeader: string): string | null {
  const match = cookieHeader.match(/(?:^|;\s*)fs-impersonation=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

/** Returns current impersonation state for server components (e.g. dashboard layout). */
export async function getImpersonationState(): Promise<{
  adminId: string
  adminEmail: string
  userId: string
  username: string | null
} | null> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const token = cookieStore.get('fs-impersonation')?.value
  if (!token) return null

  const record = await db.query.impersonationRequests.findFirst({
    where: and(
      eq(impersonationRequests.token, token),
      eq(impersonationRequests.status, 'active'),
      gt(impersonationRequests.expiresAt, new Date()),
    ),
  })
  if (!record) return null

  const [adminUser, targetUser] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, record.adminId), columns: { email: true } }),
    db.query.users.findFirst({ where: eq(users.id, record.userId), columns: { username: true } }),
  ])

  return {
    adminId: record.adminId,
    adminEmail: adminUser?.email ?? '',
    userId: record.userId,
    username: targetUser?.username ?? null,
  }
}

// ── Public auth helpers ─────────────────────────────────────────────────────

export async function getServerUser() {
  // Check impersonation cookie first (server component context)
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const token = cookieStore.get('fs-impersonation')?.value
  if (token) {
    const impersonated = await resolveImpersonationToken(token)
    if (impersonated) return impersonated
  }

  const session = await getServerSession()
  return session?.user ?? null
}

/** For API routes that receive a NextRequest / Request */
export async function getSessionFromRequest(req: Request) {
  return auth.api.getSession({ headers: req.headers })
}

export async function getUserFromRequest(req: Request) {
  // Check impersonation cookie (HTTP-only, sent with every request)
  const cookieHeader = req.headers.get('cookie') ?? ''
  const token = parseImpersonationCookie(cookieHeader)
  if (token) {
    const impersonated = await resolveImpersonationToken(token)
    if (impersonated) return impersonated
  }

  const session = await getSessionFromRequest(req)
  return session?.user ?? null
}

/**
 * Returns the REAL logged-in user, bypassing any impersonation cookie.
 * Use in routes that require verifying the actual admin identity
 * (e.g. entering/exiting impersonation).
 */
export async function getRealUserFromRequest(req: Request) {
  const session = await getSessionFromRequest(req)
  return session?.user ?? null
}
