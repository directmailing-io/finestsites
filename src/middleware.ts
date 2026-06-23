import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const WORKER_URL = 'https://finestsites-worker.finestsites.workers.dev'
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'info@daniel-kurzeja.de'

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
    host.endsWith('.finestsites.io') ||
    host === 'finestsites.io' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0'
  )
}

export async function middleware(request: NextRequest) {
  // Health check — always pass through regardless of host
  if (request.nextUrl.pathname === '/api/health') return NextResponse.next()

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

  const { pathname } = request.nextUrl

  // Skip session check entirely for API routes — they handle their own auth.
  // This prevents a redundant DB round-trip (and potential hang) in middleware
  // for every POST to /api/auth/sign-in, /api/sites, etc.
  if (pathname.startsWith('/api/')) return NextResponse.next()

  // BetterAuth session check — wrap in try/catch so a transient DB failure
  // doesn't crash the middleware and cause a 524 timeout for every visitor.
  // Also race against a 5-second timeout so a slow DB never blocks page loads.
  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    session = await Promise.race([
      auth.api.getSession({ headers: request.headers }),
      new Promise<null>((resolve) => {
        controller.signal.addEventListener('abort', () => resolve(null))
      }),
    ])
    clearTimeout(timeoutId)
  } catch {
    // DB temporarily unavailable — fail open for public routes, block protected
    session = null
  }
  const user = session?.user ?? null

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

    let profile: { username: string | null; subscriptionStatus: string | null; stripeSubscriptionId: string | null } | null = null
    try {
      profile = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { username: true, subscriptionStatus: true, stripeSubscriptionId: true },
      }) ?? null
    } catch {
      // DB temporarily unavailable — let the request through, layout will re-check
      return NextResponse.next()
    }

    // Active subscription = valid status (no stripeSubscriptionId required for manual/admin activations)
    const hasActiveSubscription =
      !!profile?.subscriptionStatus &&
      ACTIVE_STATUSES.includes(profile.subscriptionStatus)

    // Allow fresh Stripe checkout sessions through before webhook fires
    const hasSessionId = !!request.nextUrl.searchParams.get('session_id')

    if (!hasActiveSubscription && !hasSessionId) {
      return NextResponse.redirect(new URL('/onboarding/plan', request.url))
    }

    if (!profile?.username && !pathname.startsWith('/onboarding/username')) {
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
