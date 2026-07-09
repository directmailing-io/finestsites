import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Validates a partner/affiliate or promo code in two phases:
 * 1. Check if code matches a username in our DB (affiliate/partner code) → 20% lifetime discount
 * 2. If not, check Stripe promotion codes (action codes like BLACKFRIDAY)
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim()
  if (!code) return NextResponse.json({ valid: false })

  // Phase 1 — affiliate/partner code: match against usernames in our system
  try {
    const affiliateUser = await db.query.users.findFirst({
      where: eq(users.username, code.toLowerCase()),
      columns: { username: true, firstName: true },
    })
    if (affiliateUser?.username) {
      return NextResponse.json({
        valid: true,
        type: 'affiliate',
        username: affiliateUser.username,
        display_name: affiliateUser.firstName ?? affiliateUser.username,
        percent_off: 20,
        amount_off: null,
      })
    }
  } catch { /* DB error: fall through to Stripe check */ }

  // Phase 2 — Stripe promotion code (action codes: BLACKFRIDAY etc.)
  try {
    const stripe = getStripe()
    const result = await stripe.promotionCodes.list({
      code: code.toUpperCase(),
      active: true,
      limit: 1,
      expand: ['data.promotion.coupon'],
    })

    if (!result.data.length) return NextResponse.json({ valid: false })

    const promotion = result.data[0].promotion
    const coupon = promotion.coupon as Stripe.Coupon | string | null
    const percentOff = typeof coupon === 'object' && coupon ? coupon.percent_off ?? null : null
    const amountOff = typeof coupon === 'object' && coupon ? coupon.amount_off ?? null : null
    const name = typeof coupon === 'object' && coupon ? (coupon.name ?? code.toUpperCase()) : code.toUpperCase()

    return NextResponse.json({ valid: true, type: 'promo', percent_off: percentOff, amount_off: amountOff, name })
  } catch {
    return NextResponse.json({ valid: false })
  }
}
