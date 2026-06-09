/**
 * Cron: Auto-verify pending custom domains
 *
 * Runs every 5 minutes (configured in vercel.json).
 * Checks all domains in 'pending_dns' or 'pending_ssl' status against
 * the Cloudflare API. When a domain becomes active:
 *   - writes the KV entry so the Worker can serve the site
 *   - updates the DB status
 *   - sends a notification email to the user
 *
 * Protected by CRON_SECRET (Vercel automatically sends this in the
 * Authorization header for cron invocations).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCustomHostname } from '@/lib/cloudflare/custom-hostnames'
import { setCustomDomainKV } from '@/lib/cloudflare/kv-api'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { domainActiveEmail } from '@/lib/email/templates'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Vercel cron jobs send the CRON_SECRET in the Authorization header
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Fetch up to 50 pending domains per run to stay within execution time limits
  const { data: sites, error } = await admin
    .from('user_sites')
    .select('id, custom_domain, custom_domain_status, cf_custom_hostname_id, templates(domain), users!user_id(username, email)')
    .in('custom_domain_status', ['pending_dns', 'pending_ssl'])
    .not('cf_custom_hostname_id', 'is', null)
    .not('custom_domain', 'is', null)
    .limit(50)

  if (error) {
    console.error('[cron/check-domains] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!sites || sites.length === 0) {
    return NextResponse.json({ checked: 0, activated: 0 })
  }

  let activated = 0
  let errors = 0

  for (const site of sites) {
    try {
      const cfData = await getCustomHostname(site.cf_custom_hostname_id!)
      const isActive = cfData.status === 'active' && cfData.ssl?.status === 'active'

      if (isActive) {
        const username = (site.users as unknown as { username: string })?.username
        const templateDomain = (site.templates as unknown as { domain: string })?.domain
        const userEmail = (site.users as unknown as { email: string })?.email

        // Write KV so the Worker can route requests for this custom domain
        if (username && templateDomain) {
          await setCustomDomainKV(site.custom_domain!, username, templateDomain)
        }

        await admin
          .from('user_sites')
          .update({
            custom_domain_status: 'active',
            custom_domain_verified_at: new Date().toISOString(),
          })
          .eq('id', site.id)

        // Notify user — fire and forget, never block the loop
        if (userEmail && site.custom_domain) {
          getResend()
            .emails.send({
              from: FROM_EMAIL,
              to: userEmail,
              subject: `Deine Domain ${site.custom_domain} ist jetzt live!`,
              html: domainActiveEmail({ domain: site.custom_domain }),
            })
            .catch(err => console.error('[cron/check-domains] Email send error:', err))
        }

        activated++
        console.log(`[cron/check-domains] Activated: ${site.custom_domain}`)
      } else {
        // Progress the status forward if CNAME was set but SSL is still pending
        const hasCnameError = cfData.verification_errors?.some((e: string) => e.includes('CNAME'))
        let newStatus = 'pending_dns'
        if (cfData.status === 'blocked' || cfData.status === 'error' || cfData.ssl?.status === 'error') {
          newStatus = 'error'
        } else if (!hasCnameError) {
          newStatus = 'pending_ssl'
        }

        if (newStatus !== site.custom_domain_status) {
          await admin.from('user_sites').update({ custom_domain_status: newStatus }).eq('id', site.id)
          console.log(`[cron/check-domains] Status update: ${site.custom_domain} → ${newStatus}`)
        }
      }
    } catch (err) {
      errors++
      console.error(`[cron/check-domains] Error processing ${site.custom_domain}:`, err)
    }
  }

  return NextResponse.json({
    checked: sites.length,
    activated,
    errors,
  })
}
