import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { passwordResetEmail } from '@/lib/email/templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://finestsites.vercel.app'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'E-Mail erforderlich.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Generate password reset link — always return success (don't reveal if email exists)
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${APP_URL}/update-password`,
    },
  })

  if (linkData?.properties?.action_link) {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Passwort zurücksetzen – FinestSites',
      html: passwordResetEmail({ url: linkData.properties.action_link }),
    })
  }

  // Always return 200 — don't reveal whether the email exists
  return NextResponse.json({ success: true })
}
