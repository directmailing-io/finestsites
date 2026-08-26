import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { testimonialAssets } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { deleteFromR2 } from '@/lib/r2/client'
import { createRateLimiter, getClientIp, getAuthorizedDraft } from '@/lib/testimonials/server'

const rateLimit = createRateLimiter(30, 60 * 60_000)

export async function POST(req: NextRequest) {
  if (!rateLimit(getClientIp(req))) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte versuch es später nochmal.' }, { status: 429 })
  }

  const { submissionId, uploadToken, assetId } = await req.json().catch(() => ({}))

  const draft = await getAuthorizedDraft(String(submissionId ?? ''), String(uploadToken ?? ''))
  if (!draft) {
    return NextResponse.json({ error: 'Sitzung ungültig oder abgelaufen.' }, { status: 403 })
  }

  const asset = await db.query.testimonialAssets.findFirst({
    where: and(
      eq(testimonialAssets.id, String(assetId ?? '')),
      eq(testimonialAssets.testimonialId, draft.id),
    ),
  })
  if (!asset) {
    return NextResponse.json({ error: 'Datei nicht gefunden.' }, { status: 404 })
  }

  await deleteFromR2(asset.r2Key).catch(() => {})
  await db.delete(testimonialAssets).where(eq(testimonialAssets.id, asset.id))

  return NextResponse.json({ ok: true })
}
