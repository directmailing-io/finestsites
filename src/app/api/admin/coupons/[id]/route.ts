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
