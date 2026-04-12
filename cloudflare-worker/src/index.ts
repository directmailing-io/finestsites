/**
 * FinestSites Cloudflare Worker
 * Serves user websites by username subdomain
 * Flow: extract username → query Supabase → fetch HTML from R2 → replace placeholders → serve
 */

export interface Env {
  R2_BUCKET: R2Bucket
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  KV_CACHE: KVNamespace
}

function replacePlaceholders(html: string, data: Record<string, string>): string {
  return html.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const val = data[key.trim()]
    return val !== undefined && val !== null ? val : match
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const hostname = url.hostname
    const parts = hostname.split('.')

    // Need at least: username.domain.tld → 3 parts minimum
    if (parts.length < 3) {
      return new Response('Not found', { status: 404 })
    }

    const username = parts[0]
    const domain = parts.slice(1).join('.')

    if (!username || !domain) {
      return new Response('Not found', { status: 404 })
    }

    try {
      // Check KV cache first (5-minute cache)
      const cacheKey = `rendered:${username}:${domain}`
      const cached = await env.KV_CACHE.get(cacheKey)
      if (cached) {
        return new Response(cached, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            'X-Cache': 'HIT',
          },
        })
      }

      // Query Supabase for user site data
      // Join: users → user_sites → templates + site_data
      const siteRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/user_sites?select=id,status,templates(id,r2_bundle_path,domain),users(username),site_data(field_key,field_value)&users.username=eq.${encodeURIComponent(username)}&templates.domain=eq.${encodeURIComponent(domain)}&status=eq.published&limit=1`,
        {
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
        }
      )

      if (!siteRes.ok) {
        return new Response('Fehler beim Laden der Website', { status: 500 })
      }

      const sites = await siteRes.json() as any[]

      // Filter in-memory since PostgREST nested filters need specific syntax
      const site = sites.find((s: any) =>
        s.users?.username === username && s.templates?.domain === domain
      )

      if (!site || !site.templates?.r2_bundle_path) {
        return new Response(notFoundPage(username, domain), {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }

      // Fetch HTML template from R2
      const r2Object = await env.R2_BUCKET.get(site.templates.r2_bundle_path)
      if (!r2Object) {
        return new Response('Template-Datei nicht gefunden', { status: 500 })
      }

      const templateHtml = await r2Object.text()

      // Build data map from site_data rows
      const dataMap: Record<string, string> = {}
      if (Array.isArray(site.site_data)) {
        for (const row of site.site_data) {
          if (row.field_key && row.field_value !== null) {
            dataMap[row.field_key] = row.field_value
          }
        }
      }

      // Replace placeholders
      const renderedHtml = replacePlaceholders(templateHtml, dataMap)

      // Cache for 5 minutes
      await env.KV_CACHE.put(cacheKey, renderedHtml, { expirationTtl: 300 })

      return new Response(renderedHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'X-Powered-By': 'FinestSites',
          'X-Cache': 'MISS',
        },
      })
    } catch (error) {
      console.error('Worker error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  },
}

function notFoundPage(username: string, domain: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seite nicht gefunden</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; color: #111; }
    .box { text-align: center; max-width: 400px; padding: 2rem; }
    h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; }
    p { color: #6b7280; font-size: 0.9rem; }
    a { color: #1a1a1a; font-weight: 500; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Seite nicht gefunden</h1>
    <p>Die Seite <strong>${username}.${domain}</strong> existiert noch nicht oder ist nicht veröffentlicht.</p>
    <p style="margin-top:1.5rem"><a href="https://finestsites.vercel.app">Eigene Website erstellen →</a></p>
  </div>
</body>
</html>`
}
