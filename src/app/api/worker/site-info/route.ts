/**
 * GET /api/worker/site-info
 *
 * Internal endpoint called exclusively by the Cloudflare Worker as part of the
 * fire-and-forget email notification flow after a form submission.
 * NOT intended for browser clients — protected by WORKER_SECRET.
 *
 * Purpose: Provide the Worker with two pieces of data it needs to build and
 * address a notification email:
 *   1. The site owner's account email address (fallback recipient).
 *   2. The form schema — field labels for the email table, a human-readable
 *      form title, and whether email notifications are enabled for this form.
 *
 * The Worker calls this via ctx.waitUntil() so it never blocks the HTTP response
 * to the visitor. If this endpoint fails, the submission is already saved; only
 * the email is missed.
 *
 * Query params:
 *   siteId     — user_site UUID (to look up the site owner's email)
 *   templateId — template UUID (to look up the form schema)
 *   formName   — form identifier, e.g. "contact" (to match the schema row)
 *
 * Response (200):
 *   {
 *     userEmail:  string | null
 *     formSchema: {
 *       title:                    string
 *       fields:                   Array<{ key: string; label: string }>
 *       emailNotificationEnabled: boolean
 *     } | null
 *   }
 *
 * Security: requests without the correct x-worker-secret header are rejected.
 * In development (WORKER_SECRET unset) all requests are allowed through.
 */

import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, userSites, formSchemas } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

const WORKER_SECRET = process.env.WORKER_SECRET

function checkSecret(req: NextRequest): boolean {
  if (!WORKER_SECRET) return true
  const incoming = req.headers.get('x-worker-secret') ?? ''
  const a = Buffer.from(incoming)
  const b = Buffer.from(WORKER_SECRET)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const siteId = req.nextUrl.searchParams.get('siteId')
  const templateId = req.nextUrl.searchParams.get('templateId')
  const formName = req.nextUrl.searchParams.get('formName')

  if (!siteId || !templateId || !formName) {
    return NextResponse.json({ error: 'siteId, templateId and formName required' }, { status: 400 })
  }

  try {
    // Two independent queries — we need the account email regardless of whether
    // a form schema exists, and the schema is keyed on templateId+formName (not siteId).
    const [siteRow] = await db
      .select({ email: users.email })
      .from(userSites)
      .innerJoin(users, eq(userSites.userId, users.id))
      .where(eq(userSites.id, siteId))
      .limit(1)

    const [schemaRow] = await db
      .select({
        title: formSchemas.title,
        fields: formSchemas.fields,
        emailNotificationEnabled: formSchemas.emailNotificationEnabled,
      })
      .from(formSchemas)
      .where(and(eq(formSchemas.templateId, templateId), eq(formSchemas.formName, formName)))
      .limit(1)

    return NextResponse.json({
      userEmail: siteRow?.email ?? null,
      // null when the template has no schema configured for this form name
      formSchema: schemaRow ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
