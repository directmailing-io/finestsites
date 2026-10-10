/**
 * POST /api/sites/[id]/publish   — publishes a user site (renders HTML → KV, sets status=published)
 * DELETE /api/sites/[id]/publish — takes a site offline (sets status=draft, purges KV cache)
 *
 * Publish gates (checked in order):
 *   1. Auth:         valid session required
 *   2. Ownership:    site must belong to the authenticated user
 *   3. Template:     template must have an R2 HTML bundle
 *   4. Subscription: premium templates require an active subscription within the plan quota
 *   5. Consent:      user must have completed the onboarding content-consent step
 *   6. Impressum:    required "impressum_*" schema fields must be filled
 *
 * After all gates pass, the route:
 *   a. Marks the site as published in the DB
 *   b. Purges the Cloudflare Worker KV cache for the affected domain
 *   c. Pre-renders the template with the user's placeholder data and writes
 *      the rendered HTML back to Worker KV so the first request is instant
 */
import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { userSites, siteData, users } from '@/lib/db/schema'
import { findBlockedTerms } from '@/lib/compliance/check'
import { eq, and, ne } from 'drizzle-orm'
import { purgeSiteCache, markSiteOffline } from '@/lib/cloudflare/kv'
import { writeRenderedHtmlKV } from '@/lib/cloudflare/kv-api'
import { renderTemplate, rawKeysFromSchema } from '@/lib/utils/template-engine'
import { shouldBeOffline } from '@/lib/billing/site-access'

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
  rawKeys: Set<string> = new Set(),
  og?: { siteId: string; host: string },
): Promise<void> {
  try {
    const templateHtml = await fetchTemplateHtml(r2Path)
    const rendered = renderTemplate(templateHtml, siteDataMap, { rawKeys, og: og ? { templateDomain, ...og } : undefined })
    await writeRenderedHtmlKV(username, templateDomain, rendered)
  } catch (err) {
    console.error('[publish] pre-render failed:', err)
    // Non-blocking: even if pre-render fails the publish still succeeds and
    // the Worker will render on-demand (its own engine, possibly older).
  }
}

// Plan quotas: how many published premium sites each plan allows
const PLAN_LIMITS: Record<string, number> = { starter: 1, pro: 3, unlimited: Infinity, secret: Infinity }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Load site + template in one query
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

  // ── Gate 3: Subscription + plan-limit ─────────────────────────────────────
  // Free templates are always publishable. Premium templates need an active
  // subscription AND must not exceed the plan's concurrent-site quota.
  const tplIsFree = site.template.isFree ?? false
  if (!tplIsFree) {
    // Users whose sites are offline for an open payment are NOT allowed to
    // publish: the sites come back automatically once it's paid. Letting them
    // republish here would silently undo that. Inside the grace period the
    // sites are online anyway, so publishing is fine.
    const status = userRow.subscriptionStatus ?? ''
    if (shouldBeOffline(userRow)) {
      return NextResponse.json({
        error: 'Deine letzte Zahlung ist noch offen. Sobald sie eingegangen ist, gehen deine Webseiten automatisch wieder online.',
        code: 'PAYMENT_PENDING',
      }, { status: 402 })
    }
    // past_due without a failed payment = SEPA payment still processing → counts as paying
    const hasActiveSub = status === 'active' || status === 'trialing' || status === 'past_due'

    if (!hasActiveSub) {
      return NextResponse.json({
        error: 'Wähle einen Tarif, um deine Webseite zu veröffentlichen.',
        code: 'SUBSCRIPTION_REQUIRED',
      }, { status: 402 })
    }

    const plan = userRow.plan ?? 'starter'
    const limit = PLAN_LIMITS[plan] ?? 1

    // Count other published premium sites (not this one)
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

  // ── Gate 3b: Compliance der Richtext-Felder ────────────────────────────────
  // Felder mit compliance_check (Über mich, Intro) müssen (a) per KI-Prüfung freigegeben
  // sein (gespeicherte Freigabe = genau dieser Text) und (b) frei von Krankheits-/
  // Symptombegriffen sein. Eine alte Freigabe mit solchen Begriffen gilt nicht mehr
  // (Hinweis von PM-International, 08.10.2026). Veröffentlichte Seiten bleiben online,
  // aber jede neue Veröffentlichung verlangt die Korrektur.
  {
    const normText = (v: string) => v.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
    const complianceRows = await db.select({ k: siteData.fieldKey, v: siteData.fieldValue }).from(siteData).where(eq(siteData.userSiteId, id))
    const siteDataMap: Record<string, string> = {}
    for (const r of complianceRows) siteDataMap[r.k] = r.v ?? ''
    const complianceFields = ((site.template.placeholderSchema as { fields?: { key: string; type?: string; compliance_check?: boolean; label?: string }[] } | null)?.fields ?? [])
      .filter(f => f.compliance_check && f.type === 'richtext')
    for (const f of complianceFields) {
      const text = siteDataMap[f.key] ?? ''
      if (!normText(text)) continue
      const blocked = findBlockedTerms(text)
      if (blocked.length) {
        return NextResponse.json({
          error: `Dein Text „${f.label ?? f.key}“ enthält Formulierungen mit Krankheits- oder Symptombezug (${blocked.map(b => b.reason.split(':')[0]).join(', ')}). Bitte lass ihn im Editor prüfen und übernimm den Vorschlag, dann kannst du veröffentlichen.`,
          code: 'COMPLIANCE_BLOCKED',
          field: f.key,
        }, { status: 403 })
      }
      const approved = [siteDataMap[f.key + '__chk'], siteDataMap[f.key + '__chkbase']].some(a => a && normText(a) === normText(text))
      if (!approved) {
        return NextResponse.json({
          error: `Bitte lass deinen Text „${f.label ?? f.key}“ im Editor prüfen (Button „Prüfen“), bevor du veröffentlichst.`,
          code: 'COMPLIANCE_REQUIRED',
          field: f.key,
        }, { status: 403 })
      }
    }
  }

  // ── Gate 4: Content consent ────────────────────────────────────────────────
  // Consent is collected once during onboarding (users.content_consent_at).
  // Previously this was also checked per-site, but that caused a duplicate
  // modal. Now a single onboarding step covers all publishes for that user.
  if (!userRow.contentConsentAt) {
    return NextResponse.json({
      code: 'CONSENT_REQUIRED',
      error: 'Bitte bestätige zuerst die Nutzungsbedingungen unter Einstellungen.',
    }, { status: 403 })
  }

  // ── Gate 5: Impressum ──────────────────────────────────────────────────────
  // Pflichtangaben fürs Impressum (Schema-Felder "impressum_*" mit required) werden
  // auch hier geprüft, nicht nur im Editor — ohne sie geht keine Seite online.
  const schemaFields = ((site.template.placeholderSchema as { fields?: { key: string; label?: string; required?: boolean; show_when?: unknown }[] } | null)?.fields) ?? []
  const legalRequired = schemaFields.filter(f => f.required && !f.show_when && f.key.startsWith('impressum_'))
  if (legalRequired.length > 0) {
    const rows = await db.query.siteData.findMany({ where: eq(siteData.userSiteId, id) })
    const filled = new Set(rows.filter(r => (r.fieldValue ?? '').trim()).map(r => r.fieldKey))
    const missing = legalRequired.filter(f => !filled.has(f.key))
    if (missing.length > 0) {
      return NextResponse.json({
        code: 'IMPRESSUM_REQUIRED',
        error: `Bitte fülle zuerst dein Impressum aus: ${missing.map(f => f.label ?? f.key).join(', ')}.`,
      }, { status: 400 })
    }
  }

  // ── Publish ────────────────────────────────────────────────────────────────
  await db.update(userSites)
    .set({ status: 'published', publishedAt: new Date() })
    .where(eq(userSites.id, id))

  // Purge KV cache so the Worker picks up the new status immediately
  await purgeSiteCache(username, site.template.domain)

  // Make sure the EN translation of the about text exists before rendering
  // (Wellpreneur dual-language template). Blocking on purpose: the published
  // page must never go live with an empty EN about section.
  try {
    const { ensureAboutMeTranslation, templateLangs } = await import('@/lib/utils/translate')
    await ensureAboutMeTranslation(id, templateLangs(site.template.domain))
  } catch (err) {
    console.error('[publish] about_me translation failed:', err)
  }

  // Pre-render the page with the canonical Vercel engine and write it
  // directly to Worker KV — bypasses the Worker's own rendering pass.
  // Entwurf einfrieren: ab jetzt liefert der Worker diesen Stand aus (Entwurf ≠ Live)
  const { snapshotPublishedData } = await import('@/lib/sites/published-data')
  const dataMap = await snapshotPublishedData(id)
  const liveHost = site.customDomain && site.customDomainStatus === 'active' ? site.customDomain : `${username}.${site.template.domain}`
  await preRenderAndPushToKV(username, site.template.domain, site.template.r2BundlePath, dataMap, rawKeysFromSchema(site.template.placeholderSchema), { siteId: id, host: liveHost })

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
