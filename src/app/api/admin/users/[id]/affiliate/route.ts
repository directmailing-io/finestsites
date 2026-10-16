import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, subscriptionEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { sendEmail } from '@/lib/resend'
import { affiliateAdminAssignEmail } from '@/lib/email/templates'
import { stampLegacyTermsIfBeforeStart } from '@/lib/affiliate/referral-offer'

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
    columns: { id: true, email: true, firstName: true, username: true, plan: true, referredByUsername: true },
  })
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Mandatory audit log for every affiliate assignment change (spec requirement)
  async function logAssignmentChange(newAffiliate: string | null) {
    try {
      await db.insert(subscriptionEvents).values({
        userId: id,
        eventType: 'affiliate_assignment_changed',
        stripeEventId: `admin-affiliate-${randomUUID()}`,
        metadata: {
          old_affiliate: targetUser!.referredByUsername,
          new_affiliate: newAffiliate,
          changed_by: 'admin',
          admin_id: adminUser!.id,
          admin_email: adminUser!.email ?? null,
        },
      })
    } catch (err) {
      console.error('[admin/affiliate] audit log error:', err)
    }
  }

  if (affiliateUsername === null) {
    // Remove affiliate assignment
    await db.update(users).set({ referredByUsername: null }).where(eq(users.id, id))
    await logAssignmentChange(null)
    return NextResponse.json({ success: true, referredByUsername: null })
  }

  // Validate that the affiliate partner exists
  const affiliate = await db.query.users.findFirst({
    where: eq(users.username, affiliateUsername),
    columns: { id: true, email: true, username: true, firstName: true, affiliateOnboarded: true, affiliatePayoutEmail: true, isAdmin: true },
  })

  if (!affiliate) return NextResponse.json({ error: 'Partner nicht gefunden.' }, { status: 404 })
  // Keine Selbstempfehlung: ein Nutzer kann nicht sein eigener Partner sein
  if (affiliate.id === targetUser.id) {
    return NextResponse.json({ error: 'Ein Nutzer kann nicht sich selbst als Partner zugeordnet werden.' }, { status: 400 })
  }

  // Update the referral
  await db.update(users).set({ referredByUsername: affiliateUsername }).where(eq(users.id, id))
  await logAssignmentChange(affiliateUsername)
  // Zuordnung vor dem Stichtag → altes Modell (wie Registrierung/Partnercode; nie bei Admin-Partner,
  // gilt ohne Abo nur bis Stichtag + 30 Tage). Ein vorhandener Vermerk bleibt unverändert.
  await stampLegacyTermsIfBeforeStart(id, affiliate)
    .catch(err => console.error('[admin/affiliate] referral terms stamp error:', err))

  // Notify the affiliate partner (fire-and-forget)
  const notifyEmail = affiliate.affiliatePayoutEmail ?? affiliate.email
  const planLabel = targetUser.plan.charAt(0).toUpperCase() + targetUser.plan.slice(1)
  sendEmail({
    to: notifyEmail,
    subject: 'Neuer Partner zugeordnet – Provision ab sofort aktiv',
    html: affiliateAdminAssignEmail({
      // Template zeigt nur Vorname bzw. maskierte E-Mail (Datensparsamkeit gegenüber Partnern)
      refereeEmail: targetUser.email,
      refereeFirstName: targetUser.firstName ?? null,
      planLabel,
      firstName: affiliate.firstName ?? null,
    }),
    type: 'transactional',
  }).catch(() => { /* ignore send errors */ })

  return NextResponse.json({ success: true, referredByUsername: affiliateUsername })
}
