import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerUser } from '@/lib/auth/server'
import type Stripe from 'stripe'

async function checkAdmin() {
  const user = await getServerUser()
  if (!user) return null
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isAdmin: true },
  })
  return profile?.isAdmin ? user : null
}

export interface RedemptionEntry {
  subscription_id: string
  customer_id: string
  customer_email: string | null
  customer_name: string | null
  plan: string | null
  status: string
  created: number // unix timestamp
  discount_end: number | null // when the discount expires (null = forever)
}

// GET /api/admin/coupons/[id]/redemptions — list subscriptions that used this promo code
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const stripe = getStripe()

  try {
    // Fetch subscriptions in pages, filtering by those with this promotion code
    // Note: stripe.subscriptions.list({ promotion_code }) is not supported in v22+
    // so we paginate and filter client-side.
    const redemptions: RedemptionEntry[] = []
    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore && redemptions.length < 500) {
      const page = await stripe.subscriptions.list({
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
        expand: ['data.discount', 'data.customer'],
      })

      for (const sub of page.data) {
        // Stripe v22+: discounts is an array; find one matching this promo code
        const allDiscounts = (sub.discounts ?? []) as Stripe.Discount[]
        const matchedDiscount = allDiscounts.find(d => {
          const promoId = typeof d.promotion_code === 'string'
            ? d.promotion_code
            : (d.promotion_code as any)?.id ?? null
          return promoId === id
        })

        if (!matchedDiscount) continue

        const customer = sub.customer as Stripe.Customer | string
        const email = typeof customer === 'object' ? (customer.email ?? null) : null
        const name = typeof customer === 'object' ? (customer.name ?? null) : null
        const customerId = typeof customer === 'string' ? customer : customer.id

        // Determine plan from subscription metadata
        const planMeta = (sub as any).metadata?.plan ?? null
        const interval = (sub as any).metadata?.interval ?? null
        const planLabel = planMeta ? `${planMeta}${interval ? ` / ${interval}` : ''}` : null

        redemptions.push({
          subscription_id: sub.id,
          customer_id: customerId,
          customer_email: email,
          customer_name: name,
          plan: planLabel,
          status: sub.status,
          created: sub.created,
          discount_end: matchedDiscount.end ?? null,
        })
      }

      hasMore = page.has_more
      if (page.data.length > 0) {
        startingAfter = page.data[page.data.length - 1].id
      } else {
        hasMore = false
      }
    }

    return NextResponse.json(redemptions)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
