/**
 * GET /api/worker/custom-domain?hostname=www.example.com
 *
 * Internal endpoint for the Cloudflare Worker (protected by WORKER_SECRET).
 * Resolves a customer's own domain to the site it belongs to. The Worker keeps a
 * copy in KV (`custom:{hostname}`), but KV is only a cache: when the entry is missing
 * (never written, daily KV limit reached) the Worker asks here — the database is the
 * source of truth, so a connected domain can never be "active" in the app yet unknown
 * to the Worker.
 *
 * Response (200): { username: string, templateDomain: string }
 * Response (404): hostname is not an active custom domain
 */

import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, userSites, templates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

const WORKER_SECRET = process.env.WORKER_SECRET

function checkSecret(req: NextRequest): boolean {
  if (!WORKER_SECRET) return false // fehlendes Secret = alles ablehnen (fail closed)
  const incoming = req.headers.get('x-worker-secret') ?? ''
  const a = Buffer.from(incoming)
  const b = Buffer.from(WORKER_SECRET)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hostname = req.nextUrl.searchParams.get('hostname')?.trim().toLowerCase()
  if (!hostname) return NextResponse.json({ error: 'hostname required' }, { status: 400 })

  try {
    const [row] = await db
      .select({ username: users.username, templateDomain: templates.domain })
      .from(userSites)
      .innerJoin(users, eq(userSites.userId, users.id))
      .innerJoin(templates, eq(userSites.templateId, templates.id))
      .where(and(eq(userSites.customDomain, hostname), eq(userSites.customDomainStatus, 'active')))
      .limit(1)

    if (!row?.username) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ username: row.username, templateDomain: row.templateDomain })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
