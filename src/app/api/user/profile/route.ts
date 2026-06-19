import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  // Plan quota model: ONLY PUBLISHED sites with non-free templates count toward
  // the plan limit. Drafts are free — users can experiment without hitting limits.
  const [{ data: profile }, { data: activeSites }] = await Promise.all([
    admin.from('users').select('plan, billing_interval, subscription_status, stripe_customer_id, username, referred_by_username, first_name, last_name, phone, website_url, instagram, facebook, linkedin, tiktok, youtube, profile_image_url').eq('id', user.id).single(),
    admin.from('user_sites').select('id, status, templates!inner(is_free)').eq('user_id', user.id).in('status', ['draft', 'published']),
  ])

  const allSites = activeSites ?? []
  const sites_count = allSites.length
  // Paid count = published with non-free template (drafts excluded)
  const paid_sites_count = allSites.filter((s: { status: string; templates: { is_free: boolean } | { is_free: boolean }[] | null }) => {
    if (s.status !== 'published') return false
    const t = Array.isArray(s.templates) ? s.templates[0] : s.templates
    return !t?.is_free
  }).length

  return NextResponse.json({
    plan: profile?.plan ?? 'starter',
    billing_interval: profile?.billing_interval ?? 'monthly',
    subscription_status: profile?.subscription_status ?? null,
    stripe_customer_id: profile?.stripe_customer_id ?? null,
    sites_count,
    paid_sites_count,
    username: profile?.username ?? null,
    referred_by_username: profile?.referred_by_username ?? null,
    // Personal profile fields
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
    phone: profile?.phone ?? null,
    website_url: profile?.website_url ?? null,
    instagram: profile?.instagram ?? null,
    facebook: profile?.facebook ?? null,
    linkedin: profile?.linkedin ?? null,
    tiktok: profile?.tiktok ?? null,
    youtube: profile?.youtube ?? null,
    profile_image_url: profile?.profile_image_url ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['first_name', 'last_name', 'phone', 'website_url', 'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'profile_image_url']
  const updates: Record<string, string | null> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] ?? null
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Keine Felder zum Aktualisieren.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('users').update(updates).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

