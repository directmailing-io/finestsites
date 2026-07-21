import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe/client'
import type Stripe from 'stripe'
import { CouponsClient } from './CouponsClient'

export const metadata = { title: 'Gutscheine – Admin' }

export interface SerializedCoupon {
  name: string | null
  percent_off: number | null
  amount_off: number | null
  currency: string | null
  duration: string
  duration_in_months: number | null
  plans: string
  interval: string
  valid: boolean
}

export interface SerializedPromoCode {
  id: string
  code: string
  active: boolean
  times_redeemed: number
  max_redemptions: number | null
  expires_at: number | null
  first_time_only: boolean
  coupon: SerializedCoupon
}

function serializeCoupon(coupon: Stripe.Coupon): SerializedCoupon {
  return {
    name: coupon.name ?? null,
    percent_off: coupon.percent_off ?? null,
    amount_off: coupon.amount_off ?? null,
    currency: coupon.currency ?? null,
    duration: coupon.duration,
    duration_in_months: coupon.duration_in_months ?? null,
    plans: (coupon.metadata as any)?.plans ?? 'all',
    interval: (coupon.metadata as any)?.interval ?? 'both',
    valid: coupon.valid,
  }
}

function serializePromoCode(pc: Stripe.PromotionCode): SerializedPromoCode {
  // Stripe v22+: coupon lives at promotion.coupon (expanded from 'data.promotion.coupon')
  const coupon = pc.promotion.coupon as Stripe.Coupon
  return {
    id: pc.id,
    code: pc.code,
    active: pc.active,
    times_redeemed: pc.times_redeemed,
    max_redemptions: pc.max_redemptions ?? null,
    expires_at: pc.expires_at ?? null,
    first_time_only: pc.restrictions?.first_time_transaction ?? false,
    coupon: serializeCoupon(coupon),
  }
}

export default async function CouponsPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isAdmin: true },
  })
  if (!profile?.isAdmin) redirect('/dashboard')

  const stripe = getStripe()
  const result = await stripe.promotionCodes.list({ limit: 100, expand: ['data.promotion.coupon'] })
  const codes = result.data.map(serializePromoCode)

  return <CouponsClient initialCodes={codes} />
}
