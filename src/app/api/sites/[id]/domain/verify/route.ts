import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCustomHostname } from '@/lib/cloudflare/custom-hostnames'
import { setCustomDomainKV } from '@/lib/cloudflare/kv-api'

export const runtime = 'nodejs'

// POST /api/sites/[id]/domain/verify — re-check verification status with Cloudflare
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: site } = await admin
    .from('user_sites')
    .select('custom_domain, custom_domain_status, cf_custom_hostname_id, templates(domain), users!user_id(username)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!site.custom_domain || !site.cf_custom_hostname_id) {
    return NextResponse.json({ error: 'Keine Domain konfiguriert.' }, { status: 400 })
  }

  // Already active — nothing to do
  if (site.custom_domain_status === 'active') {
    return NextResponse.json({ custom_domain_status: 'active', custom_domain: site.custom_domain })
  }

  // Fetch current status from Cloudflare
  let cfData
  try {
    cfData = await getCustomHostname(site.cf_custom_hostname_id)
  } catch (err) {
    console.error('[domain/verify] CF error:', err)
    return NextResponse.json({ error: 'Cloudflare-Abfrage fehlgeschlagen.' }, { status: 500 })
  }

  const isActive = cfData.status === 'active' && cfData.ssl?.status === 'active'

  if (isActive) {
    const username = (site.users as unknown as { username: string })?.username
    const templateDomain = (site.templates as unknown as { domain: string })?.domain

    // Write KV entry so the Worker knows this hostname → username + templateDomain
    if (username && templateDomain) {
      try {
        await setCustomDomainKV(site.custom_domain, username, templateDomain)
      } catch (err) {
        console.error('[domain/verify] KV write error:', err)
      }
    }

    // Mark as active in DB
    await admin
      .from('user_sites')
      .update({
        custom_domain_status: 'active',
        custom_domain_verified_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({ custom_domain_status: 'active', custom_domain: site.custom_domain })
  }

  // Map CF statuses to our status
  // CNAME error present → pending_dns (DNS not set up)
  // No CNAME error, any SSL pending state → pending_ssl (DNS ok, SSL being issued)
  // hostname active + ssl active → active (handled above)
  let newStatus = 'pending_dns'
  const hasCnameError = cfData.verification_errors?.some((e: string) => e.includes('CNAME'))
  if (cfData.status === 'blocked' || cfData.status === 'error' || cfData.ssl?.status === 'error') {
    newStatus = 'error'
  } else if (!hasCnameError) {
    // CNAME is set — SSL is being processed
    newStatus = 'pending_ssl'
  }

  if (newStatus !== site.custom_domain_status) {
    await admin.from('user_sites').update({ custom_domain_status: newStatus }).eq('id', id)
  }

  return NextResponse.json({ custom_domain_status: newStatus, custom_domain: site.custom_domain })
}
