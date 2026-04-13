/**
 * KV cache utilities — calls the Worker's /.finestsites/kv admin endpoint.
 * The Worker has native KV binding access, so no Cloudflare API token is needed.
 *
 * The Worker authenticates the call using the SUPABASE_SERVICE_KEY (same JWT
 * that both sides already have).
 */

async function callWorkerKv(username: string, domain: string, action: 'purge' | 'offline'): Promise<void> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.warn('[kv] SUPABASE_SERVICE_ROLE_KEY not set — skipping KV invalidation')
    return
  }

  const url = `https://${username}.${domain}/.finestsites/kv`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) {
      console.error(`[kv] Worker KV ${action} failed: ${res.status} ${await res.text()}`)
    }
  } catch (err) {
    console.error(`[kv] Worker KV ${action} error:`, err)
  }
}

/**
 * Called when a site is PUBLISHED.
 * Deletes stale cached meta + rendered HTML so the Worker re-fetches fresh data.
 */
export async function purgeSiteCache(username: string, domain: string): Promise<void> {
  await callWorkerKv(username, domain, 'purge')
}

/**
 * Called when a site is UNPUBLISHED / taken offline.
 * Writes the '__offline__' sentinel to KV so the Worker immediately serves
 * the offline page on the very next request.
 */
export async function markSiteOffline(username: string, domain: string): Promise<void> {
  await callWorkerKv(username, domain, 'offline')
}
