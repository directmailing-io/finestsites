/**
 * GET /api/admin/affiliate/credit-notes/export?year=2026
 * CSV aller Gutschriften für die Steuerberatung (Admin-only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/testimonials/admin'
import { listCreditNotes, creditNotesCsv } from '@/lib/affiliate/credit-notes-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = await assertAdmin(req)
  if (denied) return denied

  const year = req.nextUrl.searchParams.get('year')
  let rows = await listCreditNotes(100_000)
  if (year && /^\d{4}$/.test(year)) rows = rows.filter(r => r.number.startsWith(`GS-${year}-`))

  const csv = creditNotesCsv(rows)
  const filename = `gutschriften${year && /^\d{4}$/.test(year) ? `-${year}` : ''}.csv`
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
