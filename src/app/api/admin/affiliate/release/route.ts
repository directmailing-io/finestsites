/**
 * POST /api/admin/affiliate/release
 * Admin-only: immediately releases all pending commissions for a referrer,
 * bypassing the normal 14-day hold. Useful for testing or special cases.
 *
 * Body: { referrer_id: string } — or omit to release ALL pending globally.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const now = new Date().toISOString()

  let query = admin
    .from('affiliate_commissions')
    .update({ status: 'available', available_at: now, updated_at: now })
    .eq('status', 'pending')

  if (body.referrer_id) {
    query = query.eq('referrer_id', body.referrer_id)
  }

  const { data, error } = await query.select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ released: data?.length ?? 0 })
}
