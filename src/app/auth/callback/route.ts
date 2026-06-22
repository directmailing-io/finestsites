import { NextRequest, NextResponse } from 'next/server'

// This route previously handled Supabase OAuth callbacks.
// BetterAuth handles all auth callbacks via /api/auth/[...all].
// Redirect any lingering requests to /sites or /login.
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)
  const next = request.nextUrl.searchParams.get('next') ?? '/sites'
  return NextResponse.redirect(`${origin}${next}`)
}
