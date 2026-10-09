import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

/** Gleiche Prüfung wie in den anderen /api/worker/*-Routen: fehlendes Secret = alles ablehnen. */
export function checkWorkerSecret(req: NextRequest): boolean {
  const secret = process.env.WORKER_SECRET
  if (!secret) return false
  const a = Buffer.from(req.headers.get('x-worker-secret') ?? '')
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}
