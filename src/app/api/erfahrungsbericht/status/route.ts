import { NextRequest, NextResponse } from 'next/server'
import { getPresignedDownloadUrl } from '@/lib/r2/client'
import {
  createRateLimiter, getClientIp, getAuthorizedDraft, getVerifiedAssets,
} from '@/lib/testimonials/server'

const rateLimit = createRateLimiter(20, 60 * 60_000)

// Liefert dem anonymen Absender seine eigenen, bereits hochgeladenen Assets
// (für die Wiederaufnahme eines unterbrochenen Durchlaufs), inkl. kurzlebiger
// Vorschau-URLs.
export async function POST(req: NextRequest) {
  if (!rateLimit(getClientIp(req))) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte versuch es später nochmal.' }, { status: 429 })
  }

  const { submissionId, uploadToken } = await req.json().catch(() => ({}))
  const draft = await getAuthorizedDraft(String(submissionId ?? ''), String(uploadToken ?? ''))
  if (!draft) {
    return NextResponse.json({ error: 'Sitzung ungültig oder abgelaufen.' }, { status: 403 })
  }

  const assets = await getVerifiedAssets(draft.id)
  const verified = assets.filter(a => a.status === 'verified')

  const result = await Promise.all(verified.map(async a => ({
    assetId: a.id,
    kind: a.kind,
    sortOrder: a.sortOrder,
    previewUrl: a.kind === 'before_image' || a.kind === 'after_image'
      ? await getPresignedDownloadUrl(a.r2Key, 900)
      : null,
  })))

  return NextResponse.json({ category: draft.category, assets: result })
}
