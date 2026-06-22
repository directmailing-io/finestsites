import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { userSites, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getCustomHostname } from '@/lib/cloudflare/custom-hostnames'
import { setCustomDomainKV } from '@/lib/cloudflare/kv-api'

export const runtime = 'nodejs'

// POST /api/sites/[id]/domain/verify — re-check verification status with Cloudflare
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const site = await db.query.userSites.findFirst({
    where: and(eq(userSites.id, id), eq(userSites.userId, user.id)),
    with: { template: true },
  })

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!site.customDomain || !site.cfCustomHostnameId) {
    return NextResponse.json({ error: 'Keine Domain konfiguriert.' }, { status: 400 })
  }

  // Already active — nothing to do
  if (site.customDomainStatus === 'active') {
    return NextResponse.json({ custom_domain_status: 'active', custom_domain: site.customDomain })
  }

  // Fetch current status from Cloudflare
  let cfData
  try {
    cfData = await getCustomHostname(site.cfCustomHostnameId)
  } catch (err) {
    console.error('[domain/verify] CF error:', err)
    return NextResponse.json({ error: 'Cloudflare-Abfrage fehlgeschlagen.' }, { status: 500 })
  }

  const isActive = cfData.status === 'active' && cfData.ssl?.status === 'active'

  if (isActive) {
    const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
    const username = userRow?.username
    const templateDomain = site.template?.domain

    // Write KV entry so the Worker knows this hostname → username + templateDomain
    if (username && templateDomain) {
      try {
        await setCustomDomainKV(site.customDomain, username, templateDomain)
      } catch (err) {
        console.error('[domain/verify] KV write error:', err)
      }
    }

    // Mark as active in DB
    await db.update(userSites)
      .set({
        customDomainStatus: 'active',
        customDomainVerifiedAt: new Date(),
      })
      .where(eq(userSites.id, id))

    return NextResponse.json({ custom_domain_status: 'active', custom_domain: site.customDomain })
  }

  // Map CF statuses to our status
  let newStatus = 'pending_dns'
  const hasCnameError = cfData.verification_errors?.some((e: string) => e.includes('CNAME'))
  if (cfData.status === 'blocked' || cfData.status === 'error' || cfData.ssl?.status === 'error') {
    newStatus = 'error'
  } else if (!hasCnameError) {
    // CNAME is set — SSL is being processed
    newStatus = 'pending_ssl'
  }

  if (newStatus !== site.customDomainStatus) {
    await db.update(userSites)
      .set({ customDomainStatus: newStatus })
      .where(eq(userSites.id, id))
  }

  return NextResponse.json({ custom_domain_status: newStatus, custom_domain: site.customDomain })
}
