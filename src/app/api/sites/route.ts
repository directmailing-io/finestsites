import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, userSites, templates, siteData, formSubmissions, templateAccess } from '@/lib/db/schema'
import { eq, ne, and, inArray, isNull } from 'drizzle-orm'

/**
 * Map user profile fields to common template placeholder keys.
 * These keys match naming conventions used in FinestSites templates.
 * Only non-empty values are included — nothing is overwritten with null/empty.
 */
function buildProfileSiteData(profile: typeof users.$inferSelect): Array<{ fieldKey: string; fieldValue: string }> {
  const mappings: Array<[string | null | undefined, string]> = [
    [profile.firstName,      'vorname'],
    [profile.lastName,       'nachname'],
    [profile.phone,          'phone'],
    [profile.phone,          'telefon'],
    [profile.instagram,      'instagram'],
    [profile.facebook,       'facebook'],
    [profile.linkedin,       'linkedin'],
    [profile.tiktok,         'tiktok'],
    [profile.youtube,        'youtube'],
    [profile.websiteUrl,     'website'],
    [profile.profileImageUrl,'profilbild'],
  ]
  const result = mappings
    .filter(([val]) => val && val.trim() !== '')
    .map(([val, key]) => ({ fieldKey: key, fieldValue: val as string }))

  // FitLine/PM-International: auto-compute shop URLs with sponsor parameter
  if (profile.teamPartnerNumber) {
    const sponsorNum = encodeURIComponent(profile.teamPartnerNumber)
    result.push(
      { fieldKey: 'teampartner_nummer', fieldValue: profile.teamPartnerNumber },
      { fieldKey: 'shop_optimalset', fieldValue: `https://www.fitline.com/de/de-de/products/9700731?sponsor=${sponsorNum}` },
      { fieldKey: 'shop_activize', fieldValue: `https://www.fitline.com/de/de-de/products/0708054?sponsor=${sponsorNum}` },
      { fieldKey: 'shop_joghurt', fieldValue: `https://www.fitline.com/de/de-de/products/9709001?sponsor=${sponsorNum}` },
    )
  }

  return result
}

// GET /api/sites → list current user's sites with template info + username
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Fetch profile (username) and sites in parallel
    const [profile, sites] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, user.id) }),
      db
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
            previewImages: templates.previewImages,
          },
        })
        .from(userSites)
        .leftJoin(templates, eq(userSites.templateId, templates.id))
        .where(and(eq(userSites.userId, user.id), ne(userSites.status, 'deleted')))
        .orderBy(userSites.createdAt),
    ])

    const siteIds = sites.map(s => s.id)

    // Fetch unread submission counts per site
    const unreadMap: Record<string, number> = {}
    if (siteIds.length > 0) {
      const unreadRows = await db
        .select({ userSiteId: formSubmissions.userSiteId })
        .from(formSubmissions)
        .where(
          and(
            inArray(formSubmissions.userSiteId, siteIds),
            isNull(formSubmissions.readAt),
            isNull(formSubmissions.archivedAt),
            eq(formSubmissions.isSpam, false),
          )
        )
      for (const row of unreadRows) {
        unreadMap[row.userSiteId] = (unreadMap[row.userSiteId] ?? 0) + 1
      }
    }

    // Attach username + unread_submissions to each site, return snake_case for API compat
    const result = sites.map(s => ({
      id: s.id,
      user_id: s.userId,
      template_id: s.templateId,
      status: s.status,
      published_at: s.publishedAt,
      deactivated_at: s.deactivatedAt,
      custom_domain: s.customDomain,
      custom_domain_status: s.customDomainStatus,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
      templates: s.template
        ? {
            id: s.template.id,
            title: s.template.title,
            domain: s.template.domain,
            placeholder_schema: s.template.placeholderSchema,
            r2_bundle_path: s.template.r2BundlePath,
            preview_images: s.template.previewImages,
          }
        : null,
      username: profile?.username ?? null,
      unread_submissions: unreadMap[s.id] ?? 0,
    }))

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/sites → create a new draft site for a template
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { template_id } = await req.json()
  if (!template_id) return NextResponse.json({ error: 'template_id required' }, { status: 400 })

  try {
    // Check plan (kept for downstream use) — also used for auto-populating site_data
    const profile = await db.query.users.findFirst({ where: eq(users.id, user.id) })
    const plan = profile?.plan ?? 'starter'

    // Check if the template being activated is a test template the user has no access to
    const tpl = await db.query.templates.findFirst({ where: eq(templates.id, template_id) })
    if (tpl?.isTest) {
      const access = await db.query.templateAccess.findFirst({
        where: and(eq(templateAccess.templateId, template_id), eq(templateAccess.userId, user.id)),
      })
      if (!access) return NextResponse.json({ error: 'Kein Zugriff auf dieses Template.' }, { status: 403 })
    }

    // Drafts do NOT count toward the plan limit — users can freely experiment.
    // The limit is enforced at PUBLISH time (see api/sites/[id]/publish).
    void plan

    // Check for any existing row (including soft-deleted)
    const anyExisting = await db.query.userSites.findFirst({
      where: and(eq(userSites.userId, user.id), eq(userSites.templateId, template_id)),
    })

    if (anyExisting && anyExisting.status !== 'deleted') {
      return NextResponse.json({ id: anyExisting.id, existing: true })
    }

    // Reactivate soft-deleted row (legacy support for pre-hard-delete data).
    // Clear any old field values and submissions first so the user starts blank.
    if (anyExisting && anyExisting.status === 'deleted') {
      await db.delete(siteData).where(eq(siteData.userSiteId, anyExisting.id))
      await db.delete(formSubmissions).where(eq(formSubmissions.userSiteId, anyExisting.id))
      const [updated] = await db
        .update(userSites)
        .set({ status: 'draft', deactivatedAt: null, publishedAt: null, updatedAt: new Date() })
        .where(eq(userSites.id, anyExisting.id))
        .returning()
      // Auto-populate profile fields into site_data for the reactivated site
      if (profile) {
        const profileData = buildProfileSiteData(profile)
        if (profileData.length > 0) {
          await db.insert(siteData).values(
            profileData.map(({ fieldKey, fieldValue }) => ({
              userSiteId: anyExisting.id,
              fieldKey,
              fieldValue,
            }))
          ).onConflictDoNothing()
        }
      }
      return NextResponse.json(updated, { status: 201 })
    }

    const [created] = await db
      .insert(userSites)
      .values({ userId: user.id, templateId: template_id, status: 'draft' })
      .returning()

    // Auto-populate profile fields into site_data for the newly created site
    if (profile) {
      const profileData = buildProfileSiteData(profile)
      if (profileData.length > 0) {
        await db.insert(siteData).values(
          profileData.map(({ fieldKey, fieldValue }) => ({
            userSiteId: created.id,
            fieldKey,
            fieldValue,
          }))
        ).onConflictDoNothing()
      }
    }

    return NextResponse.json(created, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
