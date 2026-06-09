import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

function sanitize(val: string) {
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z-]/g, '')
    .replace(/^-+/, '')
    .slice(0, 30)
}

function isValid(u: string) {
  return /^[a-z][a-z-]*[a-z]$/.test(u) && u.length >= 3
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })

  const { username } = await req.json()
  const clean = sanitize(username ?? '')

  if (!isValid(clean)) {
    return NextResponse.json(
      { error: 'Ungültiger Username. Mindestens 3 Buchstaben a–z, Bindestriche erlaubt.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // ── Verify the user has an active subscription ────────────────────────
  const { data: profile } = await admin
    .from('users')
    .select('subscription_status, stripe_subscription_id, username')
    .eq('id', user.id)
    .single()

  // Require both a valid status AND a real Stripe subscription ID
  const hasRealSubscription =
    !!profile?.subscription_status &&
    ACTIVE_STATUSES.includes(profile.subscription_status) &&
    !!profile?.stripe_subscription_id

  if (!hasRealSubscription) {
    return NextResponse.json(
      { error: 'Kein aktives Abonnement. Bitte wähle zuerst einen Tarif.', code: 'NO_SUBSCRIPTION' },
      { status: 403 }
    )
  }

  // Username already set — idempotent (allow dashboard redirect)
  if (profile.username) {
    return NextResponse.json({ ok: true })
  }

  // ── Save username ─────────────────────────────────────────────────────
  const { error } = await admin
    .from('users')
    .update({ username: clean, username_set_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    const isDuplicate = error.code === '23505' || error.message?.includes('unique')
    return NextResponse.json(
      {
        error: isDuplicate
          ? 'Dieser Username ist bereits vergeben.'
          : 'Fehler beim Speichern.',
        code: isDuplicate ? 'DUPLICATE' : error.code,
      },
      { status: isDuplicate ? 409 : 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
