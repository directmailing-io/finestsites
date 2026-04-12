/**
 * FinestSites Cloudflare Worker
 *
 * Routing:
 *   /              → render index.html with placeholder replacement
 *   /assets/...    → serve static files from R2 (CSS, JS, images, fonts)
 *   anything else  → try R2 as static asset, fallback to index.html
 *
 * Template Syntax supported:
 *   {{key}}                      → simple replacement
 *   {{#if key=value}} ... {{/if}} → conditional block
 *   {{#unless key}}  ... {{/unless}} → inverse conditional
 */

export interface Env {
  R2_BUCKET: R2Bucket
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  KV_CACHE: KVNamespace
}

// ─── Content-Type Map ─────────────────────────────────────────────────────────

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
  mp4: 'video/mp4',
  webm: 'video/webm',
  xml: 'application/xml',
  txt: 'text/plain',
}

function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

// ─── Template Engine ──────────────────────────────────────────────────────────

type SiteData = Record<string, string>

function renderTemplate(html: string, data: SiteData): string {
  html = processConditionals(html, data)
  html = replacePlaceholders(html, data)
  return html
}

function processConditionals(html: string, data: SiteData): string {
  for (let pass = 0; pass < 20; pass++) {
    const next = html
      .replace(/\{\{#if\s+([\w]+)=([\w-]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (_, key, value, content) =>
          (data[key] ?? '').trim() === value.trim() ? content : ''
      )
      .replace(/\{\{#if\s+([\w]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (_, key, content) => {
          const v = (data[key] ?? '').trim()
          return (v !== '' && v !== 'false' && v !== '0') ? content : ''
        }
      )
      .replace(/\{\{#unless\s+([\w]+)=([\w-]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
        (_, key, value, content) =>
          (data[key] ?? '').trim() !== value.trim() ? content : ''
      )
      .replace(/\{\{#unless\s+([\w]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
        (_, key, content) => {
          const v = (data[key] ?? '').trim()
          return (v === '' || v === 'false' || v === '0') ? content : ''
        }
      )
    if (next === html) break
    html = next
  }
  return html
}

function replacePlaceholders(html: string, data: SiteData): string {
  return html.replace(/\{\{([^#/{}][^{}]*)\}\}/g, (match, key) => {
    const val = data[key.trim()]
    return val !== undefined ? val : ''
  })
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const hostname = url.hostname
    const parts = hostname.split('.')

    if (parts.length < 3) {
      return new Response('Not found', { status: 404 })
    }

    const username = parts[0]
    const domain = parts.slice(1).join('.')
    const pathname = url.pathname

    try {
      // ── Step 1: Get site config from Supabase (with KV cache) ──
      const metaCacheKey = `meta:${username}:${domain}`
      let siteMeta: { templateId: string; r2BasePath: string; siteId: string } | null = null

      const cachedMeta = await env.KV_CACHE.get(metaCacheKey)
      if (cachedMeta) {
        siteMeta = JSON.parse(cachedMeta)
      } else {
        const siteRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/user_sites?select=id,status,templates(id,r2_bundle_path,domain),users(username)&status=eq.published&limit=20`,
          {
            headers: {
              'apikey': env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            },
          }
        )

        if (!siteRes.ok) return new Response('Service error', { status: 502 })

        const sites = await siteRes.json() as any[]
        const site = sites.find((s: any) =>
          s.users?.username === username && s.templates?.domain === domain
        )

        if (!site || !site.templates?.r2_bundle_path) {
          return new Response(notFoundPage(username, domain), {
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        }

        // r2_bundle_path is e.g. "templates/{id}/index.html"
        const r2BasePath = site.templates.r2_bundle_path.replace('/index.html', '')

        siteMeta = { templateId: site.templates.id, r2BasePath, siteId: site.id }
        await env.KV_CACHE.put(metaCacheKey, JSON.stringify(siteMeta), { expirationTtl: 300 })
      }

      // ── Step 2: Serve static asset or index.html ──

      // Determine which R2 key to fetch
      const assetPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '')
      const r2Key = `${siteMeta.r2BasePath}/${assetPath}`
      const isHtml = assetPath.endsWith('.html') || assetPath === 'index.html'

      // For non-HTML assets: serve directly from R2 with long-term cache
      if (!isHtml && assetPath !== '') {
        const asset = await env.R2_BUCKET.get(r2Key)
        if (asset) {
          const body = await asset.arrayBuffer()
          return new Response(body, {
            headers: {
              'Content-Type': getContentType(assetPath),
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          })
        }
        // Asset not found — return 404 (don't fall back to index for non-HTML)
        return new Response('Asset not found', { status: 404 })
      }

      // ── Step 3: Render index.html ──

      // Check rendered HTML cache
      const renderCacheKey = `rendered:${username}:${domain}`
      const cachedHtml = await env.KV_CACHE.get(renderCacheKey)
      if (cachedHtml) {
        return new Response(cachedHtml, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Cache': 'HIT' },
        })
      }

      // Fetch template HTML from R2
      const r2Object = await env.R2_BUCKET.get(`${siteMeta.r2BasePath}/index.html`)
      if (!r2Object) {
        return new Response('Template-Datei nicht gefunden', { status: 500 })
      }
      const templateHtml = await r2Object.text()

      // Fetch site_data
      const dataRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/site_data?user_site_id=eq.${siteMeta.siteId}&select=field_key,field_value`,
        {
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
        }
      )

      const dataRows = dataRes.ok ? (await dataRes.json() as { field_key: string; field_value: string }[]) : []
      const dataMap: SiteData = {}
      for (const row of dataRows) {
        if (row.field_key) dataMap[row.field_key] = row.field_value ?? ''
      }

      // Render
      const renderedHtml = renderTemplate(templateHtml, dataMap)

      // Cache rendered HTML for 5 minutes
      await env.KV_CACHE.put(renderCacheKey, renderedHtml, { expirationTtl: 300 })

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
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seite nicht gefunden</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;}
.box{text-align:center;max-width:400px;padding:2rem;}h1{font-size:1.5rem;font-weight:600;color:#111;margin-bottom:.5rem;}
p{color:#6b7280;font-size:.9rem;line-height:1.6;}a{color:#1a1a1a;font-weight:600;}</style></head>
<body><div class="box">
<h1>Seite nicht gefunden</h1>
<p><strong>${username}.${domain}</strong> existiert noch nicht oder ist nicht veröffentlicht.</p>
<p style="margin-top:1.5rem"><a href="https://finestsites.vercel.app">Eigene Website erstellen →</a></p>
</div></body></html>`
}
