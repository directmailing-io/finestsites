/**
 * GET /api/affiliate/credit-notes/[id]
 * Liefert das Gutschrift-PDF aus dem privaten R2-Speicher – nur für den Partner selbst
 * oder einen Admin. Fehlt das PDF noch, wird es hier einmal nacherzeugt.
 */

import { NextResponse } from 'next/server'
import { getUserFromRequest, getRealUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { affiliatePayouts, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { rateLimit } from '@/lib/security/request'
import { getRawFromR2 } from '@/lib/r2/client'
import { createCreditNoteDocument } from '@/lib/affiliate/payout'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return new NextResponse('Not found', { status: 404 })

  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rateLimit('credit-note-download', user.id, 60, 60_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte kurz.' }, { status: 429 })
  }

  let payout = await db.query.affiliatePayouts.findFirst({ where: eq(affiliatePayouts.id, id) })
  if (!payout || !payout.creditNoteNumber) return new NextResponse('Not found', { status: 404 })

  let allowed = payout.referrerId != null && payout.referrerId === user.id
  if (!allowed) {
    const real = await getRealUserFromRequest(req)
    if (real) {
      const profile = await db.query.users.findFirst({ where: eq(users.id, real.id), columns: { isAdmin: true } })
      allowed = !!profile?.isAdmin
    }
  }
  // Fremde Belege: wie „nicht vorhanden“ behandeln
  if (!allowed) return new NextResponse('Not found', { status: 404 })

  if (payout.creditNoteStatus !== 'created' || !payout.creditNoteKey) {
    const res = await createCreditNoteDocument(payout.id)
    if (!res.ok) {
      return NextResponse.json({ error: 'Die Gutschrift wird gerade noch erstellt. Bitte versuch es später nochmal.' }, { status: 503 })
    }
    payout = await db.query.affiliatePayouts.findFirst({ where: eq(affiliatePayouts.id, id) })
    if (!payout?.creditNoteKey) return new NextResponse('Not found', { status: 404 })
  }

  try {
    const { data } = await getRawFromR2(payout.creditNoteKey!)
    const filename = `${payout.creditNoteNumber}.pdf`
    const download = new URL(req.url).searchParams.get('download') === '1'
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(data.length),
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error(`[credit-note] R2 read failed for ${id}:`, err)
    return NextResponse.json({ error: 'Die Gutschrift konnte gerade nicht geladen werden. Bitte versuch es später nochmal.' }, { status: 503 })
  }
}
