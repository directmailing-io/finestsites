import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { testimonialAssets } from '@/lib/db/schema'
import { uploadToR2 } from '@/lib/r2/client'
import {
  createRateLimiter, getClientIp, getAuthorizedDraft, getVerifiedAssets,
  MAX_IMAGES_PER_KIND, MAX_PROXY_UPLOAD_BYTES, MAX_TOTAL_BYTES,
} from '@/lib/testimonials/server'

const rateLimit = createRateLimiter(25, 60 * 60_000)

type Detected = { contentType: string; ext: string }

function detectImage(sig: Buffer): Detected | null {
  if (sig[0] === 0xFF && sig[1] === 0xD8 && sig[2] === 0xFF) return { contentType: 'image/jpeg', ext: 'jpg' }
  if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4E && sig[3] === 0x47) return { contentType: 'image/png', ext: 'png' }
  if (sig[8] === 0x57 && sig[9] === 0x45 && sig[10] === 0x42 && sig[11] === 0x50) return { contentType: 'image/webp', ext: 'webp' }
  return null
}

function detectAudio(sig: Buffer): Detected | null {
  if (sig[0] === 0x1A && sig[1] === 0x45 && sig[2] === 0xDF && sig[3] === 0xA3) return { contentType: 'audio/webm', ext: 'webm' }
  if (sig[0] === 0x4F && sig[1] === 0x67 && sig[2] === 0x67 && sig[3] === 0x53) return { contentType: 'audio/ogg', ext: 'ogg' }
  if (sig[4] === 0x66 && sig[5] === 0x74 && sig[6] === 0x79 && sig[7] === 0x70) return { contentType: 'audio/mp4', ext: 'm4a' }
  if (sig[0] === 0x52 && sig[1] === 0x49 && sig[2] === 0x46 && sig[3] === 0x46
    && sig[8] === 0x57 && sig[9] === 0x41 && sig[10] === 0x56 && sig[11] === 0x45) return { contentType: 'audio/wav', ext: 'wav' }
  if ((sig[0] === 0x49 && sig[1] === 0x44 && sig[2] === 0x33) || (sig[0] === 0xFF && (sig[1] & 0xE0) === 0xE0)) return { contentType: 'audio/mpeg', ext: 'mp3' }
  return null
}

export async function POST(req: NextRequest) {
  if (!rateLimit(getClientIp(req))) {
    return NextResponse.json({ error: 'Zu viele Uploads. Bitte versuch es später nochmal.' }, { status: 429 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const file = form.get('file')
  const submissionId = String(form.get('submissionId') ?? '')
  const uploadToken = String(form.get('uploadToken') ?? '')
  const kind = String(form.get('kind') ?? '')

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Keine Datei erhalten.' }, { status: 400 })
  }
  if (!['before_image', 'after_image', 'audio'].includes(kind)) {
    return NextResponse.json({ error: 'Ungültiger Asset-Typ.' }, { status: 400 })
  }
  if (file.size > MAX_PROXY_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Datei zu groß (max. 8 MB).' }, { status: 413 })
  }

  const draft = await getAuthorizedDraft(submissionId, uploadToken)
  if (!draft) {
    return NextResponse.json({ error: 'Sitzung ungültig oder abgelaufen.' }, { status: 403 })
  }
  if (kind !== 'audio' && draft.category === 'business') {
    return NextResponse.json({ error: 'Für Business-Berichte gibt es keine Vorher-Nachher-Fotos.' }, { status: 400 })
  }

  const assets = await getVerifiedAssets(submissionId)
  const active = assets.filter(a => a.status !== 'rejected')
  const sameKind = active.filter(a => a.kind === kind)
  const maxForKind = kind === 'audio' ? 1 : MAX_IMAGES_PER_KIND
  if (sameKind.length >= maxForKind) {
    return NextResponse.json({ error: kind === 'audio' ? 'Es ist schon eine Aufnahme gespeichert.' : 'Maximal 5 Fotos pro Kategorie.' }, { status: 400 })
  }
  const totalBytes = active.reduce((sum, a) => sum + (a.sizeBytes ?? 0), 0)
  if (totalBytes + file.size > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: 'Gesamtgröße der Dateien überschritten.' }, { status: 413 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const sig = buffer.subarray(0, 12)
  const detected = kind === 'audio' ? detectAudio(sig) : detectImage(sig)
  if (!detected) {
    return NextResponse.json({ error: kind === 'audio' ? 'Ungültiges Audioformat.' : 'Ungültiges Bildformat.' }, { status: 400 })
  }

  const sortOrder = sameKind.length
  const key = `testimonials/${submissionId}/${kind}-${sortOrder}-${crypto.randomUUID()}.${detected.ext}`
  await uploadToR2(key, buffer, detected.contentType)

  const [asset] = await db.insert(testimonialAssets).values({
    testimonialId: submissionId,
    kind: kind as 'before_image' | 'after_image' | 'audio',
    status: 'verified',
    r2Key: key,
    contentType: detected.contentType,
    sizeBytes: file.size,
    sortOrder,
  }).returning({ id: testimonialAssets.id })

  return NextResponse.json({ assetId: asset.id })
}
