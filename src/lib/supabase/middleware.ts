import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Subscription statuses that allow access to the product
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // ── Logged-in + visiting auth pages → home ───────────────────────
  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/sites', request.url))
  }

  // ── Not logged in + protected routes → login ─────────────────────
  const protectedPaths = ['/dashboard', '/sites', '/settings', '/admin', '/onboarding', '/billing']
  if (!user && protectedPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── Logged-in + product routes → enforce subscription + username ──
  // Includes /onboarding/username to prevent bypassing payment via direct URL
  const ADMIN_EMAIL = 'info@daniel-kurzeja.de'
  const gatedPaths = ['/dashboard', '/sites', '/settings', '/billing', '/onboarding/username']
  if (user && gatedPaths.some(p => pathname.startsWith(p))) {
    // Owner/admin account bypasses all subscription and username requirements
    if (user.email === ADMIN_EMAIL) return supabaseResponse

    const { data: profile } = await supabase
      .from('users')
      .select('username, subscription_status, stripe_subscription_id')
      .eq('id', user.id)
      .single()

    // A subscription is only real if BOTH the status is active AND a Stripe subscription ID exists.
    // This prevents the DB DEFAULT 'active' from granting access to users who never paid.
    const hasActiveSubscription =
      !!profile?.subscription_status &&
      ACTIVE_STATUSES.includes(profile.subscription_status) &&
      !!profile?.stripe_subscription_id

    // Special case: user arriving from Stripe checkout with session_id.
    // The webhook may not have fired yet — let the page/API handler verify directly
    // with Stripe before we block them. Applies to ALL gated paths (onboarding and
    // settings upgrades both use session_id in their success URLs).
    const hasSessionId = !!request.nextUrl.searchParams.get('session_id')

    // No active subscription and not coming from a fresh Stripe session → payment wall
    if (!hasActiveSubscription && !hasSessionId) {
      return NextResponse.redirect(new URL('/onboarding/plan', request.url))
    }

    // Has subscription but no username → must complete username setup
    if (hasActiveSubscription && !profile?.username && !pathname.startsWith('/onboarding/username')) {
      return NextResponse.redirect(new URL('/onboarding/username', request.url))
    }
  }

  return supabaseResponse
}
