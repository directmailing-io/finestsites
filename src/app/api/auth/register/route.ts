import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const { email, password, referral_code } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'E-Mail und Passwort erforderlich.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen haben.' }, { status: 400 })
  }

  // Validate referral code if provided
  let validatedReferralCode: string | null = null
  if (referral_code) {
    const referrer = await db.query.users.findFirst({
      where: eq(users.username, referral_code.toLowerCase().trim()),
      columns: { username: true },
    })
    if (referrer?.username) validatedReferralCode = referrer.username
  }

  // Check if email already registered
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim()),
    columns: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 409 })
  }

  // Register via BetterAuth — email verification email is sent automatically
  // via the sendVerificationEmail hook configured in src/lib/auth/index.ts
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://finestsites.vercel.app'
  const result = await auth.api.signUpEmail({
    body: {
      email: email.toLowerCase().trim(),
      password,
      name: '',
      callbackURL: `${APP_URL}/onboarding/plan`,
    },
  })

  if (!result?.user?.id) {
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen.' }, { status: 500 })
  }

  // Store referral code on the new user row (created by BetterAuth's Drizzle adapter)
  if (validatedReferralCode) {
    await db.update(users)
      .set({ referredByUsername: validatedReferralCode })
      .where(eq(users.id, result.user.id))
  }

  return NextResponse.json({ success: true })
}
