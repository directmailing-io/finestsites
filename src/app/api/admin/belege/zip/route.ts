/**
 * GET /api/admin/belege/zip?month=2026-10
 * Alle Belege eines Monats als ZIP für die Steuerberatung – nur Admin:
 *   Rechnungen/*.pdf (Stripe), Gutschriften/*.pdf (R2), Rechnungen.csv, Gutschriften.csv,
 *   Auszahlungen.csv (jede Stripe-Sammelüberweisung aufgeschlüsselt), Übersicht.txt
 */

import { NextRequest, NextResponse } from 'next/server'
import { zipSync, strToU8 } from 'fflate'
import { inArray } from 'drizzle-orm'
import { assertAdmin } from '@/lib/testimonials/admin'
import { db } from '@/lib/db'
import { affiliatePayouts } from '@/lib/db/schema'
import { getRawFromR2 } from '@/lib/r2/client'
import { createCreditNoteDocument } from '@/lib/affiliate/payout'
import { getMonthDocs, isMonthKey, invoicesCsv, creditNotesMonthCsv, payoutsCsv, summaryText, fileSafe } from '@/lib/admin/belege'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Kleine Parallelität, damit Stripe nicht drosselt */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++])
  }))
}

export async function GET(req: NextRequest) {
  const denied = await assertAdmin(req)
  if (denied) return denied
  const month = req.nextUrl.searchParams.get('month')
  if (!isMonthKey(month)) return NextResponse.json({ error: 'month=YYYY-MM fehlt' }, { status: 400 })

  let docs
  try {
    docs = await getMonthDocs(month, { withPayoutLines: true })
  } catch (e) {
    console.error('[admin/belege/zip] stripe', e)
    return NextResponse.json({ error: 'Stripe gerade nicht erreichbar. Bitte gleich nochmal versuchen.' }, { status: 502 })
  }

  const files: Record<string, Uint8Array> = {}
  const missing: string[] = []

  await pool(docs.invoices, 6, async inv => {
    if (!inv.pdfUrl) { missing.push(`Rechnung ${inv.number}: kein PDF bei Stripe`); return }
    try {
      const res = await fetch(inv.pdfUrl, { redirect: 'follow' })
      if (!res.ok) throw new Error(String(res.status))
      files[`Rechnungen/${fileSafe(inv.number)}.pdf`] = new Uint8Array(await res.arrayBuffer())
    } catch (e) {
      missing.push(`Rechnung ${inv.number}: Download fehlgeschlagen (${e instanceof Error ? e.message : e})`)
    }
  })

  if (docs.creditNotes.length > 0) {
    const ids = docs.creditNotes.map(c => c.id)
    const rows = await db.select({ id: affiliatePayouts.id, key: affiliatePayouts.creditNoteKey, number: affiliatePayouts.creditNoteNumber })
      .from(affiliatePayouts).where(inArray(affiliatePayouts.id, ids))
    for (const r of rows) {
      try {
        let key = r.key
        if (!key) {
          const made = await createCreditNoteDocument(r.id)
          if (!made.ok) throw new Error('PDF noch nicht erzeugt')
          key = (await db.select({ key: affiliatePayouts.creditNoteKey }).from(affiliatePayouts).where(inArray(affiliatePayouts.id, [r.id])))[0]?.key ?? null
        }
        if (!key) throw new Error('PDF fehlt')
        files[`Gutschriften/${r.number}.pdf`] = new Uint8Array((await getRawFromR2(key)).data)
      } catch (e) {
        missing.push(`Gutschrift ${r.number}: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  files['Rechnungen.csv'] = strToU8(invoicesCsv(docs))
  files['Gutschriften.csv'] = strToU8(creditNotesMonthCsv(docs))
  files['Auszahlungen.csv'] = strToU8(payoutsCsv(docs))
  files['Übersicht.txt'] = strToU8(summaryText(docs) + (missing.length ? `\r\n\r\nFEHLT:\r\n${missing.join('\r\n')}` : ''))

  // PDFs sind bereits komprimiert → nur speichern (level 0), CSV/Text komprimieren
  const zipped = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { level: k.endsWith('.pdf') ? 0 : 6 }]])))
  return new NextResponse(Buffer.from(zipped), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="FinestSites-Belege-${month}.zip"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
