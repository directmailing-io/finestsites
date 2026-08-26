import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { testimonials, testimonialAssets } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { deleteFromR2 } from '@/lib/r2/client'
import { assertAdmin } from '@/lib/testimonials/admin'

const ALLOWED_STATUS = ['new', 'reviewed', 'published', 'rejected'] as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await assertAdmin(req)
  if (err) return err
  const { id } = await params

  const { status } = await req.json().catch(() => ({}))
  if (!ALLOWED_STATUS.includes(status)) {
    return NextResponse.json({ error: 'Ungültiger Status.' }, { status: 400 })
  }

  const [updated] = await db.update(testimonials)
    .set({ status, updatedAt: new Date() })
    .where(eq(testimonials.id, id))
    .returning({ id: testimonials.id })
  if (!updated) return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await assertAdmin(req)
  if (err) return err
  const { id } = await params

  const assets = await db.query.testimonialAssets.findMany({
    where: eq(testimonialAssets.testimonialId, id),
  })
  for (const a of assets) {
    await deleteFromR2(a.r2Key).catch(() => {})
  }
  await db.delete(testimonials).where(eq(testimonials.id, id))

  return NextResponse.json({ ok: true })
}
