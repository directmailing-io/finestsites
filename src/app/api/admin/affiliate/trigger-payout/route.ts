/**
 * POST /api/admin/affiliate/trigger-payout
 * Admin-only: immediately processes payouts for all affiliates with available commissions.
 * Uses the shared payout engine (same rules as cron + self-service):
 * 10 € minimum, max one payout per affiliate per month, live Connect verification.
 */

import { NextResponse } from 'next/server'
import { getRealUserFromRequest } from '@/lib/auth/server'
import { getStripe } from '@/lib/stripe/client'
import { runPayoutBatch } from '@/lib/affiliate/payout'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'info@daniel-kurzeja.de'

export async function POST(req: Request) {
  const user = await getRealUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { results, released } = await runPayoutBatch(getStripe())

  if (results.length === 0) {
    return NextResponse.json({ message: 'Keine fälligen Provisionen.', paid: 0, skipped: 0, released })
  }

  const paid = results.filter(r => r.status === 'paid').length
  const skipped = results.filter(r => r.status !== 'paid').length
  return NextResponse.json({ results, paid, skipped, released })
}
