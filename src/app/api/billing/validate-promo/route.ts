import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase()
  if (!code) return NextResponse.json({ valid: false })

  try {
    const stripe = getStripe()
    const result = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
      expand: ['data.promotion.coupon'],
    })

    if (!result.data.length) return NextResponse.json({ valid: false })

    const promotion = result.data[0].promotion
    const coupon = promotion.coupon as Stripe.Coupon | string | null

    const percentOff = typeof coupon === 'object' && coupon ? coupon.percent_off ?? null : null
    const amountOff = typeof coupon === 'object' && coupon ? coupon.amount_off ?? null : null
    const name = typeof coupon === 'object' && coupon ? (coupon.name ?? code) : code

    return NextResponse.json({ valid: true, percent_off: percentOff, amount_off: amountOff, name })
  } catch {
    return NextResponse.json({ valid: false })
  }
}
