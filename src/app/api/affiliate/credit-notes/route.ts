/**
 * GET /api/affiliate/credit-notes
 * Gutschriften des angemeldeten Partners (nur ausgezahlte Auszahlungen mit Nummer).
 */

import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { affiliatePayouts } from '@/lib/db/schema'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { rateLimit } from '@/lib/security/request'

export async function GET(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit('credit-notes-list', user.id, 60, 60_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte kurz.' }, { status: 429 })
  }

  const rows = await db.select({
    id: affiliatePayouts.id,
    number: affiliatePayouts.creditNoteNumber,
    date: affiliatePayouts.creditNoteDate,
    paidAt: affiliatePayouts.paidAt,
    gross: affiliatePayouts.grossAmount,
    total: affiliatePayouts.totalAmount,
    net: affiliatePayouts.netAmount,
    vat: affiliatePayouts.vatAmount,
    status: affiliatePayouts.creditNoteStatus,
    method: affiliatePayouts.payoutMethod,
  })
    .from(affiliatePayouts)
    .where(and(eq(affiliatePayouts.referrerId, user.id), isNotNull(affiliatePayouts.creditNoteNumber)))
    .orderBy(desc(affiliatePayouts.paidAt))
    .limit(240)

  return NextResponse.json({
    credit_notes: rows.map(r => ({
      id: r.id,
      number: r.number,
      date: r.date ?? r.paidAt,
      amount_cents: r.gross ?? r.total,
      net_cents: r.net,
      vat_cents: r.vat,
      ready: r.status === 'created',
      method: r.method === 'credit' ? 'credit' : 'transfer',
    })),
  })
}
