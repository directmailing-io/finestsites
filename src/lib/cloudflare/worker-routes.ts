/**
 * Cloudflare Worker Routes API
 *
 * For domains already in the same Cloudflare account as the Worker:
 * - Finds the zone by domain name
 * - Creates a Worker Route: *.domain/* → finestsites-worker
 * - Creates a wildcard CNAME placeholder if missing
 *
 * Required env vars:
 *   CLOUDFLARE_API_TOKEN   — needs Zone:Edit + Worker Routes:Edit permissions
 *   CLOUDFLARE_ACCOUNT_ID  — already set
 */

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN!
const WORKER_SCRIPT = 'finestsites-worker'

function headers() {
  return {
    Authorization: `Bearer ${CF_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export interface ZoneInfo {
  id: string
  name: string
  status: string
}

export interface RouteSetupResult {
  zone: ZoneInfo
  routeId: string
  cname: string
  alreadyExisted: boolean
}

/** Find a Cloudflare zone by domain name in this account */
export async function findZone(domain: string): Promise<ZoneInfo | null> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}`,
    { headers: headers() }
  )
  const data = await res.json() as { success: boolean; result: ZoneInfo[] }
  if (!data.success || data.result.length === 0) return null
  return data.result[0]
}

/** Create Worker Route *.domain/* → finestsites-worker */
export async function createWorkerRoute(zoneId: string, domain: string): Promise<string> {
  // Check if route already exists
  const listRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
    { headers: headers() }
  )
  const listData = await listRes.json() as { success: boolean; result: Array<{ id: string; pattern: string }> }
  const pattern = `*.${domain}/*`
  const existing = listData.result?.find(r => r.pattern === pattern)
  if (existing) return existing.id

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ pattern, script: WORKER_SCRIPT }),
    }
  )
  const data = await res.json() as { success: boolean; result: { id: string }; errors: { message: string }[] }
  if (!data.success) throw new Error(data.errors?.[0]?.message ?? 'Failed to create Worker Route')
  return data.result.id
}

/** Ensure wildcard CNAME exists (placeholder — actual routing via Worker Route) */
export async function ensureWildcardCname(zoneId: string, domain: string): Promise<void> {
  // Check if wildcard CNAME already exists
  const listRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=CNAME&name=*.${domain}`,
    { headers: headers() }
  )
  const listData = await listRes.json() as { result: unknown[] }
  if (listData.result?.length > 0) return // already exists

  // Create proxied wildcard CNAME
  await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      type: 'CNAME',
      name: `*.${domain}`,
      content: `${WORKER_SCRIPT}.finestsites.workers.dev`,
      proxied: true,
      ttl: 1,
    }),
  })
}

/** Full domain setup: find zone → create route → ensure CNAME */
export async function setupDomainRouting(domain: string): Promise<RouteSetupResult> {
  const zone = await findZone(domain)
  if (!zone) {
    throw new Error(
      `Die Domain "${domain}" wurde nicht in deinem Cloudflare-Account gefunden. ` +
      `Füge sie zuerst unter dash.cloudflare.com hinzu.`
    )
  }

  const routeId = await createWorkerRoute(zone.id, domain)
  await ensureWildcardCname(zone.id, domain)

  return {
    zone,
    routeId,
    cname: `*.${domain}`,
    alreadyExisted: false,
  }
}

/** Delete Worker Route when domain is removed */
export async function deleteWorkerRoute(zoneId: string, routeId: string): Promise<void> {
  await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes/${routeId}`,
    { method: 'DELETE', headers: headers() }
  )
}
