/**
 * GET /api/admin/belege?month=2026-10
 * Belege eines Monats (Rechnungen, Gutschriften, Stripe-Auszahlungen) als JSON – nur Admin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/testimonials/admin'
import { getMonthDocs, isMonthKey } from '@/lib/admin/belege'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = await assertAdmin(req)
  if (denied) return denied
  const month = req.nextUrl.searchParams.get('month')
  if (!isMonthKey(month)) return NextResponse.json({ error: 'month=YYYY-MM fehlt' }, { status: 400 })
  try {
    return NextResponse.json(await getMonthDocs(month), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    console.error('[admin/belege]', e)
    return NextResponse.json({ error: 'Stripe gerade nicht erreichbar. Bitte gleich nochmal versuchen.' }, { status: 502 })
  }
}
