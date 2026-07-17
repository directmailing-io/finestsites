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
import { db } from '@/lib/db'
import { userSites, users as usersTable, templates as templatesTable } from '@/lib/db/schema'
import { inArray, eq } from 'drizzle-orm'
import { getCustomHostname } from '@/lib/cloudflare/custom-hostnames'
import { setCustomDomainKV } from '@/lib/cloudflare/kv-api'
import { sendEmail } from '@/lib/resend'
import { domainActiveEmail } from '@/lib/email/templates'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Vercel cron jobs send the CRON_SECRET in the Authorization header
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch up to 50 pending domains per run to stay within execution time limits
  let sites: {
    id: string
    customDomain: string | null
    customDomainStatus: string | null
    cfCustomHostnameId: string | null
    userId: string
  }[]
  try {
    sites = await db
      .select({
        id: userSites.id,
        customDomain: userSites.customDomain,
        customDomainStatus: userSites.customDomainStatus,
        cfCustomHostnameId: userSites.cfCustomHostnameId,
        userId: userSites.userId,
      })
      .from(userSites)
      .where(
        inArray(userSites.customDomainStatus, ['pending_dns', 'pending_ssl'])
      )
      .limit(50)
    // Filter in JS since Drizzle doesn't have isNotNull for multiple cols easily
    sites = sites.filter(s => s.cfCustomHostnameId !== null && s.customDomain !== null)
  } catch (err) {
    console.error('[cron/check-domains] DB error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (sites.length === 0) {
    return NextResponse.json({ checked: 0, activated: 0 })
  }

  // We need template domain and user email/username for notifications — fetch separately
  const siteDetails = await db
    .select({
      id: userSites.id,
      templateDomain: templatesTable.domain,
      userUsername: usersTable.username,
      userEmail: usersTable.email,
    })
    .from(userSites)
    .leftJoin(usersTable, eq(usersTable.id, userSites.userId))
    .leftJoin(templatesTable, eq(templatesTable.id, userSites.templateId))
    .where(inArray(userSites.id, sites.map(s => s.id)))

  const detailMap = new Map(siteDetails.map(d => [d.id, d]))

  let activated = 0
  let errors = 0

  for (const site of sites) {
    try {
      const cfData = await getCustomHostname(site.cfCustomHostnameId!)
      const isActive = cfData.status === 'active' && cfData.ssl?.status === 'active'
      const detail = detailMap.get(site.id)

      if (isActive) {
        const username = detail?.userUsername ?? null
        const templateDomain = detail?.templateDomain ?? null
        const userEmail = detail?.userEmail ?? null

        // Write KV so the Worker can route requests for this custom domain
        if (username && templateDomain) {
          await setCustomDomainKV(site.customDomain!, username, templateDomain)
        }

        await db.update(userSites)
          .set({
            customDomainStatus: 'active',
            customDomainVerifiedAt: new Date(),
          })
          .where(eq(userSites.id, site.id))

        // Notify user — fire and forget, never block the loop
        if (userEmail && site.customDomain) {
          sendEmail({ to: userEmail, subject: `Deine Domain ${site.customDomain} ist jetzt live!`, html: domainActiveEmail({ domain: site.customDomain }), type: 'domain_active' })
            .catch(err => console.error('[cron/check-domains] Email send error:', err))
        }

        activated++
        console.log(`[cron/check-domains] Activated: ${site.customDomain}`)
      } else {
        // Progress the status forward if CNAME was set but SSL is still pending
        const hasCnameError = cfData.verification_errors?.some((e: string) => e.includes('CNAME'))
        let newStatus = 'pending_dns'
        if (cfData.status === 'blocked' || cfData.status === 'error' || cfData.ssl?.status === 'error') {
          newStatus = 'error'
        } else if (!hasCnameError) {
          newStatus = 'pending_ssl'
        }

        if (newStatus !== site.customDomainStatus) {
          await db.update(userSites)
            .set({ customDomainStatus: newStatus })
            .where(eq(userSites.id, site.id))
          console.log(`[cron/check-domains] Status update: ${site.customDomain} → ${newStatus}`)
        }
      }
    } catch (err) {
      errors++
      console.error(`[cron/check-domains] Error processing ${site.customDomain}:`, err)
    }
  }

  return NextResponse.json({
    checked: sites.length,
    activated,
    errors,
  })
}
