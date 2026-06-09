import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { purgeSiteCache, markSiteOffline } from '@/lib/cloudflare/kv'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Get site with template info (also need is_free for the plan-limit check)
  const { data: site } = await admin.from('user_sites')
    .select('*, templates(id, domain, r2_bundle_path, is_free), users!user_id(username)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!site) return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })
  if (!site.templates?.r2_bundle_path) {
    return NextResponse.json({ error: 'Template hat keine HTML-Datei.' }, { status: 400 })
  }

  const username = (site.users as unknown as { username: string })?.username
  if (!username) {
    return NextResponse.json({ error: 'Kein Benutzername gesetzt. Bitte erst in Einstellungen setzen.' }, { status: 400 })
  }

  // ── Plan-limit check ───────────────────────────────────────────────────
  // Count only OTHER currently-published non-free sites. The site being
  // published right now is excluded (it's still draft or being toggled live).
  const tplIsFree = (site.templates as unknown as { is_free?: boolean })?.is_free ?? false
  if (!tplIsFree) {
    const { data: profile } = await admin.from('users').select('plan').eq('id', user.id).single()
    const plan = profile?.plan ?? 'starter'
    const PLAN_LIMITS: Record<string, number> = { starter: 1, pro: 3, unlimited: Infinity }
    const limit = PLAN_LIMITS[plan] ?? 1

    const { data: otherPublished } = await admin
      .from('user_sites')
      .select('id, templates!inner(is_free)')
      .eq('user_id', user.id)
      .eq('status', 'published')
      .neq('id', id)

    const otherPaidCount = (otherPublished ?? []).filter((s: { templates: { is_free: boolean } | { is_free: boolean }[] | null }) => {
      const t = Array.isArray(s.templates) ? s.templates[0] : s.templates
      return !t?.is_free
    }).length

    if (otherPaidCount >= limit) {
      return NextResponse.json({
        error: `Plan-Limit erreicht. Dein ${plan}-Plan erlaubt ${limit} ${limit === 1 ? 'aktive Premium-Webseite' : 'aktive Premium-Webseiten'}. Bitte upgrade oder nimm eine andere Seite offline.`,
      }, { status: 403 })
    }
  }

  // Update to published
  const { error } = await admin.from('user_sites')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Purge KV cache so the Worker picks up the new status immediately
  await purgeSiteCache(username, site.templates.domain)

  const url = `https://${username}.${site.templates.domain}`
  return NextResponse.json({ success: true, url })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Fetch site info before unpublishing so we can purge the correct cache keys
  const { data: site } = await admin.from('user_sites')
    .select('*, templates(domain), users!user_id(username)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!site) return NextResponse.json({ error: 'Nicht gefunden.' }, { status: 404 })

  const { error } = await admin.from('user_sites')
    .update({ status: 'draft' })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Purge KV cache immediately so the Worker stops serving the site
  const username = (site.users as unknown as { username: string })?.username
  const domain = (site.templates as unknown as { domain: string })?.domain
  if (username && domain) {
    await markSiteOffline(username, domain)
  }

  return NextResponse.json({ success: true })
}
