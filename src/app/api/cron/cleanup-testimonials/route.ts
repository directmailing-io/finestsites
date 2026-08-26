/**
 * Cron: Räumt verwaiste Erfahrungsbericht-Drafts auf.
 * Drafts älter als 48h werden inkl. ihrer R2-Objekte gelöscht
 * (abgebrochene Wizard-Durchläufe). Aufruf via VPS-Crontab mit CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { testimonials, testimonialAssets } from '@/lib/db/schema'
import { and, eq, lt, inArray } from 'drizzle-orm'
import { deleteFromR2 } from '@/lib/r2/client'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const staleDrafts = await db.query.testimonials.findMany({
    where: and(eq(testimonials.status, 'draft'), lt(testimonials.createdAt, cutoff)),
    columns: { id: true },
  })

  if (!staleDrafts.length) {
    return NextResponse.json({ deleted: 0 })
  }

  const ids = staleDrafts.map(d => d.id)
  const assets = await db.query.testimonialAssets.findMany({
    where: inArray(testimonialAssets.testimonialId, ids),
    columns: { r2Key: true },
  })

  for (const a of assets) {
    await deleteFromR2(a.r2Key).catch(() => {})
  }

  // Assets fallen per ON DELETE CASCADE mit
  await db.delete(testimonials).where(inArray(testimonials.id, ids))

  console.log(`[cleanup-testimonials] deleted=${ids.length} assets=${assets.length}`)
  return NextResponse.json({ deleted: ids.length, assets: assets.length })
}
