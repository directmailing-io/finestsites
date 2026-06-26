/**
 * GET /api/worker/site-data
 *
 * Internal endpoint called exclusively by the Cloudflare Worker during HTML rendering.
 * NOT intended for browser clients — protected by WORKER_SECRET.
 *
 * Purpose: Return all placeholder key/value pairs for a user site so the Worker
 * can substitute them into the template's HTML (e.g. {{business_name}} → "Muster GmbH").
 * This call happens on every KV cache miss for the rendered HTML. Once the Worker
 * has rendered and cached the result in KV (60s TTL), this endpoint is not hit again
 * until the cache expires or is explicitly purged.
 *
 * Query params:
 *   siteId — the user_site UUID
 *
 * Response (200):
 *   Array<{ fieldKey: string; fieldValue: string | null }>
 *
 * Security: requests without the correct x-worker-secret header are rejected.
 * In development (WORKER_SECRET unset) all requests are allowed through.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { siteData } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const WORKER_SECRET = process.env.WORKER_SECRET

function checkSecret(req: NextRequest): boolean {
  if (!WORKER_SECRET) return true
  return req.headers.get('x-worker-secret') === WORKER_SECRET
}

export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const siteId = req.nextUrl.searchParams.get('siteId')
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 })
  }

  try {
    // Fetch all rows for the site — the Worker converts this flat array into a
    // key→value map (Data = Record<string, string>) before passing it to render().
    const rows = await db
      .select({ fieldKey: siteData.fieldKey, fieldValue: siteData.fieldValue })
      .from(siteData)
      .where(eq(siteData.userSiteId, siteId))

    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
