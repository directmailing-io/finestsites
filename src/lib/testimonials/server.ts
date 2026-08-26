import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { testimonials, testimonialAssets } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

// ── Rate limiting (in-memory, pro Route eine Map) ─────────────────────────────

type RateEntry = { count: number; resetAt: number }

export function createRateLimiter(limit: number, windowMs: number) {
  const map = new Map<string, RateEntry>()
  return (ip: string): boolean => {
    const now = Date.now()
    if (map.size > 10_000) {
      for (const [k, v] of map) if (now > v.resetAt) map.delete(k)
    }
    const entry = map.get(ip)
    if (!entry || now > entry.resetAt) {
      map.set(ip, { count: 1, resetAt: now + windowMs })
      return true
    }
    if (entry.count >= limit) return false
    entry.count++
    return true
  }
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// ── Autorisierung anonymer Folge-Requests über das uploadToken ────────────────

export async function getAuthorizedDraft(submissionId: string, uploadToken: string) {
  if (!submissionId || !uploadToken || uploadToken.length < 32) return null
  const row = await db.query.testimonials.findFirst({
    where: and(eq(testimonials.id, submissionId), eq(testimonials.uploadToken, uploadToken)),
  })
  if (!row || row.status !== 'draft') return null
  return row
}

export async function getVerifiedAssets(testimonialId: string) {
  return db.query.testimonialAssets.findMany({
    where: eq(testimonialAssets.testimonialId, testimonialId),
  })
}

// ── Limits ────────────────────────────────────────────────────────────────────

export const MAX_IMAGES_PER_KIND = 5
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024
export const MAX_PROXY_UPLOAD_BYTES = 8 * 1024 * 1024
export const MAX_TOTAL_BYTES = 250 * 1024 * 1024
export const MAX_TEXT_LENGTH = 6000
