import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, userSites, formSchemas } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

const WORKER_SECRET = process.env.WORKER_SECRET
function checkSecret(req: NextRequest): boolean {
  if (!WORKER_SECRET) return true
  return req.headers.get('x-worker-secret') === WORKER_SECRET
}

// Returns the user email + form schema for email notifications.
// Called by the CF Worker after a form submission to send a notification email.
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const siteId = req.nextUrl.searchParams.get('siteId')
  const templateId = req.nextUrl.searchParams.get('templateId')
  const formName = req.nextUrl.searchParams.get('formName')

  if (!siteId || !templateId || !formName) {
    return NextResponse.json({ error: 'siteId, templateId and formName required' }, { status: 400 })
  }

  try {
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
      formSchema: schemaRow ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
