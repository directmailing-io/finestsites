/**
 * FinestSites Cloudflare Worker
 * Serves user websites dynamically for preview
 * Production sites are served as static files from R2
 */

export interface Env {
  R2_BUCKET: R2Bucket
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  KV_CACHE: KVNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const hostname = url.hostname

    // Extract username from subdomain: anna.vitaldarm.de → anna
    const subdomain = hostname.split('.')[0]
    const domain = hostname.split('.').slice(1).join('.')

    if (!subdomain || !domain) {
      return new Response('Not found', { status: 404 })
    }

    try {
      // Check KV cache first (fast path)
      const cacheKey = `site:${subdomain}:${domain}`
      const cached = await env.KV_CACHE.get(cacheKey)

      let siteHtml: string | null = null

      if (cached) {
        siteHtml = cached
      } else {
        // Fetch from Supabase
        const response = await fetch(
          `${env.SUPABASE_URL}/rest/v1/rpc/get_rendered_site`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({ p_username: subdomain, p_domain: domain }),
          }
        )

        if (!response.ok) {
          return new Response('Site not found', { status: 404 })
        }

        siteHtml = await response.text()

        // Cache for 5 minutes
        await env.KV_CACHE.put(cacheKey, siteHtml, { expirationTtl: 300 })
      }

      return new Response(siteHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'X-Powered-By': 'FinestSites',
        },
      })
    } catch (error) {
      return new Response('Internal Server Error', { status: 500 })
    }
  },
}
