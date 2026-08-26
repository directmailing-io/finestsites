import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'
import { ZipArchive } from 'archiver'
import { db } from '@/lib/db'
import { testimonials, testimonialAssets } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { getStreamFromR2 } from '@/lib/r2/client'
import { assertAdmin, assetFilename, nameSlug } from '@/lib/testimonials/admin'

const KIND_TITLES: Record<string, string> = {
  before_image: 'Vorher-Foto',
  after_image: 'Nachher-Foto',
  video: 'Video',
  audio: 'Diktat-Audio',
}

function berichtTxt(t: typeof testimonials.$inferSelect, assetLines: string[]): string {
  const fmt = (d: Date | null) => (d ? d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) : '—')
  return [
    `ERFAHRUNGSBERICHT`,
    ``,
    `Name: ${t.fullName ?? '—'}`,
    `Anzeige: ${t.displayNameMode === 'abbreviated' ? 'Vorname + Initial' : 'Voller Name'}`,
    `Kategorie: ${t.category}`,
    `Alter: ${t.age ?? '—'}`,
    `E-Mail: ${t.email ?? '—'}`,
    `Instagram: ${t.instagram ?? '—'}`,
    `TikTok: ${t.tiktok ?? '—'}`,
    `Facebook: ${t.facebook ?? '—'}`,
    `Texteingabe: ${t.textSource ?? '—'}`,
    `Eingereicht: ${fmt(t.submittedAt)}`,
    `Status: ${t.status}`,
    ``,
    `--- TEXT ---`,
    ``,
    t.text ?? '',
    ``,
    `--- DATEIEN ---`,
    ``,
    ...(assetLines.length ? assetLines : ['(keine)']),
    ``,
    `--- EINWILLIGUNG (Nachweis) ---`,
    ``,
    `Version: ${t.consentVersion ?? '—'}`,
    `Text-Hash (SHA-256): ${t.consentHash ?? '—'}`,
    `IP: ${t.consentIp ?? '—'}`,
    `User-Agent: ${t.consentUa ?? '—'}`,
    `Zeitpunkt: ${fmt(t.consentedAt)}`,
  ].join('\n')
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await assertAdmin(req)
  if (err) return err
  const { id } = await params

  const testimonial = await db.query.testimonials.findFirst({ where: eq(testimonials.id, id) })
  if (!testimonial) return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })

  const assets = await db.query.testimonialAssets.findMany({
    where: and(eq(testimonialAssets.testimonialId, id), eq(testimonialAssets.status, 'verified')),
    orderBy: [asc(testimonialAssets.kind), asc(testimonialAssets.sortOrder), asc(testimonialAssets.createdAt)],
  })

  // Dateinamen vorab bestimmen (laufende Nummer pro Art)
  const counters = new Map<string, number>()
  const entries = assets.map(a => {
    const n = (counters.get(a.kind) ?? 0) + 1
    counters.set(a.kind, n)
    return { asset: a, filename: assetFilename(testimonial.fullName, a.kind, n, a.r2Key) }
  })

  // Medien sind bereits komprimiert — Level 0 spart CPU beim Streamen
  const archive = new ZipArchive({ zlib: { level: 0 } })
  archive.on('error', () => { archive.abort() })

  const assetLines = entries.map(e => `${e.filename} (${KIND_TITLES[e.asset.kind] ?? e.asset.kind})`)
  archive.append(berichtTxt(testimonial, assetLines), { name: 'bericht.txt' })

  for (const e of entries) {
    const stream = await getStreamFromR2(e.asset.r2Key)
    if (stream) archive.append(stream as Readable, { name: e.filename })
  }
  archive.finalize()

  return new NextResponse(Readable.toWeb(archive) as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="erfahrungsbericht_${nameSlug(testimonial.fullName)}.zip"`,
      'Cache-Control': 'no-store',
    },
  })
}
