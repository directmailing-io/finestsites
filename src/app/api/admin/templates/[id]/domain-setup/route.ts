import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { setupDomainRouting, findZone, deleteWorkerRoute } from '@/lib/cloudflare/worker-routes'

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
  const { data: tpl } = await admin
    .from('templates')
    .select('domain, cf_hostname_id, cf_hostname_status, cf_hostname_data')
    .eq('id', id)
    .single()

  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!tpl.domain) return NextResponse.json({ status: 'no_domain' })

  // If already set up, verify zone still exists
  if (tpl.cf_hostname_status === 'active' && tpl.cf_hostname_data) {
    const zone = await findZone(tpl.domain).catch(() => null)
    if (!zone) {
      return NextResponse.json({ status: 'zone_missing', domain: tpl.domain })
    }
    return NextResponse.json({ status: 'active', domain: tpl.domain, ...(tpl.cf_hostname_data as object) })
  }

  // Check if zone exists in Cloudflare
  const zone = await findZone(tpl.domain).catch(() => null)
  if (!zone) {
    return NextResponse.json({ status: 'zone_missing', domain: tpl.domain })
  }

  return NextResponse.json({
    status: tpl.cf_hostname_status ?? 'none',
    domain: tpl.domain,
    zone_name: zone.name,
    zone_status: zone.status,
  })
}

// POST — set up Worker Route + CNAME automatically
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { data: tpl } = await admin.from('templates').select('domain, cf_hostname_status').eq('id', id).single()

  if (!tpl?.domain) return NextResponse.json({ error: 'Domain fehlt.' }, { status: 400 })
  if (tpl.cf_hostname_status === 'active') {
    return NextResponse.json({ status: 'active', domain: tpl.domain })
  }

  try {
    const result = await setupDomainRouting(tpl.domain)
    const payload = {
      status: 'active',
      domain: tpl.domain,
      zone_id: result.zone.id,
      route_id: result.routeId,
    }
    await admin.from('templates').update({
      cf_hostname_id: result.routeId,
      cf_hostname_status: 'active',
      cf_hostname_data: payload,
    }).eq('id', id)

    return NextResponse.json(payload)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// DELETE — remove Worker Route
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await checkAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()
  const { data: tpl } = await admin
    .from('templates')
    .select('cf_hostname_id, cf_hostname_data')
    .eq('id', id)
    .single()

  if (tpl?.cf_hostname_id && tpl?.cf_hostname_data) {
    const d = tpl.cf_hostname_data as { zone_id?: string }
    if (d.zone_id) {
      await deleteWorkerRoute(d.zone_id, tpl.cf_hostname_id).catch(() => {})
    }
    await admin.from('templates').update({
      cf_hostname_id: null,
      cf_hostname_status: null,
      cf_hostname_data: null,
    }).eq('id', id)
  }

  return NextResponse.json({ success: true })
}
