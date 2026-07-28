/**
 * Cloudflare for SaaS — Custom Hostnames API
 *
 * Allows us to issue free SSL certificates for any domain (kennsta.de, vitaldarm.de, etc.)
 * without requiring those domains to be registered at Cloudflare.
 *
 * Required env vars:
 *   CLOUDFLARE_API_TOKEN       — API token with "SSL and Certificates" + "Zone" permissions
 *   CLOUDFLARE_ZONE_ID         — Zone ID of your platform domain in Cloudflare (e.g. finestsites.de)
 *   CLOUDFLARE_FALLBACK_HOST   — Fallback hostname (e.g. custom.finestsites.de), must be CF-proxied
 */

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN!
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID!

function cfBase() {
  return `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames`
}

function headers() {
  return {
    Authorization: `Bearer ${CF_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export interface CfSslRecord {
  type: string
  name: string
  value: string
}

export interface CfCustomHostname {
  id: string
  hostname: string
  status: 'pending' | 'active' | 'moved' | 'deleted' | 'blocked' | 'error'
  ssl: {
    status: 'initializing' | 'pending_validation' | 'pending_issuance' | 'pending_deployment' | 'active' | 'error' | 'deleted'
    validation_records?: CfSslRecord[]
    wildcard: boolean
  }
  verification_errors?: string[]
  ownership_verification: {
    type: string
    name: string
    value: string
  }
}

export async function createCustomHostname(wildcardHostname: string): Promise<CfCustomHostname> {
  const res = await fetch(cfBase(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      hostname: wildcardHostname,
      ssl: {
        method: 'txt',
        type: 'dv',
        wildcard: true,
        settings: { min_tls_version: '1.2' },
      },
    }),
  })
  const data = await res.json() as { success: boolean; result: CfCustomHostname; errors: { message: string }[] }
  if (!data.success) throw new Error(data.errors?.[0]?.message ?? 'Cloudflare API error')
  return data.result
}

export async function getCustomHostname(cfId: string): Promise<CfCustomHostname> {
  const res = await fetch(`${cfBase()}/${cfId}`, { headers: headers() })
  const data = await res.json() as { success: boolean; result: CfCustomHostname; errors: { message: string }[] }
  if (!data.success) throw new Error(data.errors?.[0]?.message ?? 'Cloudflare API error')
  return data.result
}

export async function deleteCustomHostname(cfId: string): Promise<void> {
  await fetch(`${cfBase()}/${cfId}`, { method: 'DELETE', headers: headers() })
}

export function isConfigured(): boolean {
  return !!(process.env.CLOUDFLARE_ZONE_ID && process.env.CLOUDFLARE_FALLBACK_HOST)
}

/**
 * Look up an existing Custom Hostname by the hostname string (search by filter).
 */
export async function findCustomHostnameByName(hostname: string): Promise<CfCustomHostname | null> {
  const res = await fetch(`${cfBase()}?hostname=${encodeURIComponent(hostname)}`, { headers: headers() })
  const data = await res.json() as { success: boolean; result: CfCustomHostname[]; errors: { message: string }[] }
  if (!data.success) return null
  return data.result?.[0] ?? null
}

/**
 * Create a Custom Hostname for a user-provided domain (e.g. www.example.com).
 * Uses HTTP validation — once the user sets the CNAME, Cloudflare validates
 * and issues the SSL certificate automatically (no TXT record needed).
 *
 * If CF already has this hostname registered (e.g. from a previous failed attempt),
 * we look it up and return it rather than failing with a "Duplicate" error.
 */
export async function createUserCustomHostname(hostname: string): Promise<CfCustomHostname> {
  const res = await fetch(cfBase(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      hostname,
      ssl: {
        method: 'http',
        type: 'dv',
        wildcard: false,
        settings: { min_tls_version: '1.2' },
      },
    }),
  })
  const data = await res.json() as { success: boolean; result: CfCustomHostname; errors: { message: string; code?: number }[] }
  if (!data.success) {
    const msg = data.errors?.[0]?.message ?? ''
    // CF error 45 = "Duplicate custom hostname found" — hostname already exists in this zone
    if (msg.toLowerCase().includes('duplicate')) {
      const existing = await findCustomHostnameByName(hostname)
      if (existing) return existing
    }
    throw new Error(msg || 'Cloudflare API error')
  }
  return data.result
}
