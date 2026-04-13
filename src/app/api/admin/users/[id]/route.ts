import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ? user : null
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const [{ data: profile }, { data: sites }] = await Promise.all([
    admin.from('users').select('*').eq('id', id).single(),
    admin.from('user_sites').select('*, templates(title, domain)').eq('user_id', id).neq('status', 'deleted').order('created_at', { ascending: false })
  ])

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Stripe invoices if customer exists
  let invoices: Stripe.Invoice[] = []
  if (profile.stripe_customer_id) {
    try {
      const result = await stripe.invoices.list({ customer: profile.stripe_customer_id, limit: 10 })
      invoices = result.data
    } catch { /* ignore */ }
  }

  return NextResponse.json({ profile, sites, invoices })
}
