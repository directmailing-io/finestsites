/**
 * Cloudflare Worker Routes API
 * Adds/removes zone-level worker routes for custom hostnames.
 *
 * Required env vars:
 *   CLOUDFLARE_API_TOKEN  — Zone:Workers Routes:Edit + Zone:DNS:Edit permissions
 *   CLOUDFLARE_ZONE_ID    — zone ID of the SaaS zone (e.g. womenplus.io)
 */

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN!
const WORKER_SCRIPT = process.env.CLOUDFLARE_WORKER_SCRIPT ?? 'finestsites-worker'

function headers() {
  return { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' }
}

interface CfZone {
  id: string
  name: string
  status: string
}

// ─── Zone lookup ──────────────────────────────────────────────────────────────

export async function findZone(domain: string): Promise<CfZone | null> {
  // Walk up the domain tree (e.g. sub.vitaldarm.de → vitaldarm.de → de)
  const parts = domain.split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.')
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(candidate)}&status=active`,
      { headers: headers() },
    )
    const data = await res.json() as { success: boolean; result: CfZone[] }
    if (data.success && data.result?.length > 0) return data.result[0]
  }
  return null
}

// ─── Worker route helpers ─────────────────────────────────────────────────────

/**
 * Idempotent: returns the route ID whether it already existed or was just created.
 */
async function ensureWorkerRoute(zoneId: string, pattern: string): Promise<string> {
  const base = `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`

  // Check if route already exists to avoid duplicate errors
  const listRes = await fetch(base, { headers: headers() })
  const listData = await listRes.json() as { result: { id: string; pattern: string }[] }
  const existing = listData.result?.find(r => r.pattern === pattern)
  if (existing) return existing.id

  const res = await fetch(base, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ pattern, script: WORKER_SCRIPT }),
  })
  const data = await res.json() as { success: boolean; result?: { id: string }; errors?: { message: string }[] }
  if (!data.success) throw new Error(data.errors?.[0]?.message ?? 'Worker-Route konnte nicht erstellt werden.')
  return data.result!.id
}

/**
 * Adds a worker route for a specific hostname (used for custom user domains).
 * Pattern: hostname/* — matches e.g. www.custom-domain.de/*
 */
export async function addWorkerRoute(hostname: string): Promise<string | null> {
  try {
    const zone = await findZone(hostname)
    if (!zone) {
      console.error('[worker-routes] No zone found for', hostname)
      return null
    }
    return await ensureWorkerRoute(zone.id, `${hostname}/*`)
  } catch (err) {
    console.error('[worker-routes] addWorkerRoute error:', err)
    return null
  }
}

export async function deleteWorkerRoute(zoneId: string, routeId: string): Promise<void> {
  const base = `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`
  await fetch(`${base}/${routeId}`, { method: 'DELETE', headers: headers() })
}

// ─── DNS helpers ──────────────────────────────────────────────────────────────

/**
 * Creates a proxied wildcard A record (* → 192.0.2.1) in the zone so that
 * username.template-domain.de resolves through Cloudflare's proxy network.
 * The Worker Route fires before any origin connection, so the IP is irrelevant.
 * Idempotent: skips creation if a wildcard record already exists.
 */
async function ensureWildcardDns(zoneId: string): Promise<void> {
  const listRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100`,
    { headers: headers() },
  )
  const listData = await listRes.json() as { result: { name: string; type: string }[] }
  const hasWildcard = listData.result?.some(
    r => r.name.startsWith('*') && (r.type === 'A' || r.type === 'CNAME'),
  )
  if (hasWildcard) return

  const createRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        type: 'A',
        name: '*',
        content: '192.0.2.1', // Documentation IP — CF proxy intercepts before origin
        proxied: true,
        ttl: 1,
        comment: 'FinestSites wildcard — CF Worker handles all subdomain traffic',
      }),
    },
  )
  const createData = await createRes.json() as { success: boolean; errors?: { message: string }[] }
  if (!createData.success) {
    // Log but don't throw — admin can fix DNS manually if needed
    console.warn('[worker-routes] Wildcard DNS create failed:', createData.errors)
  }
}

// ─── Full template domain setup ───────────────────────────────────────────────

/**
 * Sets up a new template domain end-to-end:
 *   1. Finds the CF zone (domain must already be in the account with CF nameservers)
 *   2. Creates wildcard DNS *.domain → proxied (idempotent)
 *   3. Creates Worker Route *.domain/* → finestsites-worker (idempotent)
 *
 * Returns the zone and the wildcard route ID for storage in the DB.
 */
export async function setupDomainRouting(
  domain: string,
): Promise<{ zone: CfZone; routeId: string }> {
  const zone = await findZone(domain)
  if (!zone) throw new Error(`Keine Cloudflare-Zone für ${domain} gefunden. Stelle sicher, dass die Nameserver auf Cloudflare zeigen.`)

  // 1. Wildcard DNS — run in parallel with route creation
  const [routeId] = await Promise.all([
    ensureWorkerRoute(zone.id, `*.${domain}/*`),
    ensureWildcardDns(zone.id),
  ])

  return { zone, routeId }
}
