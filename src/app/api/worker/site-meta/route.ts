import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, userSites, templates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

const WORKER_SECRET = process.env.WORKER_SECRET

function checkSecret(req: NextRequest): boolean {
  if (!WORKER_SECRET) return true // dev mode: allow all
  return req.headers.get('x-worker-secret') === WORKER_SECRET
}

// Called by the Cloudflare Worker on cache miss.
// Returns site metadata needed to serve a published user site.
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const username = req.nextUrl.searchParams.get('username')
  const domain = req.nextUrl.searchParams.get('domain')

  if (!username || !domain) {
    return NextResponse.json({ error: 'username and domain required' }, { status: 400 })
  }

  try {
    const [row] = await db
      .select({
        siteId: userSites.id,
        templateId: templates.id,
        r2BundlePath: templates.r2BundlePath,
      })
      .from(userSites)
      .innerJoin(users, eq(userSites.userId, users.id))
      .innerJoin(templates, eq(userSites.templateId, templates.id))
      .where(
        and(
          eq(users.username, username),
          eq(templates.domain, domain),
          eq(userSites.status, 'published'),
        )
      )
      .limit(1)

    if (!row || !row.r2BundlePath) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    return NextResponse.json({
      siteId: row.siteId,
      templateId: row.templateId,
      r2BasePath: row.r2BundlePath.replace('/index.html', ''),
    })
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
