import { safeEqual } from '@/lib/security/request'
/**
 * Cron: Monthly affiliate payout processor
 *
 * Runs on the 1st of each month at 09:00 UTC (configured in vercel.json).
 * Also callable manually via POST with CRON_SECRET for on-demand payouts.
 *
 * All payout rules live in src/lib/affiliate/payout.ts (shared with the
 * admin trigger and the self-service route): 10 € minimum, max one payout
 * per affiliate per month, live Stripe Connect verification, negative
 * balance offsetting.
 *
 * `?mode=maintenance` (safe to call daily): only reconciles payouts stuck in
 * `processing` and retries missing credit note PDFs — never transfers money.
 *
 * Prerequisite: Stripe account must be set to manual payouts
 * (dashboard.stripe.com/settings/payouts → Manual)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { runPayoutBatch, runPayoutMaintenance } from '@/lib/affiliate/payout'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || !safeEqual(authHeader ?? '', `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (request.nextUrl.searchParams.get('mode') === 'maintenance') {
    const { reconciled, creditNotes } = await runPayoutMaintenance(getStripe())
    console.log(`[affiliate-payouts] maintenance reconciled=${reconciled.length} credit_notes_retried=${creditNotes.retried} failed=${creditNotes.failed.length}`)
    return NextResponse.json({ mode: 'maintenance', reconciled, creditNotes })
  }

  const { results, released, reconciled, creditNotes } = await runPayoutBatch(getStripe(), { context: 'Monatslauf' })

  const paid = results.filter(r => r.status === 'paid').length
  const skipped = results.filter(r => r.status !== 'paid').length

  console.log(`[affiliate-payouts] released=${released} paid=${paid} skipped=${skipped}`)
  return NextResponse.json({ results, paid, skipped, released, reconciled, creditNotes })
}
