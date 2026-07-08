import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, userSites, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Plan quota model: ONLY PUBLISHED sites with non-free templates count toward
  // the plan limit. Drafts are free — users can experiment without hitting limits.
  const [profile, userActiveSites] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, user.id) }),
    db
      .select({ id: userSites.id, status: userSites.status, isFree: templates.isFree })
      .from(userSites)
      .leftJoin(templates, eq(userSites.templateId, templates.id))
      .where(eq(userSites.userId, user.id))
      .then(rows => rows.filter(r => r.status === 'draft' || r.status === 'published')),
  ])

  const sites_count = userActiveSites.length
  // Paid count = published with non-free template (drafts excluded)
  const paid_sites_count = userActiveSites.filter(s => s.status === 'published' && s.isFree === false).length

  return NextResponse.json({
    plan: profile?.plan ?? 'starter',
    billing_interval: profile?.billingInterval ?? 'monthly',
    subscription_status: profile?.subscriptionStatus ?? null,
    stripe_customer_id: profile?.stripeCustomerId ?? null,
    sites_count,
    paid_sites_count,
    username: profile?.username ?? null,
    referred_by_username: profile?.referredByUsername ?? null,
    // NM company preferences
    nm_companies: profile?.nmCompanies ?? [],
    // Personal profile fields
    first_name: profile?.firstName ?? null,
    last_name: profile?.lastName ?? null,
    phone: profile?.phone ?? null,
    instagram: profile?.instagram ?? null,
    facebook: profile?.facebook ?? null,
    linkedin: profile?.linkedin ?? null,
    tiktok: profile?.tiktok ?? null,
    youtube: profile?.youtube ?? null,
    profile_image_url: profile?.profileImageUrl ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Map snake_case body keys to camelCase Drizzle column names
  const fieldMap: Record<string, keyof typeof users.$inferInsert> = {
    first_name: 'firstName',
    last_name: 'lastName',
    phone: 'phone',
    instagram: 'instagram',
    facebook: 'facebook',
    linkedin: 'linkedin',
    tiktok: 'tiktok',
    youtube: 'youtube',
    profile_image_url: 'profileImageUrl',
    nm_companies: 'nmCompanies',
  }

  const updates: Partial<typeof users.$inferInsert> = {}
  for (const [bodyKey, dbKey] of Object.entries(fieldMap)) {
    if (bodyKey in body) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(updates as any)[dbKey] = body[bodyKey] ?? null
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Keine Felder zum Aktualisieren.' }, { status: 400 })
  }

  try {
    await db.update(users).set(updates).where(eq(users.id, user.id))

    // Sync name changes to Stripe customer (fire-and-forget)
    const nameChanged = 'firstName' in updates || 'lastName' in updates
    if (nameChanged) {
      const current = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { stripeCustomerId: true, firstName: true, lastName: true, username: true },
      })
      if (current?.stripeCustomerId) {
        const fullName = [current.firstName, current.lastName].filter(Boolean).join(' ').trim()
        getStripe().customers.update(current.stripeCustomerId, {
          ...(fullName ? { name: fullName } : {}),
          metadata: {
            user_id: user.id,
            username: current.username ?? '',
            first_name: current.firstName ?? '',
            last_name: current.lastName ?? '',
          },
        }).catch((e: Error) => console.error('[profile/PATCH] Stripe sync error:', e.message))
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

