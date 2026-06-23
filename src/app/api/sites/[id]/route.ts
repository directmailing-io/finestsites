import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, userSites, templates, siteData } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { markSiteOffline } from '@/lib/cloudflare/kv'

async function getSiteForUser(siteId: string, userId: string) {
  const rows = await db
    .select({
      id: userSites.id,
      userId: userSites.userId,
      templateId: userSites.templateId,
      status: userSites.status,
      publishedAt: userSites.publishedAt,
      deactivatedAt: userSites.deactivatedAt,
      customDomain: userSites.customDomain,
      customDomainStatus: userSites.customDomainStatus,
      createdAt: userSites.createdAt,
      updatedAt: userSites.updatedAt,
      template: {
        id: templates.id,
        title: templates.title,
        domain: templates.domain,
        placeholderSchema: templates.placeholderSchema,
        r2BundlePath: templates.r2BundlePath,
      },
    })
    .from(userSites)
    .leftJoin(templates, eq(userSites.templateId, templates.id))
    .where(and(eq(userSites.id, siteId), eq(userSites.userId, userId)))
    .limit(1)
  return rows[0] ?? null
}

// GET /api/sites/[id] → get site with its data
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const site = await getSiteForUser(id, user.id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Load site_data as a flat object { key: value }
  const siteDataRows = await db
    .select({ fieldKey: siteData.fieldKey, fieldValue: siteData.fieldValue })
    .from(siteData)
    .where(eq(siteData.userSiteId, id))

  const dataMap: Record<string, string> = {}
  for (const row of siteDataRows) {
    dataMap[row.fieldKey] = row.fieldValue ?? ''
  }

  // Include username for URL construction
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })

  return NextResponse.json({
    id: site.id,
    user_id: site.userId,
    template_id: site.templateId,
    status: site.status,
    published_at: site.publishedAt,
    deactivated_at: site.deactivatedAt,
    custom_domain: site.customDomain,
    custom_domain_status: site.customDomainStatus,
    created_at: site.createdAt,
    updated_at: site.updatedAt,
    templates: site.template
      ? {
          id: site.template.id,
          title: site.template.title,
          domain: site.template.domain,
          placeholder_schema: site.template.placeholderSchema,
          r2_bundle_path: site.template.r2BundlePath,
        }
      : null,
    data: dataMap,
    username: profile?.username ?? null,
  })
}

// PATCH /api/sites/[id] → save field values (upsert site_data rows)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const site = await getSiteForUser(id, user.id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Upsert each field value
  const upserts = Object.entries(body as Record<string, string>).map(([fieldKey, fieldValue]) => ({
    userSiteId: id,
    fieldKey,
    fieldValue: fieldValue ?? '',
    updatedAt: new Date(),
  }))

  if (upserts.length > 0) {
    try {
      await db
        .insert(siteData)
        .values(upserts)
        .onConflictDoUpdate({
          target: [siteData.userSiteId, siteData.fieldKey],
          set: { fieldValue: sql`excluded.field_value`, updatedAt: new Date() },
        })
    } catch {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  // If the site is already published, refresh the Worker's pre-rendered KV
  // entry so visitors see edits without waiting for the next publish click.
  // Non-blocking — autosave succeeds even if the KV write fails.
  if (site.status === 'published') {
    ;(async () => {
      try {
        const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
        const username = profile?.username
        const domain = site.template?.domain
        const r2BundlePath = site.template?.r2BundlePath
        if (username && domain && r2BundlePath) {
          const rows = await db
            .select({ fieldKey: siteData.fieldKey, fieldValue: siteData.fieldValue })
            .from(siteData)
            .where(eq(siteData.userSiteId, id))
          const siteDataMap: Record<string, string> = {}
          for (const r of rows) siteDataMap[r.fieldKey] = r.fieldValue ?? ''
          const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
          const { renderTemplate } = await import('@/lib/utils/template-engine')
          const { writeRenderedHtmlKV } = await import('@/lib/cloudflare/kv-api')
          const client = new S3Client({
            region: 'auto', endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
            credentials: {
              accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
              secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
            },
          })
          const resp = await client.send(new GetObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
            Key: r2BundlePath,
          }))
          const tplHtml = await resp.Body!.transformToString('utf-8')
          const rendered = renderTemplate(tplHtml, siteDataMap)
          await writeRenderedHtmlKV(username, domain, rendered)
        }
      } catch (err) {
        console.error('[PATCH] pre-render KV refresh failed:', err)
      }
    })()
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/sites/[id] → HARD DELETE
//
// Permanently removes the user_site row. The ON DELETE CASCADE foreign keys
// on `site_data` and `form_submissions` automatically remove all related rows,
// so the user truly starts from scratch the next time they activate this
// template (no field values, no submissions, no leftover state).
//
// Also: if the site was published we proactively purge the Cloudflare KV cache
// so the public worker stops serving it immediately.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Fetch info before deletion so we can purge KV
  const site = await getSiteForUser(id, user.id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Purge Worker cache if it was live
  if (site.status === 'published') {
    const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
    const username = profile?.username
    const domain = site.template?.domain
    if (username && domain) {
      try { await markSiteOffline(username, domain) } catch { /* non-fatal */ }
    }
  }

  // Hard delete — site_data + form_submissions cascade away
  try {
    await db.delete(userSites).where(and(eq(userSites.id, id), eq(userSites.userId, user.id)))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
