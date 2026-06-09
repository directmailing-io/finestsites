import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { newsletterEmail, textToHtml } from '@/lib/email/templates'

export const runtime = 'nodejs'

interface UserRow {
  id: string
  email: string
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ? user : null
}

async function getEnrichedUsers(admin: ReturnType<typeof createAdminClient>): Promise<{ users: UserRow[]; templates: TemplateRow[] }> {
  const [
    { data: rawUsers },
    { data: publishedSites },
    { data: anySites },
    { data: templates },
  ] = await Promise.all([
    admin.from('users').select('id, email, plan, subscription_status').order('email'),
    admin.from('user_sites').select('user_id, template_id').eq('status', 'published'),
    admin.from('user_sites').select('user_id').neq('status', 'deleted'),
    admin.from('templates').select('id, title, tags').eq('status', 'published').order('title'),
  ])

  // Build lookup maps
  const publishedMap = new Map<string, Set<string>>()
  for (const s of publishedSites ?? []) {
    if (!publishedMap.has(s.user_id)) publishedMap.set(s.user_id, new Set())
    publishedMap.get(s.user_id)!.add(s.template_id)
  }
  const anyUserIds = new Set((anySites ?? []).map((s: { user_id: string }) => s.user_id))

  const users: UserRow[] = (rawUsers ?? []).map((u: { id: string; email: string; plan: string; subscription_status: string | null }) => ({
    id: u.id,
    email: u.email,
    plan: u.plan,
    subscription_status: u.subscription_status,
    publishedTemplateIds: [...(publishedMap.get(u.id) ?? [])],
    has_any_site: anyUserIds.has(u.id),
  }))

  const tpl: TemplateRow[] = (templates ?? []).map((t: { id: string; title: string; tags: string[] | null }) => ({
    id: t.id,
    title: t.title,
    tags: t.tags ?? [],
  }))

  return { users, templates: tpl }
}

function filterEmails(users: UserRow[], templates: TemplateRow[], filters: Filters): string[] {
  if (filters.mode === 'specific') {
    return (filters.specificEmails ?? []).filter(e => e?.includes('@'))
  }

  // Build tag→templateId map for fast lookup
  const tagTemplateIds = new Map<string, Set<string>>()
  for (const t of templates) {
    for (const tag of t.tags ?? []) {
      if (!tagTemplateIds.has(tag)) tagTemplateIds.set(tag, new Set())
      tagTemplateIds.get(tag)!.add(t.id)
    }
  }

  return users
    .filter(u => {
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
        // User must have published a site with at least one of the selected tags
        const matchingTplIds = new Set(
          filters.templateTags.flatMap(tag => [...(tagTemplateIds.get(tag) ?? [])])
        )
        const match = u.publishedTemplateIds.some(tid => matchingTplIds.has(tid))
        if (!match) return false
      }
      return true
    })
    .map(u => u.email)
    .filter(Boolean)
}

export async function POST(req: NextRequest) {
  const adminUser = await checkAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subject, body, filters }: { subject: string; body: string; filters: Filters } = await req.json()

  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'Betreff und Inhalt erforderlich.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { users, templates } = await getEnrichedUsers(admin)
  const emails = filterEmails(users, templates, filters ?? { mode: 'all' })

  if (emails.length === 0) {
    return NextResponse.json({ error: 'Keine Empfänger gefunden.' }, { status: 400 })
  }

  const html = newsletterEmail({ subject: subject.trim(), bodyHtml: textToHtml(body.trim()) })

  const BATCH_SIZE = 100
  let sent = 0, failed = 0

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE)
    try {
      const result = await getResend().batch.send(
        chunk.map(to => ({ from: FROM_EMAIL, to, subject: subject.trim(), html }))
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

  await admin.from('newsletter_sends').insert({
    subject: subject.trim(),
    body: body.trim(),
    recipient_filter: JSON.stringify(filters ?? { mode: 'all' }),
    specific_emails: filters?.mode === 'specific' ? emails : null,
    sent, failed, total: emails.length,
  })

  return NextResponse.json({ sent, failed, total: emails.length })
}

export async function GET() {
  const adminUser = await checkAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [{ users, templates }, { data: history }] = await Promise.all([
    getEnrichedUsers(admin),
    admin.from('newsletter_sends').select('*').order('sent_at', { ascending: false }).limit(50),
  ])

  return NextResponse.json({ users, templates, history: history ?? [] })
}
