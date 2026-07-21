import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
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

// PATCH /api/admin/coupons/[id] — activate or deactivate a promotion code
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { active } = await req.json() as { active: boolean }

  try {
    const stripe = getStripe()
    const updated = await stripe.promotionCodes.update(id, { active })
    return NextResponse.json({ id: updated.id, active: updated.active })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/admin/coupons/[id] — deactivate promo code (Stripe does not allow deletion)
// If the underlying coupon has 0 redemptions, it will also be deleted from Stripe.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const stripe = getStripe()

    // Retrieve promo code to get coupon ID and redemption count
    const pc = await stripe.promotionCodes.retrieve(id, { expand: ['promotion.coupon'] })
    const coupon = pc.promotion.coupon as any

    // Deactivate the promotion code (Stripe doesn't allow deleting promo codes)
    await stripe.promotionCodes.update(id, { active: false })

    // If the coupon was never redeemed, delete it too — this frees up the code string for reuse
    let couponDeleted = false
    if (coupon && coupon.id && coupon.times_redeemed === 0) {
      try {
        await stripe.coupons.del(coupon.id)
        couponDeleted = true
      } catch {
        // Coupon might be in use by another promo code — ignore
      }
    }

    return NextResponse.json({ ok: true, coupon_deleted: couponDeleted })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
