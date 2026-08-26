import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { testimonialAssets } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { getRangeFromR2, deleteFromR2 } from '@/lib/r2/client'
import {
  createRateLimiter, getClientIp, getAuthorizedDraft, MAX_VIDEO_BYTES,
} from '@/lib/testimonials/server'

const rateLimit = createRateLimiter(10, 60 * 60_000)

function isValidVideoSignature(sig: Buffer): boolean {
  // MP4/MOV: "ftyp" bei Offset 4
  if (sig[4] === 0x66 && sig[5] === 0x74 && sig[6] === 0x79 && sig[7] === 0x70) return true
  // WebM/Matroska: EBML-Header
  if (sig[0] === 0x1A && sig[1] === 0x45 && sig[2] === 0xDF && sig[3] === 0xA3) return true
  return false
}

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
  if (!asset || asset.kind !== 'video' || asset.status !== 'pending') {
    return NextResponse.json({ error: 'Asset nicht gefunden.' }, { status: 404 })
  }

  let data: Buffer, totalSize: number | undefined
  try {
    const range = await getRangeFromR2(asset.r2Key, 0, 63)
    data = range.data
    totalSize = range.totalSize
  } catch {
    // Objekt existiert nicht: PUT hat nie stattgefunden oder ist fehlgeschlagen
    await db.update(testimonialAssets).set({ status: 'rejected' }).where(eq(testimonialAssets.id, asset.id))
    return NextResponse.json({ error: 'Video nicht gefunden. Bitte lade es nochmal hoch.' }, { status: 400 })
  }

  const tooBig = (totalSize ?? 0) > MAX_VIDEO_BYTES
  if (tooBig || !isValidVideoSignature(data)) {
    await deleteFromR2(asset.r2Key).catch(() => {})
    await db.update(testimonialAssets).set({ status: 'rejected' }).where(eq(testimonialAssets.id, asset.id))
    return NextResponse.json(
      { error: tooBig ? 'Video zu groß (max. 200 MB).' : 'Das ist keine gültige Videodatei.' },
      { status: 400 },
    )
  }

  await db.update(testimonialAssets)
    .set({ status: 'verified', sizeBytes: totalSize ?? null })
    .where(eq(testimonialAssets.id, asset.id))

  return NextResponse.json({ ok: true })
}
