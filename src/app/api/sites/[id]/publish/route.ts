import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { userSites, siteData, users, templates } from '@/lib/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { purgeSiteCache, markSiteOffline } from '@/lib/cloudflare/kv'
import { writeRenderedHtmlKV } from '@/lib/cloudflare/kv-api'
import { renderTemplate } from '@/lib/utils/template-engine'

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

async function fetchTemplateHtml(path: string): Promise<string> {
  const resp = await r2Client.send(new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
    Key: path,
  }))
  return await resp.Body!.transformToString('utf-8')
}

/**
 * Pre-render the template with the user's data and write directly into the
 * Worker's KV cache. The Worker reads `rendered:{username}:{domain}` first
 * and serves the cached HTML without invoking its own rendering pass — this
 * means the live page always uses the canonical Vercel template engine,
 * even if the Worker code itself is older.
 */
async function preRenderAndPushToKV(
  username: string,
  templateDomain: string,
  r2Path: string,
  siteDataMap: Record<string, string>,
): Promise<void> {
  try {
    const templateHtml = await fetchTemplateHtml(r2Path)
    const rendered = renderTemplate(templateHtml, siteDataMap)
    await writeRenderedHtmlKV(username, templateDomain, rendered)
  } catch (err) {
    console.error('[publish] pre-render failed:', err)
    // Non-blocking: even if pre-render fails the publish still succeeds and
    // the Worker will render on-demand (its own engine, possibly older).
  }
}

// Current consent text version — bump when text changes so old consents can be distinguished
const CONSENT_VERSION = 'v1'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Parse optional consent flag from body
  let consentGiven = false
  try {
    const body = await req.json()
    consentGiven = body?.consent === true
  } catch { /* no body or not JSON — that's fine */ }

  // Get site with template info
  const site = await db.query.userSites.findFirst({
    where: and(eq(userSites.id, id), eq(userSites.userId, user.id)),
    with: { template: true },
  })

  if (!site) return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })
  if (!site.template?.r2BundlePath) {
    return NextResponse.json({ error: 'Template hat keine HTML-Datei.' }, { status: 400 })
  }

  // Fetch username
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  })
  const username = userRow?.username
  if (!username) {
    return NextResponse.json({ error: 'Kein Benutzername gesetzt. Bitte erst in Einstellungen setzen.' }, { status: 400 })
  }

  // ── Subscription + plan-limit check ────────────────────────────────────
  // Free templates can always be published without a subscription.
  // Premium templates require an active subscription AND must be within the plan's site limit.
  const tplIsFree = site.template.isFree ?? false
  if (!tplIsFree) {
    const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
    const profile = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    })

    // Gate 1: Must have an active subscription
    const hasActiveSub =
      !!profile?.subscriptionStatus &&
      ACTIVE_STATUSES.includes(profile.subscriptionStatus)

    if (!hasActiveSub) {
      return NextResponse.json({
        error: 'Wähle einen Tarif, um deine Webseite zu veröffentlichen.',
        code: 'SUBSCRIPTION_REQUIRED',
      }, { status: 402 })
    }

    // Gate 2: Must be within the plan's site quota
    const plan = profile?.plan ?? 'starter'
    const PLAN_LIMITS: Record<string, number> = { starter: 1, pro: 3, unlimited: Infinity, secret: Infinity }
    const limit = PLAN_LIMITS[plan] ?? 1

    const otherPublished = await db.query.userSites.findMany({
      where: and(
        eq(userSites.userId, user.id),
        eq(userSites.status, 'published'),
        ne(userSites.id, id),
      ),
      with: { template: true },
    })

    const otherPaidCount = otherPublished.filter(s => !s.template?.isFree).length

    if (otherPaidCount >= limit) {
      return NextResponse.json({
        error: `Plan-Limit erreicht. Dein ${plan}-Plan erlaubt ${limit} ${limit === 1 ? 'aktive Premium-Webseite' : 'aktive Premium-Webseiten'}. Bitte upgrade oder nimm eine andere Seite offline.`,
        code: 'PLAN_LIMIT_REACHED',
      }, { status: 403 })
    }
  }

  // ── Content consent gate ───────────────────────────────────────────────────
  // User must have completed the onboarding consent step (users.content_consent_at).
  // This replaces the old per-site consent modal — consent is now collected once at onboarding.
  if (!userRow.contentConsentAt) {
    return NextResponse.json({ code: 'CONSENT_REQUIRED', error: 'Bitte bestätige zuerst die Nutzungsbedingungen unter Einstellungen.' }, { status: 403 })
  }

  // Update to published
  await db.update(userSites)
    .set({ status: 'published', publishedAt: new Date() })
    .where(eq(userSites.id, id))

  // Purge KV cache so the Worker picks up the new status immediately
  await purgeSiteCache(username, site.template.domain)

  // Pre-render the page with the canonical Vercel engine and write it
  // directly to Worker KV — bypasses the Worker's own rendering pass.
  const dataRows = await db.query.siteData.findMany({
    where: eq(siteData.userSiteId, id),
  })
  const dataMap: Record<string, string> = {}
  for (const row of dataRows) dataMap[row.fieldKey] = row.fieldValue ?? ''
  await preRenderAndPushToKV(username, site.template.domain, site.template.r2BundlePath, dataMap)

  const url = `https://${username}.${site.template.domain}`
  return NextResponse.json({ success: true, url })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Fetch site info before unpublishing so we can purge the correct cache keys
  const site = await db.query.userSites.findFirst({
    where: and(eq(userSites.id, id), eq(userSites.userId, user.id)),
    with: { template: true },
  })

  if (!site) return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })

  await db.update(userSites)
    .set({ status: 'draft' })
    .where(and(eq(userSites.id, id), eq(userSites.userId, user.id)))

  // Purge KV cache immediately so the Worker stops serving the site
  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  const username = userRow?.username
  const domain = site.template?.domain
  if (username && domain) {
    await markSiteOffline(username, domain)
  }

  return NextResponse.json({ success: true })
}
