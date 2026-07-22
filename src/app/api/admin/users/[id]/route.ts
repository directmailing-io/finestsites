import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, userSites, subscriptionEvents } from '@/lib/db/schema'
import { eq, desc, ne, and } from 'drizzle-orm'
import { getRealUserFromRequest } from '@/lib/auth/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { purgeUsernameKV, setCustomDomainKV } from '@/lib/cloudflare/kv-api'

async function checkAdmin(req: Request) {
  const user = await getRealUserFromRequest(req)
  if (!user) return null
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isAdmin: true },
  })
  return profile?.isAdmin ? user : null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await checkAdmin(req)
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [profile, sites, events] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, id) }),
    db.query.userSites.findMany({
      where: (s, { and, ne }) => and(eq(s.userId, id), ne(s.status, 'deleted')),
      orderBy: desc(userSites.createdAt),
      with: { template: { columns: { title: true, domain: true } } },
    }),
    db.query.subscriptionEvents.findMany({
      where: eq(subscriptionEvents.userId, id),
      orderBy: desc(subscriptionEvents.createdAt),
      limit: 50,
      columns: {
        id: true,
        eventType: true,
        plan: true,
        billingInterval: true,
        amountCents: true,
        createdAt: true,
        stripeInvoiceId: true,
        metadata: true,
      },
    }),
  ])

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Stripe invoices + subscription discount if customer exists
  let invoices: Stripe.Invoice[] = []
  let subscriptionDiscount: { couponName: string | null; promoCode: string | null } | null = null
  if (profile.stripeCustomerId) {
    try {
      const invoiceResult = await getStripe().invoices.list({
        customer: profile.stripeCustomerId,
        limit: 10,
        expand: ['data.discounts', 'data.discounts.promotion_code'],
      })
      invoices = invoiceResult.data

      // Extract coupon/promo code from any invoice that has a discount
      for (const inv of invoices) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const discounts: any[] = (inv as any).discounts ?? []
        if (discounts.length > 0) {
          const disc = discounts[0]
          subscriptionDiscount = {
            couponName: disc.coupon?.name ?? disc.coupon?.id ?? null,
            promoCode: disc.promotion_code?.code ?? null,
          }
          break
        }
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({ profile, sites, invoices, events, subscriptionDiscount })
}

// ── Username change ───────────────────────────────────────────────────────────

function sanitizeUsername(val: string): string {
  return val
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z-]/g, '')
    .replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-')
    .slice(0, 30)
}

function isValidUsername(u: string): boolean {
  return /^[a-z][a-z-]*[a-z]$/.test(u) && u.length >= 3
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await checkAdmin(req)
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { username?: string }
  const newUsername = sanitizeUsername(body.username ?? '')

  if (!isValidUsername(newUsername)) {
    return NextResponse.json(
      { error: 'Ungültiger Username. Mindestens 3 Buchstaben a–z, Bindestriche erlaubt.' },
      { status: 400 },
    )
  }

  // Load current profile
  const profile = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, username: true },
  })
  if (!profile) return NextResponse.json({ error: 'Nutzer nicht gefunden.' }, { status: 404 })

  const oldUsername = profile.username
  if (oldUsername === newUsername) return NextResponse.json({ ok: true, username: newUsername })

  // Check uniqueness (exclude this user)
  const duplicate = await db.query.users.findFirst({
    where: and(eq(users.username, newUsername), ne(users.id, id)),
    columns: { id: true },
  })
  if (duplicate) {
    return NextResponse.json({ error: 'Dieser Username ist bereits vergeben.', code: 'DUPLICATE' }, { status: 409 })
  }

  // Load user's published/draft sites so we can update custom-domain KV mappings
  const userSiteRows = await db.query.userSites.findMany({
    where: and(eq(userSites.userId, id), ne(userSites.status, 'deleted')),
    columns: { customDomain: true, customDomainStatus: true },
    with: { template: { columns: { domain: true } } },
  })

  // DB update
  await db.update(users).set({ username: newUsername }).where(eq(users.id, id))

  // KV: purge all cached pages/meta for old username (fire-and-forget — don't block response)
  const kvUpdates: Promise<unknown>[] = []
  if (oldUsername) {
    kvUpdates.push(purgeUsernameKV(oldUsername))
  }

  // KV: update custom-domain entries that referenced the old username
  for (const site of userSiteRows) {
    if (site.customDomain && site.customDomainStatus === 'active' && site.template?.domain) {
      kvUpdates.push(setCustomDomainKV(site.customDomain, newUsername, site.template.domain))
    }
  }

  // Run all KV updates in parallel, don't fail if CF is temporarily unavailable
  await Promise.allSettled(kvUpdates)

  return NextResponse.json({ ok: true, username: newUsername })
}
