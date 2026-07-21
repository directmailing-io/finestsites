import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { sendEmail } from '@/lib/resend'
import { affiliateAdminAssignEmail } from '@/lib/email/templates'

async function checkAdmin(req: Request) {
  const user = await getRealUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isAdmin: true },
  })
  return profile?.isAdmin ? user : null
}

// PATCH /api/admin/users/[id]/affiliate — assign or remove affiliate partner
// Body: { affiliateUsername: string | null }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await checkAdmin(req)
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { affiliateUsername } = await req.json() as { affiliateUsername: string | null }

  // Load the target user
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, email: true, plan: true, referredByUsername: true },
  })
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (affiliateUsername === null) {
    // Remove affiliate assignment
    await db.update(users).set({ referredByUsername: null }).where(eq(users.id, id))
    return NextResponse.json({ success: true, referredByUsername: null })
  }

  // Validate that the affiliate partner exists
  const affiliate = await db.query.users.findFirst({
    where: eq(users.username, affiliateUsername),
    columns: { id: true, email: true, username: true, firstName: true, affiliateOnboarded: true, affiliatePayoutEmail: true },
  })

  if (!affiliate) return NextResponse.json({ error: 'Partner nicht gefunden.' }, { status: 404 })

  // Update the referral
  await db.update(users).set({ referredByUsername: affiliateUsername }).where(eq(users.id, id))

  // Notify the affiliate partner (fire-and-forget)
  const notifyEmail = affiliate.affiliatePayoutEmail ?? affiliate.email
  const planLabel = targetUser.plan.charAt(0).toUpperCase() + targetUser.plan.slice(1)
  sendEmail({
    to: notifyEmail,
    subject: 'Neuer Partner zugeordnet – Provision ab sofort aktiv',
    html: affiliateAdminAssignEmail({
      refereeEmail: targetUser.email,
      planLabel,
      firstName: affiliate.firstName ?? null,
    }),
    type: 'transactional',
  }).catch(() => { /* ignore send errors */ })

  return NextResponse.json({ success: true, referredByUsername: affiliateUsername })
}
