import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { userSites, formSubmissions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

async function getOwnedSite(siteId: string, userId: string) {
  return db.query.userSites.findFirst({
    where: and(eq(userSites.id, siteId), eq(userSites.userId, userId)),
  })
}

type Params = { params: Promise<{ id: string; submissionId: string }> }

// PATCH /api/sites/[id]/submissions/[submissionId]
// Body: { read?: boolean, archived?: boolean }
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, submissionId } = await params
  const site = await getOwnedSite(id, user.id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as { read?: boolean; archived?: boolean }
  const update: Record<string, Date | null> = {}

  if ('read' in body) {
    update.readAt = body.read ? new Date() : null
  }
  if ('archived' in body) {
    update.archivedAt = body.archived ? new Date() : null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  await db.update(formSubmissions)
    .set(update)
    .where(and(eq(formSubmissions.id, submissionId), eq(formSubmissions.userSiteId, id)))

  return NextResponse.json({ success: true })
}

// DELETE /api/sites/[id]/submissions/[submissionId]
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, submissionId } = await params
  const site = await getOwnedSite(id, user.id)
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.delete(formSubmissions)
    .where(and(eq(formSubmissions.id, submissionId), eq(formSubmissions.userSiteId, id)))

  return NextResponse.json({ success: true })
}
