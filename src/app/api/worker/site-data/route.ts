import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { siteData } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const WORKER_SECRET = process.env.WORKER_SECRET
function checkSecret(req: NextRequest): boolean {
  if (!WORKER_SECRET) return true
  return req.headers.get('x-worker-secret') === WORKER_SECRET
}

// Returns the site_data key/value pairs for a given user_site_id.
// Called by the Cloudflare Worker to get placeholder values before rendering HTML.
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const siteId = req.nextUrl.searchParams.get('siteId')
  if (!siteId) {
    return NextResponse.json({ error: 'siteId required' }, { status: 400 })
  }

  try {
    const rows = await db
      .select({ fieldKey: siteData.fieldKey, fieldValue: siteData.fieldValue })
      .from(siteData)
      .where(eq(siteData.userSiteId, siteId))

    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
