import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

function sanitize(val: string) {
  return val
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z-]/g, '')
    .replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-')
    .slice(0, 30)
}

function isValid(u: string) {
  return /^[a-z][a-z-]*[a-z]$/.test(u) && u.length >= 3
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })

  const { username, first_name, last_name } = await req.json()
  const clean = sanitize(username ?? '')

  if (!isValid(clean)) {
    return NextResponse.json(
      { error: 'Ungültiger Username. Mindestens 3 Buchstaben a–z, Bindestriche erlaubt.' },
      { status: 400 }
    )
  }

  // ── Verify the user has an active subscription ────────────────────────
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })

  // Require both a valid status AND a real Stripe subscription ID
  const hasRealSubscription =
    !!profile?.subscriptionStatus &&
    ACTIVE_STATUSES.includes(profile.subscriptionStatus) &&
    !!profile?.stripeSubscriptionId

  if (!hasRealSubscription) {
    return NextResponse.json(
      { error: 'Kein aktives Abonnement. Bitte wähle zuerst einen Tarif.', code: 'NO_SUBSCRIPTION' },
      { status: 403 }
    )
  }

  // Username already set — idempotent (allow dashboard redirect)
  if (profile?.username) {
    return NextResponse.json({ ok: true })
  }

  // ── Save username + profile name ─────────────────────────────────────
  const updates: Partial<typeof users.$inferInsert> = {
    username: clean,
    usernameSetAt: new Date(),
  }
  if (first_name?.trim()) updates.firstName = first_name.trim()
  if (last_name?.trim()) updates.lastName = last_name.trim()

  try {
    await db.update(users).set(updates).where(eq(users.id, user.id))
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    const isDuplicate = msg.includes('unique') || msg.includes('23505')
    return NextResponse.json(
      {
        error: isDuplicate
          ? 'Dieser Username ist bereits vergeben.'
          : 'Fehler beim Speichern.',
        code: isDuplicate ? 'DUPLICATE' : 'ERROR',
      },
      { status: isDuplicate ? 409 : 500 }
    )
  }
}
