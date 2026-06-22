import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, userSites, subscriptionEvents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getUserFromRequest } from '@/lib/auth/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'

async function checkAdmin(req: Request) {
  const user = await getUserFromRequest(req)
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

  // Stripe invoices if customer exists
  let invoices: Stripe.Invoice[] = []
  if (profile.stripeCustomerId) {
    try {
      const result = await getStripe().invoices.list({ customer: profile.stripeCustomerId, limit: 10 })
      invoices = result.data
    } catch { /* ignore */ }
  }

  return NextResponse.json({ profile, sites, invoices, events })
}
