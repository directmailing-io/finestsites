import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const WORKER_URL = 'https://finestsites-worker.finestsites.workers.dev'
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'daniel-kurzeja@live.de'

// Hostnames that belong to us — let these pass through to the Next.js app normally
function isOwnHost(host: string): boolean {
  return (
    host.endsWith('.vercel.app') ||
    host.endsWith('.womenplus.io') ||
    host === 'womenplus.io' ||
    host.endsWith('.finestsites.com') ||
    host === 'finestsites.com' ||
    host.endsWith('.finestsites.de') ||
    host === 'finestsites.de' ||
    host === 'localhost'
  )
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()

  // Custom user domain (e.g. www.daniel-kurzeja.de) → proxy to Worker
  if (!isOwnHost(host)) {
    const workerUrl = `${WORKER_URL}${request.nextUrl.pathname}${request.nextUrl.search}`
    try {
      const forwardHeaders = new Headers(request.headers)
      forwardHeaders.delete('host')
      forwardHeaders.set('x-forwarded-host', host)

      const res = await fetch(workerUrl, {
        method: request.method,
        headers: forwardHeaders,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        // @ts-expect-error — duplex needed for streaming request bodies
        duplex: 'half',
      })

      const responseHeaders = new Headers(res.headers)
      responseHeaders.delete('transfer-encoding')
      responseHeaders.delete('connection')

      return new NextResponse(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
      })
    } catch {
      return new NextResponse('Gateway error', { status: 502 })
    }
  }

  // BetterAuth session check (replaces Supabase updateSession)
  const session = await auth.api.getSession({ headers: request.headers })
  const user = session?.user ?? null
  const { pathname } = request.nextUrl

  // Logged-in + visiting auth pages → redirect to app
  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/sites', request.url))
  }

  // Not logged in + protected routes → login
  const protectedPaths = ['/dashboard', '/sites', '/settings', '/admin', '/onboarding', '/billing']
  if (!user && protectedPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged-in + product routes → enforce subscription + username
  const gatedPaths = ['/dashboard', '/sites', '/settings', '/billing', '/onboarding/username']
  if (user && gatedPaths.some(p => pathname.startsWith(p))) {
    // Admin bypasses all checks
    if (user.email === ADMIN_EMAIL) return NextResponse.next()

    const profile = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { username: true, subscriptionStatus: true, stripeSubscriptionId: true },
    })

    const hasActiveSubscription =
      !!profile?.subscriptionStatus &&
      ACTIVE_STATUSES.includes(profile.subscriptionStatus) &&
      !!profile?.stripeSubscriptionId

    // Allow fresh Stripe checkout sessions through before webhook fires
    const hasSessionId = !!request.nextUrl.searchParams.get('session_id')

    if (!hasActiveSubscription && !hasSessionId) {
      return NextResponse.redirect(new URL('/onboarding/plan', request.url))
    }

    if (hasActiveSubscription && !profile?.username && !pathname.startsWith('/onboarding/username')) {
      return NextResponse.redirect(new URL('/onboarding/username', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
