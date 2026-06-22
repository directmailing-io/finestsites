import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { userSites } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { createUserCustomHostname, deleteCustomHostname } from '@/lib/cloudflare/custom-hostnames'
import { deleteCustomDomainKV } from '@/lib/cloudflare/kv-api'

export const runtime = 'nodejs'

const FALLBACK_HOST = process.env.CLOUDFLARE_FALLBACK_HOST ?? 'custom.womenplus.io'

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
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const site = await db.query.userSites.findFirst({
    where: and(eq(userSites.id, id), eq(userSites.userId, user.id)),
  })

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    custom_domain: site.customDomain ?? null,
    custom_domain_status: site.customDomainStatus ?? null,
    custom_domain_verified_at: site.customDomainVerifiedAt ?? null,
    fallback_host: FALLBACK_HOST,
    is_apex: site.customDomain ? isApexDomain(site.customDomain) : false,
  })
}

// POST /api/sites/[id]/domain { domain: "www.example.com" } — add domain
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
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

  // Make sure this site belongs to the user
  const site = await db.query.userSites.findFirst({
    where: and(eq(userSites.id, id), eq(userSites.userId, user.id)),
    with: { template: true },
  })

  if (!site) return NextResponse.json({ error: 'Website nicht gefunden.' }, { status: 404 })
  if (site.customDomain) {
    return NextResponse.json(
      { error: 'Diese Website hat bereits eine eigene Domain. Entferne sie zuerst.' },
      { status: 400 },
    )
  }

  // Check uniqueness across all sites
  const existing = await db.query.userSites.findFirst({
    where: eq(userSites.customDomain, hostname),
  })

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
  await db.update(userSites)
    .set({
      customDomain: hostname,
      customDomainStatus: 'pending_dns',
      cfCustomHostnameId: cfHostname.id,
      customDomainVerifiedAt: null,
    })
    .where(eq(userSites.id, id))

  return NextResponse.json({
    custom_domain: hostname,
    custom_domain_status: 'pending_dns',
    fallback_host: FALLBACK_HOST,
    is_apex: isApexDomain(hostname),
  })
}

// DELETE /api/sites/[id]/domain — remove domain
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const site = await db.query.userSites.findFirst({
    where: and(eq(userSites.id, id), eq(userSites.userId, user.id)),
  })

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!site.customDomain) return NextResponse.json({ success: true })

  // Delete from Cloudflare
  if (site.cfCustomHostnameId) {
    try {
      await deleteCustomHostname(site.cfCustomHostnameId)
    } catch (err) {
      console.error('[domain] CF deleteCustomHostname error:', err)
    }
  }

  // Delete from KV
  try {
    await deleteCustomDomainKV(site.customDomain)
  } catch (err) {
    console.error('[domain] KV delete error:', err)
  }

  // Clear DB
  await db.update(userSites)
    .set({
      customDomain: null,
      customDomainStatus: null,
      cfCustomHostnameId: null,
      customDomainVerifiedAt: null,
    })
    .where(eq(userSites.id, id))

  return NextResponse.json({ success: true })
}
