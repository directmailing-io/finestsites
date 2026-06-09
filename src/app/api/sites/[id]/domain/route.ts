import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createUserCustomHostname, deleteCustomHostname } from '@/lib/cloudflare/custom-hostnames'
import { deleteCustomDomainKV } from '@/lib/cloudflare/kv-api'

export const runtime = 'nodejs'

const FALLBACK_HOST = process.env.CLOUDFLARE_FALLBACK_HOST ?? 'custom.womenplus.io'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function isValidHostname(hostname: string): boolean {
  const clean = hostname.trim().toLowerCase()
  if (!clean.includes('.')) return false
  if (clean.startsWith('.') || clean.endsWith('.')) return false
  if (!/^[a-z0-9._-]+$/.test(clean)) return false
  if (clean.length > 253) return false
  return true
}

function isApexDomain(hostname: string): boolean {
  return hostname.split('.').length === 2
}

// GET /api/sites/[id]/domain — get current domain status
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: site } = await admin
    .from('user_sites')
    .select('custom_domain, custom_domain_status, cf_custom_hostname_id, custom_domain_verified_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    custom_domain: site.custom_domain ?? null,
    custom_domain_status: site.custom_domain_status ?? null,
    custom_domain_verified_at: site.custom_domain_verified_at ?? null,
    fallback_host: FALLBACK_HOST,
    is_apex: site.custom_domain ? isApexDomain(site.custom_domain) : false,
  })
}

// POST /api/sites/[id]/domain { domain: "www.example.com" } — add domain
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { domain } = await req.json() as { domain: string }

  if (!domain || !isValidHostname(domain)) {
    return NextResponse.json(
      { error: 'Ungültige Domain. Bitte gib z.B. www.meine-domain.de oder meine-domain.de ein.' },
      { status: 400 },
    )
  }

  const hostname = domain.trim().toLowerCase()
  const admin = createAdminClient()

  // Make sure this site belongs to the user
  const { data: site } = await admin
    .from('user_sites')
    .select('id, custom_domain, templates(domain), users!user_id(username)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!site) return NextResponse.json({ error: 'Website nicht gefunden.' }, { status: 404 })
  if (site.custom_domain) {
    return NextResponse.json(
      { error: 'Diese Website hat bereits eine eigene Domain. Entferne sie zuerst.' },
      { status: 400 },
    )
  }

  // Check uniqueness across all sites
  const { data: existing } = await admin
    .from('user_sites')
    .select('id')
    .eq('custom_domain', hostname)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Diese Domain ist bereits mit einer anderen Website verbunden.' },
      { status: 409 },
    )
  }

  if (!process.env.CLOUDFLARE_ZONE_ID) {
    return NextResponse.json(
      { error: 'Custom-Domain-Feature ist noch nicht konfiguriert. Bitte wende dich an den Support.' },
      { status: 503 },
    )
  }

  // Create the Cloudflare Custom Hostname
  let cfHostname
  try {
    cfHostname = await createUserCustomHostname(hostname)
  } catch (err) {
    console.error('[domain] CF createUserCustomHostname error:', err)
    return NextResponse.json(
      { error: 'Verbindung mit Cloudflare fehlgeschlagen. Bitte versuche es erneut.' },
      { status: 500 },
    )
  }

  // Save to DB
  const { error: dbErr } = await admin
    .from('user_sites')
    .update({
      custom_domain: hostname,
      custom_domain_status: 'pending_dns',
      cf_custom_hostname_id: cfHostname.id,
      custom_domain_verified_at: null,
    })
    .eq('id', id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({
    custom_domain: hostname,
    custom_domain_status: 'pending_dns',
    fallback_host: FALLBACK_HOST,
    is_apex: isApexDomain(hostname),
  })
}

// DELETE /api/sites/[id]/domain — remove domain
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: site } = await admin
    .from('user_sites')
    .select('custom_domain, cf_custom_hostname_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!site.custom_domain) return NextResponse.json({ success: true })

  // Delete from Cloudflare
  if (site.cf_custom_hostname_id) {
    try {
      await deleteCustomHostname(site.cf_custom_hostname_id)
    } catch (err) {
      console.error('[domain] CF deleteCustomHostname error:', err)
    }
  }

  // Delete from KV
  try {
    await deleteCustomDomainKV(site.custom_domain)
  } catch (err) {
    console.error('[domain] KV delete error:', err)
  }

  // Clear DB
  await admin
    .from('user_sites')
    .update({
      custom_domain: null,
      custom_domain_status: null,
      cf_custom_hostname_id: null,
      custom_domain_verified_at: null,
    })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
