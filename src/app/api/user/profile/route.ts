import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: profile }, { count }] = await Promise.all([
    admin.from('users').select('plan, billing_interval, subscription_status, stripe_customer_id').eq('id', user.id).single(),
    admin.from('user_sites').select('*', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['draft', 'published']),
  ])

  return NextResponse.json({
    plan: profile?.plan ?? 'starter',
    billing_interval: profile?.billing_interval ?? 'monthly',
    subscription_status: profile?.subscription_status ?? null,
    stripe_customer_id: profile?.stripe_customer_id ?? null,
    sites_count: count ?? 0,
  })
}
