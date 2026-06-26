/**
 * GET /api/worker/site-meta
 *
 * Internal endpoint called exclusively by the Cloudflare Worker on a KV cache miss.
 * NOT intended for browser clients — protected by WORKER_SECRET.
 *
 * Purpose: Resolve a (username, template domain) pair to the site's database IDs
 * and R2 storage path. The Worker caches the response in KV for 60 seconds so
 * subsequent requests within that window skip this round-trip entirely.
 *
 * Query params:
 *   username  — the user's slug (e.g. "john")
 *   domain    — the template's base domain (e.g. "myevnt.io")
 *
 * Response (200):
 *   { siteId: string, templateId: string, r2BasePath: string }
 *
 * Security: requests without the correct x-worker-secret header are rejected.
 * In development (WORKER_SECRET unset) all requests are allowed through.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, userSites, templates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

const WORKER_SECRET = process.env.WORKER_SECRET

function checkSecret(req: NextRequest): boolean {
  if (!WORKER_SECRET) return true // dev mode: allow all
  return req.headers.get('x-worker-secret') === WORKER_SECRET
}

export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const username = req.nextUrl.searchParams.get('username')
  const domain = req.nextUrl.searchParams.get('domain')

  if (!username || !domain) {
    return NextResponse.json({ error: 'username and domain required' }, { status: 400 })
  }

  try {
    // Join users → user_sites → templates so we can verify:
    //   - the user actually owns this site (username match)
    //   - the template belongs to the requested domain
    //   - the site is currently published (not draft/offline)
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

    // Strip the trailing /index.html so the Worker can construct arbitrary
    // asset paths like `${r2BasePath}/style.css` without special-casing.
    return NextResponse.json({
      siteId: row.siteId,
      templateId: row.templateId,
      r2BasePath: row.r2BundlePath.replace('/index.html', ''),
    })
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
