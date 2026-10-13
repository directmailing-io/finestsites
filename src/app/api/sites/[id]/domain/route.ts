import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { userSites } from '@/lib/db/schema'
import { siteWhereForUser } from '@/lib/sites/site-access'
import { eq, and } from 'drizzle-orm'
import { createUserCustomHostname, deleteCustomHostname } from '@/lib/cloudflare/custom-hostnames'
import { deleteCustomDomainKV } from '@/lib/cloudflare/kv-api'

export const runtime = 'nodejs'

// Ziel, das Kunden bei ihrem Domain-Anbieter als CNAME eintragen. domains.finestsites.io ist
// ein reiner DNS-Verweis (nicht proxied) auf custom.womenplus.io, die technische Adresse von
// Cloudflare for SaaS. custom.womenplus.io muss dauerhaft bestehen bleiben: ältere
// Kunden-Domains zeigen direkt darauf.
const FALLBACK_HOST = process.env.CLOUDFLARE_FALLBACK_HOST ?? 'domains.finestsites.io'

// Eingabe wie „https://www.meine-domain.de/“ auf den reinen Hostnamen kürzen.
function normalizeDomainInput(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0].replace(/\.$/, '')
}

function isValidHostname(hostname: string): boolean {
  const clean = hostname.trim().toLowerCase()
  if (!clean.includes('.')) return false
  if (clean.startsWith('.') || clean.endsWith('.')) return false
  if (!/^[a-z0-9._-]+$/.test(clean)) return false
  if (clean.length > 253) return false
  const labels = clean.split('.')
  if (labels.some(l => !l || l.startsWith('-') || l.endsWith('-'))) return false
  // Endung (.de, .com, .info …) ist Pflicht. „www.siegfriedhartmann“ wurde sonst als nackte
  // Domain gelesen und zu „www.www.siegfriedhartmann“ (13.10.2026).
  const tld = labels[labels.length - 1]
  if (!/^([a-z]{2,24}|xn--[a-z0-9-]{2,59})$/.test(tld)) return false
  if (labels[0] === 'www' && labels.length < 3) return false
  if (labels[0] === 'www' && labels[1] === 'www') return false
  // Eigene Infrastruktur und Template-Domains dürfen nie als Kunden-Domain registriert werden
  const BLOCKED = ['finestsites.io', 'finestsites.de', 'womenplus.io', 'lnko.me', 'wellpreneur.io', 'cellrestart.net', 'dailyoptimal.de', 'myevnt.io', 'vitalprofil.net', 'workers.dev', 'cloudflare.com', 'hetzner.com', 'localhost']
  if (BLOCKED.some(b => clean === b || clean.endsWith('.' + b))) return false
  return true
}

// Gibt es die Domain überhaupt? NXDOMAIN = Tippfehler oder noch nicht registriert.
// Fail-open: bei Netzwerkfehlern oder anderen DNS-Antworten wird nicht blockiert.
// Geprüft wird die registrierte Domain (shop.meine-domain.de → meine-domain.de), weil eine
// Subdomain vor dem CNAME-Eintrag noch nicht existiert. Kurze Second-Level-Endungen wie
// co.uk / com.au / or.at zählen mit.
async function domainDoesNotExist(hostname: string): Promise<boolean> {
  const labels = hostname.split('.')
  const keep = labels.length >= 3 && labels[labels.length - 2].length <= 3 ? 3 : 2
  const name = labels.slice(-keep).join('.')
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=NS`, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return false
    const data = await res.json() as { Status?: number }
    return data.Status === 3
  } catch {
    return false
  }
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
    where: await siteWhereForUser(id, user.id),
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
  const { domain: rawDomain } = await req.json() as { domain: string }
  const domain = normalizeDomainInput(rawDomain ?? '')

  if (!domain || !isValidHostname(domain)) {
    return NextResponse.json(
      { error: 'Ungültige Domain. Bitte gib deine vollständige Domain mit Endung ein, z. B. www.meine-domain.de oder meine-domain.de.' },
      { status: 400 },
    )
  }

  // Nackte Domains (meine-domain.de) werden als www.meine-domain.de verbunden: Cloudflare
  // validiert genau den Hostnamen, der per CNAME auf uns zeigt, und einen CNAME auf der
  // nackten Domain erlauben die meisten Anbieter (Strato, IONOS, all-inkl …) nicht.
  // Der Nutzer leitet die nackte Domain beim Anbieter auf www weiter (Anleitung im Editor).
  // Vorher wurde der Apex bei Cloudflare angelegt, der Nutzer aber auf www geschickt → nie
  // verifiziert (pulvermani.de, 10.10.2026).
  const hostname = isApexDomain(domain) ? `www.${domain}` : domain

  if (await domainDoesNotExist(hostname)) {
    return NextResponse.json(
      { error: `Die Domain „${domain}“ gibt es nicht. Bitte prüfe die Schreibweise oder registriere sie zuerst bei deinem Domain-Anbieter.` },
      { status: 400 },
    )
  }

  // Make sure this site belongs to the user
  const site = await db.query.userSites.findFirst({
    where: await siteWhereForUser(id, user.id),
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
    where: await siteWhereForUser(id, user.id),
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
