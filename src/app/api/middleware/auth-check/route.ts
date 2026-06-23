import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Internal endpoint used ONLY by the Next.js middleware.
 *
 * Middleware runs in Edge Runtime where `postgres`/`pg` cannot make real TCP
 * connections, so we cannot call auth.api.getSession() or db.query directly
 * from middleware.ts. Instead, middleware fetches THIS endpoint (which runs in
 * Node.js runtime, where the database driver works fine) to get session + profile
 * data in a single round-trip.
 *
 * Returns: { user: AuthUser | null, profile: { username, subscriptionStatus, stripeSubscriptionId } | null }
 */
export async function GET(req: NextRequest) {
  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null
  try {
    session = await auth.api.getSession({ headers: req.headers })
  } catch {
    return NextResponse.json({ user: null, profile: null })
  }

  if (!session?.user) {
    return NextResponse.json({ user: null, profile: null })
  }

  let profile: { username: string | null; subscriptionStatus: string | null; stripeSubscriptionId: string | null } | null = null
  try {
    profile = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { username: true, subscriptionStatus: true, stripeSubscriptionId: true },
    }) ?? null
  } catch {
    // DB error getting profile — return user without profile; middleware will fail-open
  }

  return NextResponse.json({ user: session.user, profile })
}
