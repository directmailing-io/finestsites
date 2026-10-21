/**
 * GET /api/app/v1/affiliate/credit-notes — Gutschriften des Partners (nur Auszahlungen mit Nummer),
 * gleiche Auswahl wie /api/affiliate/credit-notes. PDF: GET /api/app/v1/affiliate/credit-notes/{id}.
 */
import { db } from '@/lib/db'
import { affiliatePayouts } from '@/lib/db/schema'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { appJson, toIso } from '@/lib/app-api/http'
import { requireAffiliateUser } from '@/lib/app-api/affiliate'
import { CreditNotesResponse } from '@/lib/contracts/app-v1/affiliate'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const a = await requireAffiliateUser(req, 'affiliate-credit-notes', 60)
  if (a.response) return a.response

  const rows = await db.select({
    id: affiliatePayouts.id,
    number: affiliatePayouts.creditNoteNumber,
    date: affiliatePayouts.creditNoteDate,
    paidAt: affiliatePayouts.paidAt,
    gross: affiliatePayouts.grossAmount,
    total: affiliatePayouts.totalAmount,
    status: affiliatePayouts.creditNoteStatus,
    method: affiliatePayouts.payoutMethod,
  })
    .from(affiliatePayouts)
    .where(and(eq(affiliatePayouts.referrerId, a.user.id), isNotNull(affiliatePayouts.creditNoteNumber)))
    .orderBy(desc(affiliatePayouts.paidAt))
    .limit(240)

  return appJson(CreditNotesResponse, {
    items: rows.map(r => ({
      id: r.id,
      number: r.number!,
      date: toIso(r.date ?? r.paidAt),
      amountCents: r.gross ?? r.total,
      ready: r.status === 'created',
      method: r.method === 'credit' ? 'credit' as const : 'transfer' as const,
    })),
  })
}
