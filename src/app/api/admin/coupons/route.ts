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
      durationMonths, maxRedemptions, startsAt, expiresAt, firstTimeOnly, name,
    } = await req.json() as {
      code: string
      discountType: 'percent' | 'fixed'
      amount: number
      plans: PlanKey[]
      interval?: 'both' | 'monthly' | 'yearly'
      duration: 'once' | 'forever' | 'repeating'
      durationMonths?: number
      maxRedemptions?: number
      startsAt?: string  // ISO date — if in future, create as inactive
      expiresAt?: string // ISO date — expires at 23:59:59 UTC on that day
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

    // "Gültig bis" date should include the full selected day.
    // The input is a date string (e.g. "2026-07-26"). We set expiry to 23:59:59 UTC
    // on that day so the code remains valid until the very end of the date (in UTC).
    // In German time (UTC+1/+2) that means the code works until 01:59 or 00:59 next morning.
    const expiresAtTimestamp = expiresAt
      ? Math.floor(new Date(expiresAt + 'T23:59:59Z').getTime() / 1000)
      : undefined

    // If startsAt is set and is in the future, create the code as inactive.
    // The admin can manually activate it later (or a future cron job can do it).
    const nowTs = Date.now()
    const startsAtMs = startsAt ? new Date(startsAt + 'T00:00:00Z').getTime() : 0
    const shouldStartInactive = startsAt && startsAtMs > nowTs

    // Create promotion code pointing to coupon — Stripe v22+: use promotion.{type,coupon} instead of top-level coupon
    const promoParams: any = {
      promotion: { type: 'coupon', coupon: coupon.id },
      code: code.toUpperCase().trim(),
      active: !shouldStartInactive,
      ...(maxRedemptions ? { max_redemptions: Number(maxRedemptions) } : {}),
      ...(expiresAtTimestamp ? { expires_at: expiresAtTimestamp } : {}),
      restrictions: { first_time_transaction: !!firstTimeOnly },
      metadata: {
        ...(startsAt ? { starts_at: startsAt } : {}),
      },
    }

    const promoCode = await stripe.promotionCodes.create(promoParams)
    return NextResponse.json(promoCode, { status: 201 })
  } catch (e: any) {
    const msg = e?.raw?.message ?? e?.message ?? 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: e?.statusCode ?? 500 })
  }
}
