import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'E-Mail erforderlich.' }, { status: 400 })
  }

  // Forward to BetterAuth's internal handler for password reset.
  // BetterAuth v1 uses "request-password-reset" (not "forget-password").
  // Always return 200 — don't reveal whether the email exists.
  try {
    const internalReq = new Request(
      new URL('/api/auth/request-password-reset', APP_URL),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          redirectTo: `${APP_URL}/update-password`,
        }),
      }
    )
    await auth.handler(internalReq)
  } catch {
    // Silently ignore — never reveal whether the email exists
  }

  return NextResponse.json({ success: true })
}
