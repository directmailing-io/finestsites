import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, userSites, templates } from '@/lib/db/schema'
import { eq, ne } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { newsletterEmail } from '@/lib/email/templates'
import { markupToHtml } from '@/lib/email/markup'

export const runtime = 'nodejs'

interface UserRow {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  username: string | null
  plan: string
  subscription_status: string | null
  publishedTemplateIds: string[]
  has_any_site: boolean
}

interface TemplateRow {
  id: string
  title: string
  tags: string[]
}

interface Filters {
  mode: 'all' | 'filtered' | 'specific'
  plans?: string[]
  subscriptionStatus?: string[]
  siteStatus?: string[]           // 'published' | 'any' | 'none'
  templateIds?: string[]          // specific templates (published by user)
  templateTags?: string[]         // tags on templates user has published
  specificEmails?: string[]
}

async function checkAdmin() {
  const user = await getServerUser()
  if (!user) return null
  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { isAdmin: true },
  })
  return profile?.isAdmin ? user : null
}

async function getEnrichedUsers(): Promise<{ users: UserRow[]; templates: TemplateRow[] }> {
  const [rawUsers, publishedSites, anySites, tplRows] = await Promise.all([
    db.select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, username: users.username, plan: users.plan, subscriptionStatus: users.subscriptionStatus })
      .from(users)
      .orderBy(users.email),
    db.select({ userId: userSites.userId, templateId: userSites.templateId })
      .from(userSites)
      .where(eq(userSites.status, 'published')),
    db.select({ userId: userSites.userId })
      .from(userSites)
      .where(ne(userSites.status, 'deleted')),
    db.select({ id: templates.id, title: templates.title })
      .from(templates)
      .where(eq(templates.status, 'published'))
      .orderBy(templates.title),
  ])

  // Build lookup maps
  const publishedMap = new Map<string, Set<string>>()
  for (const s of publishedSites) {
    if (!publishedMap.has(s.userId)) publishedMap.set(s.userId, new Set())
    publishedMap.get(s.userId)!.add(s.templateId)
  }
  const anyUserIds = new Set(anySites.map(s => s.userId))

  const enrichedUsers: UserRow[] = rawUsers.map(u => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    plan: u.plan,
    subscription_status: u.subscriptionStatus,
    publishedTemplateIds: [...(publishedMap.get(u.id) ?? [])],
    has_any_site: anyUserIds.has(u.id),
  }))

  const tpl: TemplateRow[] = tplRows.map(t => ({
    id: t.id,
    title: t.title,
    tags: [],  // tags column not in current schema
  }))

  return { users: enrichedUsers, templates: tpl }
}

/**
 * Replace placeholders in text. Syntax: {{field}} or {{field|fallback}}
 * Supported fields: vorname, nachname, username, email
 */
function interpolate(text: string, user: UserRow): string {
  return text.replace(/\{\{(\w+)(?:\|([^}]*))?\}\}/g, (_match, field: string, fallback: string | undefined) => {
    const fb = fallback ?? ''
    switch (field) {
      case 'vorname':   return user.firstName?.trim() || fb || 'du'
      case 'nachname':  return user.lastName?.trim()  || fb || ''
      case 'username':  return user.username?.trim()  || fb || ''
      case 'email':     return user.email
      default:          return _match
    }
  })
}

function filterUsers(users: UserRow[], templates: TemplateRow[], filters: Filters): UserRow[] {
  if (filters.mode === 'specific') {
    const specificSet = new Set((filters.specificEmails ?? []).filter(e => e?.includes('@')))
    return users.filter(u => specificSet.has(u.email))
  }

  // Build tag→templateId map for fast lookup
  const tagTemplateIds = new Map<string, Set<string>>()
  for (const t of templates) {
    for (const tag of t.tags ?? []) {
      if (!tagTemplateIds.has(tag)) tagTemplateIds.set(tag, new Set())
      tagTemplateIds.get(tag)!.add(t.id)
    }
  }

  return users.filter(u => {
    if (filters.plans?.length) {
      if (!filters.plans.includes(u.plan)) return false
    }
    if (filters.subscriptionStatus?.length) {
      const isActive = u.subscription_status === 'active'
      const match =
        (filters.subscriptionStatus.includes('active') && isActive) ||
        (filters.subscriptionStatus.includes('inactive') && !isActive)
      if (!match) return false
    }
    if (filters.siteStatus?.length) {
      const hasPublished = u.publishedTemplateIds.length > 0
      const match =
        (filters.siteStatus.includes('published') && hasPublished) ||
        (filters.siteStatus.includes('any') && u.has_any_site) ||
        (filters.siteStatus.includes('none') && !u.has_any_site)
      if (!match) return false
    }
    if (filters.templateIds?.length) {
      const match = filters.templateIds.some(tid => u.publishedTemplateIds.includes(tid))
      if (!match) return false
    }
    if (filters.templateTags?.length) {
      const matchingTplIds = new Set(
        filters.templateTags.flatMap(tag => [...(tagTemplateIds.get(tag) ?? [])])
      )
      const match = u.publishedTemplateIds.some(tid => matchingTplIds.has(tid))
      if (!match) return false
    }
    return true
  })
}

export async function POST(req: NextRequest) {
  const adminUser = await checkAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subject, body, filters }: { subject: string; body: string; filters: Filters } = await req.json()

  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'Betreff und Inhalt erforderlich.' }, { status: 400 })
  }

  const { users: enrichedUsers, templates } = await getEnrichedUsers()
  const recipients = filterUsers(enrichedUsers, templates, filters ?? { mode: 'all' })

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Keine Empfänger gefunden.' }, { status: 400 })
  }

  const BATCH_SIZE = 100
  let sent = 0, failed = 0

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE)
    try {
      const result = await getResend().batch.send(
        chunk.map(user => {
          const personalSubject = interpolate(subject.trim(), user)
          const personalBody = interpolate(body.trim(), user)
          const bodyHtml = markupToHtml(personalBody)
          const html = newsletterEmail({ subject: personalSubject, bodyHtml })
          return {
            from: FROM_EMAIL,
            to: user.email,
            subject: personalSubject,
            html,
            text: personalBody,
          }
        })
      )
      if (result.error) {
        console.error('[newsletter] Resend error:', JSON.stringify(result.error))
        failed += chunk.length
      } else {
        const items = Array.isArray(result.data) ? result.data : []
        const ok = items.filter((r: unknown) => r !== null).length
        sent += ok; failed += chunk.length - ok
      }
    } catch (err) {
      console.error('[newsletter] batch exception:', err)
      failed += chunk.length
    }
  }

  // newsletter_sends is not in the Drizzle schema yet — use raw SQL
  try {
    await db.execute(sql`
      INSERT INTO newsletter_sends (subject, body, recipient_filter, specific_emails, sent, failed, total)
      VALUES (
        ${subject.trim()},
        ${body.trim()},
        ${JSON.stringify(filters ?? { mode: 'all' })},
        ${filters?.mode === 'specific' ? JSON.stringify(recipients.map(u => u.email)) : null},
        ${sent}, ${failed}, ${recipients.length}
      )
    `)
  } catch (err) {
    console.error('[newsletter] failed to record send:', err)
  }

  return NextResponse.json({ sent, failed, total: recipients.length })
}

export async function GET() {
  const adminUser = await checkAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ users: enrichedUsers, templates }, historyResult] = await Promise.all([
    getEnrichedUsers(),
    db.execute(sql`SELECT * FROM newsletter_sends ORDER BY sent_at DESC LIMIT 50`).catch(() => ({ rows: [] })),
  ])

  const history = Array.isArray(historyResult) ? historyResult : (historyResult as any).rows ?? []

  return NextResponse.json({ users: enrichedUsers, templates, history })
}
