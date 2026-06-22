/**
 * Direct Cloudflare KV writes via the CF API.
 * Used to manage custom domain → site mappings in the Worker's KV namespace.
 *
 * Required env vars:
 *   CLOUDFLARE_API_TOKEN        — API token with KV Storage:Edit permission
 *   CLOUDFLARE_ACCOUNT_ID       — CF account ID
 *   CLOUDFLARE_KV_NAMESPACE_ID  — KV namespace ID (from wrangler.toml)
 */

// KV operations need Workers KV Storage:Edit permission.
// Use CLOUDFLARE_KV_TOKEN if set, otherwise fall back to CLOUDFLARE_API_TOKEN.
const CF_TOKEN = (process.env.CLOUDFLARE_KV_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN)!
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!
const CF_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID!

function kvBase() {
  return `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}/values`
}

function headers() {
  return { Authorization: `Bearer ${CF_TOKEN}` }
}

/**
 * Write a custom domain → { username, templateDomain } mapping into KV.
 * The Worker reads this key to identify which site to serve for a custom hostname.
 * Key format: custom:{hostname}
 */
export async function setCustomDomainKV(
  hostname: string,
  username: string,
  templateDomain: string,
): Promise<void> {
  const key = `custom:${hostname}`
  const value = JSON.stringify({ username, templateDomain })
  await fetch(`${kvBase()}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'text/plain' },
    body: value,
  })
}

/**
 * Delete the custom domain mapping from KV.
 * Called when a user removes their custom domain.
 */
export async function deleteCustomDomainKV(hostname: string): Promise<void> {
  const key = `custom:${hostname}`
  await fetch(`${kvBase()}/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: headers(),
  })
}

/**
 * Write a pre-rendered HTML page directly into the Worker's KV cache so the
 * Worker serves it without invoking its own template-rendering pass. This
 * bypasses any version-skew between the Worker engine and the canonical
 * Vercel engine (e.g. nested {{#each}} support).
 *
 * Key format: rendered:{username}:{templateDomain}
 * TTL: 1 hour — enough for stable serving, short enough to self-heal if the
 * user re-publishes or edits the underlying data.
 */
/**
 * Mark a site as offline in KV. The Worker serves an offline/410 page
 * instead of the real site. Used when a user's account is deactivated
 * due to payment failure or subscription cancellation.
 * Key format: meta:{username}:{templateDomain}
 */
export async function setSiteOfflineKV(username: string, templateDomain: string): Promise<void> {
  const key = `meta:${username}:${templateDomain}`
  await fetch(`${kvBase()}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'text/plain' },
    body: '__offline__',
  })
}

/**
 * Remove the offline marker for a site (or any cached meta) so the Worker
 * falls back to a fresh Supabase lookup and serves the site again.
 * Called when a user's account is reactivated after a successful payment.
 */
export async function clearSiteMetaKV(username: string, templateDomain: string): Promise<void> {
  const key = `meta:${username}:${templateDomain}`
  await fetch(`${kvBase()}/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: headers(),
  })
}

export async function writeRenderedHtmlKV(
  username: string,
  templateDomain: string,
  html: string,
  ttlSeconds: number = 3600,
): Promise<void> {
  const key = `rendered:${username}:${templateDomain}`
  await fetch(`${kvBase()}/${encodeURIComponent(key)}?expiration_ttl=${ttlSeconds}`, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'text/plain' },
    body: html,
  })
}
