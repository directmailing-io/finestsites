/**
 * GET /api/admin/dns-check?host=www.example.de
 * Admin-Support für eigene Domains: Was steht aktuell im DNS des Kunden (CNAME/A/AAAA),
 * und passt es zu unserer Vorgabe? Abfrage per DNS-over-HTTPS bei Cloudflare (1.1.1.1),
 * also unabhängig vom Resolver des Servers. Nur lesend, nur für Admins, Hostname streng geprüft.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users, userSites } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getCustomHostname } from '@/lib/cloudflare/custom-hostnames'

export const runtime = 'nodejs'

// Ziel, das Kunden eintragen sollen (siehe api/sites/[id]/domain); ältere Domains zeigen direkt auf custom.womenplus.io
const FALLBACK_HOST = process.env.CLOUDFLARE_FALLBACK_HOST ?? 'domains.finestsites.io'
const ACCEPTED_TARGETS = [FALLBACK_HOST, 'custom.womenplus.io']

type DohAnswer = { name: string; type: number; TTL: number; data: string }
async function doh(name: string, type: 'CNAME' | 'A' | 'AAAA'): Promise<DohAnswer[]> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: 'application/dns-json' },
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) return []
  const json = await res.json() as { Answer?: DohAnswer[] }
  return json.Answer ?? []
}

export async function GET(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { isAdmin: true } })
  if (!profile?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const host = (req.nextUrl.searchParams.get('host') ?? '').trim().toLowerCase()
  if (!/^(?=.{4,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    return NextResponse.json({ error: 'Ungültiger Hostname' }, { status: 400 })
  }

  const labels = host.split('.')
  const isApex = labels.length === 2
  const www = isApex ? `www.${host}` : null

  // Für Apex-Domains ist www der empfohlene Weg (Option A), daher beide Namen prüfen
  const names = www ? [host, www] : [host]
  const results = await Promise.all(names.map(async name => {
    const [cname, a, aaaa] = await Promise.all([doh(name, 'CNAME'), doh(name, 'A'), doh(name, 'AAAA')])
    const cnameTargets = cname.filter(r => r.type === 5).map(r => r.data.replace(/\.$/, '').toLowerCase())
    const matchesTarget = cnameTargets.some(t => ACCEPTED_TARGETS.includes(t))
    return {
      name,
      cname: cnameTargets,
      a: a.filter(r => r.type === 1).map(r => r.data),
      aaaa: aaaa.filter(r => r.type === 28).map(r => r.data),
      ok: matchesTarget,
    }
  }))

  // Sicht von Cloudflare for SaaS: Hostname-/SSL-Status, Fehlertext und die TXT-Alternative
  // (`_cf-custom-hostname`), falls der Kunde den CNAME nicht vorab setzen kann/will.
  let cloudflare: { status: string; ssl_status: string; errors: string[]; txt: { name: string; value: string } | null } | null = null
  const site = await db.query.userSites.findFirst({ where: eq(userSites.customDomain, host), columns: { cfCustomHostnameId: true } })
  if (site?.cfCustomHostnameId) {
    try {
      const cf = await getCustomHostname(site.cfCustomHostnameId)
      cloudflare = {
        status: cf.status,
        ssl_status: cf.ssl?.status ?? 'unknown',
        errors: cf.verification_errors ?? [],
        txt: cf.status !== 'active' && cf.ownership_verification?.type === 'txt'
          ? { name: cf.ownership_verification.name, value: cf.ownership_verification.value }
          : null,
      }
    } catch { cloudflare = null }
  }

  return NextResponse.json({
    host,
    is_apex: isApex,
    fallback_host: FALLBACK_HOST,
    checked_at: new Date().toISOString(),
    records: results,
    cloudflare,
  })
}
