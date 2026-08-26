import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { testimonials, testimonialAssets } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { getPresignedDownloadUrl } from '@/lib/r2/client'
import { assertAdmin, assetFilename } from '@/lib/testimonials/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const err = await assertAdmin(req)
  if (err) return err
  const { assetId } = await params

  const asset = await db.query.testimonialAssets.findFirst({
    where: eq(testimonialAssets.id, assetId),
  })
  if (!asset) return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })

  const testimonial = await db.query.testimonials.findFirst({
    where: eq(testimonials.id, asset.testimonialId),
    columns: { fullName: true },
  })

  // Laufende Nummer innerhalb der gleichen Art für einen sprechenden Dateinamen
  const siblings = await db.query.testimonialAssets.findMany({
    where: and(
      eq(testimonialAssets.testimonialId, asset.testimonialId),
      eq(testimonialAssets.kind, asset.kind),
    ),
    orderBy: [asc(testimonialAssets.sortOrder), asc(testimonialAssets.createdAt)],
    columns: { id: true },
  })
  const index = Math.max(0, siblings.findIndex(s => s.id === asset.id)) + 1

  const filename = assetFilename(testimonial?.fullName ?? null, asset.kind, index, asset.r2Key)
  const url = await getPresignedDownloadUrl(asset.r2Key, 300, filename)
  return NextResponse.redirect(url, 302)
}
