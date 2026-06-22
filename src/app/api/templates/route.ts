import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { templates, templateAccess } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

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
        })
        .from(templates)
        .where(eq(templates.status, 'published'))
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
      }))

    return NextResponse.json(visible)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
