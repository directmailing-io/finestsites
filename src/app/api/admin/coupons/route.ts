import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getPriceIdByPlan } from '@/lib/stripe/client'
import type { PlanKey } from '@/lib/stripe/client'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getServerUser } from '@/lib/auth/server'

async function checkAdmin() {
  const user = await getServerUser()
  if (!user) return null
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isAdmin: true },
  })
  return profile?.isAdmin ? user : null
}

// GET /api/admin/coupons — list all promotion codes from Stripe
export async function GET() {
  const admin = await checkAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const stripe = getStripe()
    const codes = await stripe.promotionCodes.list({ limit: 100, expand: ['data.promotion.coupon'] })
    return NextResponse.json(codes.data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/admin/coupons — create coupon + promotion code in Stripe
export async function POST(req: NextRequest) {
  const admin = await checkAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const {
      code, discountType, amount, plans, interval, duration,
      durationMonths, maxRedemptions, expiresAt, firstTimeOnly, name,
    } = await req.json() as {
      code: string
      discountType: 'percent' | 'fixed'
      amount: number
      plans: PlanKey[]
      interval?: 'both' | 'monthly' | 'yearly'
      duration: 'once' | 'forever' | 'repeating'
      durationMonths?: number
      maxRedemptions?: number
      expiresAt?: string
      firstTimeOnly?: boolean
      name?: string
    }

    if (!code?.trim() || !amount || !duration) {
      return NextResponse.json({ error: 'Pflichtfelder fehlen.' }, { status: 400 })
    }

    const stripe = getStripe()

    // Resolve Stripe product IDs for plan restriction (if specific plans selected)
    let productIds: string[] | undefined
    const selectedPlans: PlanKey[] = (plans ?? []).filter(Boolean)
    if (selectedPlans.length > 0) {
      const prices = await Promise.all(
        selectedPlans.map(p => stripe.prices.retrieve(getPriceIdByPlan(p, 'monthly') as string))
      )
      productIds = prices.map(p => typeof p.product === 'string' ? p.product : (p.product as any).id)
    }

    // Create Stripe coupon
    const couponParams: any = {
      name: name?.trim() || code.toUpperCase().trim(),
      duration,
      ...(duration === 'repeating' ? { duration_in_months: Number(durationMonths) } : {}),
      ...(discountType === 'percent'
        ? { percent_off: Number(amount) }
        : { amount_off: Math.round(Number(amount) * 100), currency: 'eur' }),
      ...(productIds ? { applies_to: { products: productIds } } : {}),
      metadata: {
        plans: selectedPlans.length ? selectedPlans.join(',') : 'all',
        interval: interval ?? 'both',
        created_by: 'admin',
      },
    }

    const coupon = await stripe.coupons.create(couponParams)

    // Create promotion code pointing to coupon
    const promoParams: any = {
      coupon: coupon.id,
      code: code.toUpperCase().trim(),
      ...(maxRedemptions ? { max_redemptions: Number(maxRedemptions) } : {}),
      ...(expiresAt ? { expires_at: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
      restrictions: { first_time_transaction: !!firstTimeOnly },
    }

    const promoCode = await stripe.promotionCodes.create(promoParams)
    return NextResponse.json(promoCode, { status: 201 })
  } catch (e: any) {
    const msg = e?.raw?.message ?? e?.message ?? 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: e?.statusCode ?? 500 })
  }
}
