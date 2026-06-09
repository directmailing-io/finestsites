import { NextResponse } from 'next/server'
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
    admin.from('users').select('plan, billing_interval, subscription_status, stripe_customer_id, username, referred_by_username').eq('id', user.id).single(),
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
  })
}

