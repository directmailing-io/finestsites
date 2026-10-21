import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { templates, templateAccess } from '@/lib/db/schema'
import { eq, desc, inArray } from 'drizzle-orm'
import { appClientPlatform } from '@/lib/app-mode'

// GET /api/templates → published templates visible to the current user
// - is_test=false templates: always visible
// - is_test=true templates: only visible if user is in template_access
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Fetch all published templates and user's access grants in parallel
    const [allTemplates, accessRows] = await Promise.all([
      db
        .select({
          id: templates.id,
          title: templates.title,
          description: templates.description,
          domain: templates.domain,
          previewImages: templates.previewImages,
          placeholderSchema: templates.placeholderSchema,
          isTest: templates.isTest,
          isFree: templates.isFree,
          nmCompanies: templates.nmCompanies,
          isAllrounder: templates.isAllrounder,
          tags: templates.tags,
          badge: templates.badge,
          status: templates.status,
        })
        .from(templates)
        .where(inArray(templates.status, ['published', 'coming_soon']))
        .orderBy(desc(templates.createdAt)),
      db
        .select({ templateId: templateAccess.templateId })
        .from(templateAccess)
        .where(eq(templateAccess.userId, user.id)),
    ])

    const whitelisted = new Set(accessRows.map(r => r.templateId))

    // Filter: show non-test templates + whitelisted test templates
    const visible = allTemplates
      .filter(t => !t.isTest || whitelisted.has(t.id))
      .map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        domain: t.domain,
        preview_images: t.previewImages,
        placeholder_schema: t.placeholderSchema,
        is_test: t.isTest,
        is_free: t.isFree,
        nm_companies: (t.nmCompanies as string[] | null) ?? [],
        is_allrounder: t.isAllrounder ?? false,
        tags: (t.tags as string[] | null) ?? [],
        badge: t.badge ?? null,
        is_coming_soon: t.status === 'coming_soon',
      }))

    // Native App (Header X-FS-Client): ohne Preis-/Tarif-Signale (Apple 3.1.1), siehe
    // src/lib/contracts/app-v1/templates.ts. Die Web-Seiten im Editor-WebView der App (Cookie fs_app)
    // brauchen die vollen Felder und blenden Preis-Hinweise selbst aus. Browser: unverändert.
    if (appClientPlatform(req.headers)) {
      return NextResponse.json(visible.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        domain: t.domain,
        preview_images: Array.isArray(t.preview_images) ? (t.preview_images as unknown[]).filter((x): x is string => typeof x === 'string') : null,
        badge: t.badge === 'brandneu' ? 'brandneu' : null,
        is_coming_soon: t.is_coming_soon,
      })))
    }

    return NextResponse.json(visible)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
