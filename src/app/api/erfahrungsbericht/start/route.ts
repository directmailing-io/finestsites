import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { testimonials } from '@/lib/db/schema'
import { createRateLimiter, getClientIp } from '@/lib/testimonials/server'

const rateLimit = createRateLimiter(3, 60 * 60_000)

const CATEGORIES = ['produkte', 'stoffwechselkur', 'business'] as const

export async function POST(req: NextRequest) {
  if (!rateLimit(getClientIp(req))) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte versuch es später nochmal.' }, { status: 429 })
  }

  const { category } = await req.json().catch(() => ({}))
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Ungültige Kategorie.' }, { status: 400 })
  }

  const uploadToken = randomBytes(24).toString('hex')
  const [row] = await db.insert(testimonials).values({
    category,
    uploadToken,
  }).returning({ id: testimonials.id })

  return NextResponse.json({ submissionId: row.id, uploadToken })
}
