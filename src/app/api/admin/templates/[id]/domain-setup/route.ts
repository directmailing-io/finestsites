import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  createCustomHostname,
  getCustomHostname,
  deleteCustomHostname,
  isConfigured,
} from '@/lib/cloudflare/custom-hostnames'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return data?.is_admin ? user : null
}

// GET — fetch current domain setup status
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { data: tpl } = await admin.from('templates').select('domain, cf_hostname_id, cf_hostname_status, cf_hostname_data').eq('id', id).single()
  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!tpl.cf_hostname_id) {
    return NextResponse.json({ status: 'none', configured: isConfigured() })
  }

  // Refresh status from Cloudflare
  try {
    const cf = await getCustomHostname(tpl.cf_hostname_id)
    const payload = {
      status: cf.status,
      ssl_status: cf.ssl.status,
      ownership_verification: cf.ownership_verification,
      ssl_records: cf.ssl.validation_records ?? [],
      fallback_host: process.env.CLOUDFLARE_FALLBACK_HOST,
      configured: isConfigured(),
    }
    // Update cached status
    await admin.from('templates').update({
      cf_hostname_status: cf.status,
      cf_hostname_data: payload,
    }).eq('id', id)
    return NextResponse.json(payload)
  } catch (err) {
    return NextResponse.json({ status: 'error', message: String(err), configured: isConfigured() })
  }
}

// POST — create Custom Hostname (called when admin clicks "Domain einrichten")
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isConfigured()) {
    return NextResponse.json({
      error: 'CLOUDFLARE_ZONE_ID und CLOUDFLARE_FALLBACK_HOST sind noch nicht konfiguriert.',
    }, { status: 503 })
  }

  const { id } = await params
  const admin = createAdminClient()
  const { data: tpl } = await admin.from('templates').select('domain, cf_hostname_id').eq('id', id).single()
  if (!tpl?.domain) return NextResponse.json({ error: 'Domain fehlt.' }, { status: 400 })

  // If already registered, just return current status
  if (tpl.cf_hostname_id) {
    const cf = await getCustomHostname(tpl.cf_hostname_id)
    return NextResponse.json({
      status: cf.status,
      ssl_status: cf.ssl.status,
      ownership_verification: cf.ownership_verification,
      ssl_records: cf.ssl.validation_records ?? [],
      fallback_host: process.env.CLOUDFLARE_FALLBACK_HOST,
    })
  }

  // Create wildcard custom hostname
  const cf = await createCustomHostname(`*.${tpl.domain}`)

  const payload = {
    status: cf.status,
    ssl_status: cf.ssl.status,
    ownership_verification: cf.ownership_verification,
    ssl_records: cf.ssl.validation_records ?? [],
    fallback_host: process.env.CLOUDFLARE_FALLBACK_HOST,
  }

  await admin.from('templates').update({
    cf_hostname_id: cf.id,
    cf_hostname_status: cf.status,
    cf_hostname_data: payload,
  }).eq('id', id)

  return NextResponse.json(payload)
}

// DELETE — remove Custom Hostname (when template is deleted or domain changed)
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { data: tpl } = await admin.from('templates').select('cf_hostname_id').eq('id', id).single()

  if (tpl?.cf_hostname_id) {
    await deleteCustomHostname(tpl.cf_hostname_id)
    await admin.from('templates').update({
      cf_hostname_id: null,
      cf_hostname_status: null,
      cf_hostname_data: null,
    }).eq('id', id)
  }

  return NextResponse.json({ success: true })
}
