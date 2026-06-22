import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { userSites, formSubmissions } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

async function getOwnedSite(siteId: string, userId: string) {
  const rows = await db
    .select({ id: userSites.id, userId: userSites.userId })
    .from(userSites)
    .where(and(eq(userSites.id, siteId), eq(userSites.userId, userId)))
    .limit(1)
  return rows[0] ?? null
}

// GET /api/sites/[id]/submissions?page=0&form=contact
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const site = await getOwnedSite(id, user.id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '0')
  const form = req.nextUrl.searchParams.get('form')
  const pageSize = 50

  try {
    let query = db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.userSiteId, id))
      .orderBy(desc(formSubmissions.createdAt))
      .limit(pageSize)
      .offset(page * pageSize)

    if (form) {
      query = db
        .select()
        .from(formSubmissions)
        .where(and(eq(formSubmissions.userSiteId, id), eq(formSubmissions.formName, form)))
        .orderBy(desc(formSubmissions.createdAt))
        .limit(pageSize)
        .offset(page * pageSize)
    }

    const data = await query
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/sites/[id]/submissions?submissionId=xxx
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const site = await getOwnedSite(id, user.id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const submissionId = req.nextUrl.searchParams.get('submissionId')

  try {
    if (submissionId) {
      await db
        .delete(formSubmissions)
        .where(and(eq(formSubmissions.id, submissionId), eq(formSubmissions.userSiteId, id)))
    } else {
      // Delete all submissions for this site
      await db.delete(formSubmissions).where(eq(formSubmissions.userSiteId, id))
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
