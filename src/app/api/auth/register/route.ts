import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { verificationEmail } from '@/lib/email/templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://finestsites.vercel.app'

export async function POST(req: NextRequest) {
  const { email, password, referral_code } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'E-Mail und Passwort erforderlich.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Passwort muss mindestens 8 Zeichen haben.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Validate referral code if provided
  let validatedReferralCode: string | null = null
  if (referral_code) {
    const { data: referrer } = await admin
      .from('users')
      .select('username')
      .eq('username', referral_code.toLowerCase().trim())
      .single()
    if (referrer) validatedReferralCode = referrer.username
  }

  // Check if email already registered
  const { data: existing } = await admin.auth.admin.listUsers()
  if (existing?.users?.some(u => u.email === email)) {
    return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 409 })
  }

  // Create unconfirmed user + generate verification link in one call
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      redirectTo: `${APP_URL}/onboarding/plan`,
      data: validatedReferralCode ? { referred_by_username: validatedReferralCode } : {},
    },
  })

  if (linkError) {
    console.error('[register] generateLink error:', linkError.message)
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen.' }, { status: 500 })
  }

  const confirmUrl = linkData.properties?.action_link
  if (!confirmUrl) {
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen.' }, { status: 500 })
  }

  // If referral code valid and user was created, store referred_by_username
  if (validatedReferralCode && linkData.user?.id) {
    await admin.from('users')
      .upsert({ id: linkData.user.id, email, referred_by_username: validatedReferralCode }, { onConflict: 'id' })
    // Also store in auth metadata as fallback
    await admin.auth.admin.updateUserById(linkData.user.id, {
      user_metadata: { referred_by_username: validatedReferralCode },
    })
  }

  // Send branded verification email
  const { error: emailError } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Bitte bestätige deine E-Mail-Adresse – FinestSites',
    html: verificationEmail({ url: confirmUrl }),
  })

  if (emailError) {
    console.error('[register] Resend error:', emailError)
  }

  return NextResponse.json({ success: true })
}
