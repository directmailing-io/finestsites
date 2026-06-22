import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { userSites, formSubmissions, templates } from '@/lib/db/schema'
import { eq, inArray, and, isNull, isNotNull, desc } from 'drizzle-orm'

/**
 * GET /api/submissions
 * Global submissions view across all the user's sites.
 *
 * Query params:
 *   status  = 'unread' | 'archived' | 'all' (default: 'all')
 *   siteId  = UUID — filter by specific site
 *   search  = string — fulltext search in data JSONB values
 *   form    = string — filter by form_name
 *   page    = number (default: 0), page size: 50
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const status = sp.get('status') ?? 'all'
  const siteId = sp.get('siteId')
  const search = sp.get('search')?.toLowerCase().trim()
  const form = sp.get('form')
  const page = Math.max(0, parseInt(sp.get('page') ?? '0'))
  const pageSize = 50

  try {
    // Get all site IDs owned by this user
    const ownedSites = await db
      .select({
        id: userSites.id,
        templateTitle: templates.title,
        templateDomain: templates.domain,
      })
      .from(userSites)
      .leftJoin(templates, eq(templates.id, userSites.templateId))
      .where(and(
        eq(userSites.userId, user.id),
        inArray(userSites.status, ['draft', 'published'])
      ))

    if (ownedSites.length === 0) {
      return NextResponse.json({ submissions: [], total: 0 })
    }

    const allSiteIds = ownedSites.map(s => s.id)
    const siteIds = siteId
      ? allSiteIds.filter(id => id === siteId)
      : allSiteIds

    if (siteIds.length === 0) return NextResponse.json({ submissions: [], total: 0 })

    const siteMap = Object.fromEntries(
      ownedSites.map(s => [s.id, { title: s.templateTitle, domain: s.templateDomain }])
    )

    // Build conditions
    const baseConditions = [
      inArray(formSubmissions.userSiteId, siteIds),
      eq(formSubmissions.isSpam, false),
    ]
    if (status === 'unread') {
      baseConditions.push(isNull(formSubmissions.readAt))
      baseConditions.push(isNull(formSubmissions.archivedAt))
    } else if (status === 'archived') {
      baseConditions.push(isNotNull(formSubmissions.archivedAt))
    } else {
      baseConditions.push(isNull(formSubmissions.archivedAt))
    }
    if (form) {
      baseConditions.push(eq(formSubmissions.formName, form))
    }

    const rows = await db
      .select()
      .from(formSubmissions)
      .where(and(...baseConditions))
      .orderBy(desc(formSubmissions.createdAt))
      .limit(pageSize)
      .offset(page * pageSize)

    // Client-side search filter (JSONB text search)
    let submissions = rows
    if (search) {
      submissions = submissions.filter(s =>
        Object.values(s.data as Record<string, string>)
          .some(v => String(v).toLowerCase().includes(search!))
      )
    }

    // Enrich with site metadata
    const enriched = submissions.map(s => ({
      ...s,
      site: siteMap[s.userSiteId] ?? null,
    }))

    return NextResponse.json({ submissions: enriched, total: enriched.length })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
