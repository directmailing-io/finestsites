/**
 * POST /api/worker/submit
 *
 * Internal endpoint called exclusively by the Cloudflare Worker when a visitor
 * submits a form on a user's site. NOT intended for browser clients.
 * Protected by WORKER_SECRET.
 *
 * Why this indirection exists: The Worker runs in the CF edge environment and
 * has no direct database connection. Rather than exposing DB credentials to the
 * Worker, all writes go through this app-side endpoint which has full access to
 * the PostgreSQL database via the standard Drizzle ORM connection pool.
 *
 * The Worker handles rate limiting (5 req / IP / 10 min via KV) and honeypot
 * spam detection BEFORE calling this endpoint, so by the time a request arrives
 * here it has already passed those checks. Spam submissions are still persisted
 * (isSpam=true) so admins can review them, but no notification email is sent.
 *
 * Request body:
 *   {
 *     userSiteId:      string               — UUID of the user_site
 *     formName:        string               — form identifier (e.g. "contact")
 *     data:            Record<string,string> — submitted field values (no _ fields)
 *     submitterIpHash: string | null        — SHA-256 of submitter IP (privacy-safe)
 *     isSpam:          boolean              — true if honeypot field was filled
 *   }
 *
 * Response (200):
 *   { success: true, id: string }
 *
 * Security: requests without the correct x-worker-secret header are rejected.
 * In development (WORKER_SECRET unset) all requests are allowed through.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formSubmissions } from '@/lib/db/schema'

const WORKER_SECRET = process.env.WORKER_SECRET

function checkSecret(req: NextRequest): boolean {
  if (!WORKER_SECRET) return true
  return req.headers.get('x-worker-secret') === WORKER_SECRET
}

export async function POST(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as {
      userSiteId: string
      formName: string
      data: Record<string, string>
      submitterIpHash?: string | null
      isSpam?: boolean
    }

    if (!body.userSiteId || !body.formName) {
      return NextResponse.json({ error: 'userSiteId and formName required' }, { status: 400 })
    }

    const [inserted] = await db
      .insert(formSubmissions)
      .values({
        userSiteId: body.userSiteId,
        formName: body.formName,
        data: body.data ?? {},
        submitterIpHash: body.submitterIpHash ?? null,
        isSpam: body.isSpam ?? false,
      })
      .returning({ id: formSubmissions.id })

    return NextResponse.json({ success: true, id: inserted.id })
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
