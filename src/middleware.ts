import { NextResponse, type NextRequest } from 'next/server'

const WORKER_URL = 'https://finestsites-worker.finestsites.workers.dev'
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'info@daniel-kurzeja.de'

// Internal address for the auth-check endpoint (Node.js runtime, where postgres works).
// Middleware runs in Edge Runtime and cannot use the postgres driver directly.
const INTERNAL_PORT = process.env.PORT ?? '3002'
const AUTH_CHECK_URL = `http://127.0.0.1:${INTERNAL_PORT}/api/middleware/auth-check`

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
    // VPS hostnames — Cloudflare Workers cannot override the Host header in
    // subrequests (it always reflects the URL hostname), so when the s3redirects
    // CF Worker proxies app.finestsites.io → http://srv1554729.hstgr.cloud:3002
    // the Next.js server sees Host: srv1554729.hstgr.cloud, not app.finestsites.io.
    host.endsWith('.hstgr.cloud') ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0'
  )
}

export async function middleware(request: NextRequest) {
  // Health check — always pass through regardless of host
  if (request.nextUrl.pathname === '/api/health') return NextResponse.next()

  // Cloudflare Workers cannot override the Host header in subrequests — the Host
  // is always derived from the fetch() URL. Use X-Forwarded-Host (which our CF
  // Worker explicitly sets) as the authoritative host for routing decisions.
  const host = (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  ).split(':')[0].toLowerCase()

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
  // Also skip for the internal auth-check endpoint to avoid infinite loops.
  if (pathname.startsWith('/api/')) return NextResponse.next()

  // Fetch session + profile from internal Node.js endpoint.
  // We cannot call auth.api.getSession() or db.query directly from middleware because
  // middleware runs in Edge Runtime where the postgres driver cannot make TCP connections.
  // Instead we delegate to the auth-check API route (Node.js runtime) via loopback HTTP.
  let user: { id: string; email: string; [key: string]: unknown } | null = null
  let profile: { username: string | null; subscriptionStatus: string | null; stripeSubscriptionId: string | null } | null = null

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const authRes = await fetch(AUTH_CHECK_URL, {
      headers: request.headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (authRes.ok) {
      const data = await authRes.json() as { user: typeof user; profile: typeof profile }
      user = data.user
      profile = data.profile
    }
  } catch {
    // Auth check unavailable (timeout or server error) — fail open for public routes,
    // block access to protected routes to be safe.
    user = null
  }

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
