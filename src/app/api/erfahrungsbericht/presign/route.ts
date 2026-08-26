import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { testimonialAssets } from '@/lib/db/schema'
import { getPresignedUploadUrl } from '@/lib/r2/client'
import {
  createRateLimiter, getClientIp, getAuthorizedDraft, getVerifiedAssets,
  MAX_VIDEO_BYTES, MAX_TOTAL_BYTES,
} from '@/lib/testimonials/server'

const rateLimit = createRateLimiter(10, 60 * 60_000)

const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

export async function POST(req: NextRequest) {
  if (!rateLimit(getClientIp(req))) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte versuch es später nochmal.' }, { status: 429 })
  }

  const { submissionId, uploadToken, contentType, sizeBytes } = await req.json().catch(() => ({}))

  const ext = VIDEO_TYPES[String(contentType ?? '')]
  if (!ext) {
    return NextResponse.json({ error: 'Ungültiges Videoformat. Erlaubt: MP4, WebM, MOV.' }, { status: 400 })
  }
  const declaredSize = Number(sizeBytes)
  if (!Number.isFinite(declaredSize) || declaredSize <= 0 || declaredSize > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: 'Video zu groß (max. 200 MB).' }, { status: 413 })
  }

  const draft = await getAuthorizedDraft(String(submissionId ?? ''), String(uploadToken ?? ''))
  if (!draft) {
    return NextResponse.json({ error: 'Sitzung ungültig oder abgelaufen.' }, { status: 403 })
  }

  const assets = await getVerifiedAssets(draft.id)
  const active = assets.filter(a => a.status !== 'rejected')
  if (active.some(a => a.kind === 'video')) {
    return NextResponse.json({ error: 'Es ist schon ein Video gespeichert.' }, { status: 400 })
  }
  const totalBytes = active.reduce((sum, a) => sum + (a.sizeBytes ?? 0), 0)
  if (totalBytes + declaredSize > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: 'Gesamtgröße der Dateien überschritten.' }, { status: 413 })
  }

  const key = `testimonials/${draft.id}/video-0-${crypto.randomUUID()}.${ext}`
  const [asset] = await db.insert(testimonialAssets).values({
    testimonialId: draft.id,
    kind: 'video',
    status: 'pending',
    r2Key: key,
    contentType: String(contentType),
  }).returning({ id: testimonialAssets.id })

  const uploadUrl = await getPresignedUploadUrl(key, String(contentType), 900)
  return NextResponse.json({ assetId: asset.id, uploadUrl })
}
