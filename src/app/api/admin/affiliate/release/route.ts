/**
 * POST /api/admin/affiliate/release
 * Admin-only: immediately releases all pending commissions for a referrer,
 * bypassing the normal 14-day hold. Useful for testing or special cases.
 *
 * Body: { referrer_id: string } — or omit to release ALL pending globally.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, affiliateCommissions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'daniel-kurzeja@live.de'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const now = new Date()

  let result
  if (body.referrer_id) {
    result = await db.update(affiliateCommissions)
      .set({ status: 'available', availableAt: now, updatedAt: now })
      .where(and(
        eq(affiliateCommissions.status, 'pending'),
        eq(affiliateCommissions.referrerId, body.referrer_id)
      ))
      .returning({ id: affiliateCommissions.id })
  } else {
    result = await db.update(affiliateCommissions)
      .set({ status: 'available', availableAt: now, updatedAt: now })
      .where(eq(affiliateCommissions.status, 'pending'))
      .returning({ id: affiliateCommissions.id })
  }

  return NextResponse.json({ released: result.length })
}
