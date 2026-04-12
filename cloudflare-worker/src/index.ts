/**
 * FinestSites Cloudflare Worker
 *
 * Routes:
 *   GET  /                          → render index.html with placeholder replacement
 *   GET  /path/to/asset.css         → serve static asset from R2
 *   POST /.finestsites/forms/{name} → save form submission to Supabase → redirect/JSON
 *   GET  /.finestsites/health       → health check
 */

export interface Env {
  R2_BUCKET: R2Bucket
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  KV_CACHE: KVNamespace
}

// ─── Content-Type Map ─────────────────────────────────────────────────────────

const CT: Record<string, string> = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8', js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8', json: 'application/json',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject', mp4: 'video/mp4', webm: 'video/webm',
  xml: 'application/xml', txt: 'text/plain', pdf: 'application/pdf',
}

function ct(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return CT[ext] ?? 'application/octet-stream'
}

// ─── Template Engine ──────────────────────────────────────────────────────────

type Data = Record<string, string>

function render(html: string, data: Data): string {
  html = conditionals(html, data)
  html = html.replace(/\{\{([^#/{}][^{}]*)\}\}/g, (_, k) => data[k.trim()] ?? '')
  return html
}

function conditionals(html: string, data: Data): string {
  for (let i = 0; i < 20; i++) {
    const next = html
      .replace(/\{\{#if\s+([\w]+)=([\w-]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, k, v, c) =>
        (data[k] ?? '').trim() === v.trim() ? c : '')
      .replace(/\{\{#if\s+([\w]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, k, c) => {
        const v = (data[k] ?? '').trim()
        return v && v !== 'false' && v !== '0' ? c : ''
      })
      .replace(/\{\{#unless\s+([\w]+)=([\w-]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (_, k, v, c) =>
        (data[k] ?? '').trim() !== v.trim() ? c : '')
      .replace(/\{\{#unless\s+([\w]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (_, k, c) => {
        const v = (data[k] ?? '').trim()
        return !v || v === 'false' || v === '0' ? c : ''
      })
    if (next === html) break
    html = next
  }
  return html
}

// ─── Site Metadata Lookup ─────────────────────────────────────────────────────

interface SiteMeta {
  siteId: string
  templateId: string
  r2BasePath: string
}

async function getSiteMeta(username: string, domain: string, env: Env): Promise<SiteMeta | null> {
  const cacheKey = `meta:${username}:${domain}`
  const cached = await env.KV_CACHE.get(cacheKey)
  if (cached) return JSON.parse(cached) as SiteMeta

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/user_sites?select=id,templates(id,r2_bundle_path,domain),users(username)&status=eq.published&limit=200`,
    { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
  )
  if (!res.ok) return null

  const sites = await res.json() as any[]
  const site = sites.find((s: any) => s.users?.username === username && s.templates?.domain === domain)
  if (!site?.templates?.r2_bundle_path) return null

  const meta: SiteMeta = {
    siteId: site.id,
    templateId: site.templates.id,
    r2BasePath: site.templates.r2_bundle_path.replace('/index.html', ''),
  }
  await env.KV_CACHE.put(cacheKey, JSON.stringify(meta), { expirationTtl: 300 })
  return meta
}

// ─── Form Submission Handler ──────────────────────────────────────────────────

async function handleFormSubmission(request: Request, pathname: string, meta: SiteMeta, env: Env): Promise<Response> {
  const formName = pathname.split('/').filter(Boolean).pop() ?? 'default'

  let formData: Record<string, string> = {}
  let redirectUrl: string | null = null

  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const fd = await request.formData()
    for (const [key, value] of fd.entries()) {
      if (key === '_redirect') { redirectUrl = value.toString(); continue }
      if (key.startsWith('_')) continue // skip system fields
      formData[key] = value.toString()
    }
  } else if (contentType.includes('application/json')) {
    const body = await request.json() as Record<string, string>
    redirectUrl = body._redirect ?? null
    for (const [k, v] of Object.entries(body)) {
      if (!k.startsWith('_')) formData[k] = v
    }
  }

  if (Object.keys(formData).length === 0) {
    return new Response(JSON.stringify({ error: 'Keine Daten empfangen.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Rate limit check via KV (5 submissions per IP per 10min)
  const ip = request.headers.get('cf-connecting-ip') ?? ''
  const rateLimitKey = `rate:${meta.siteId}:${ip}`
  const rateCount = parseInt(await env.KV_CACHE.get(rateLimitKey) ?? '0')
  if (rateCount >= 5) {
    return new Response(JSON.stringify({ error: 'Zu viele Anfragen. Bitte warte 10 Minuten.' }), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    })
  }
  await env.KV_CACHE.put(rateLimitKey, String(rateCount + 1), { expirationTtl: 600 })

  // Save to Supabase
  const saveRes = await fetch(`${env.SUPABASE_URL}/rest/v1/form_submissions`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_site_id: meta.siteId,
      form_name: formName,
      data: formData,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') ?? null,
    }),
  })

  if (!saveRes.ok) {
    return new Response(JSON.stringify({ error: 'Speichern fehlgeschlagen.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Check if JSON was requested
  const acceptsJson = request.headers.get('accept')?.includes('application/json')
  if (acceptsJson) {
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  if (redirectUrl) {
    return Response.redirect(redirectUrl, 302)
  }

  return new Response(successPage(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    const url = new URL(request.url)
    const hostname = url.hostname
    const parts = hostname.split('.')

    // Minimum: username.domain.tld (3 parts)
    if (parts.length < 3) {
      return new Response('Not found', { status: 404 })
    }

    const username = parts[0]
    const domain = parts.slice(1).join('.')
    const pathname = url.pathname

    // Health check
    if (pathname === '/.finestsites/health') {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      const meta = await getSiteMeta(username, domain, env)

      if (!meta) {
        return new Response(notFoundPage(username, domain), {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }

      // ── Form submission ──────────────────────────────────────────────────
      if (request.method === 'POST' && pathname.startsWith('/.finestsites/forms/')) {
        return handleFormSubmission(request, pathname, meta, env)
      }

      // ── Static assets ────────────────────────────────────────────────────
      const assetPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '')
      const isHtml = assetPath === 'index.html' || assetPath.endsWith('.html')

      if (!isHtml && assetPath) {
        const r2Key = `${meta.r2BasePath}/${assetPath}`
        const asset = await env.R2_BUCKET.get(r2Key)
        if (asset) {
          const body = await asset.arrayBuffer()
          return new Response(body, {
            headers: {
              'Content-Type': ct(assetPath),
              'Cache-Control': 'public, max-age=31536000, immutable',
              'Access-Control-Allow-Origin': '*',
            },
          })
        }
        return new Response('Asset not found', { status: 404 })
      }

      // ── Render HTML ──────────────────────────────────────────────────────
      const renderCacheKey = `rendered:${username}:${domain}`
      const cachedHtml = await env.KV_CACHE.get(renderCacheKey)
      if (cachedHtml) {
        return new Response(cachedHtml, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60', 'X-Cache': 'HIT' },
        })
      }

      const r2Object = await env.R2_BUCKET.get(`${meta.r2BasePath}/index.html`)
      if (!r2Object) return new Response('Template nicht gefunden', { status: 500 })
      const templateHtml = await r2Object.text()

      const dataRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/site_data?user_site_id=eq.${meta.siteId}&select=field_key,field_value`,
        { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
      )
      const rows = dataRes.ok ? await dataRes.json() as { field_key: string; field_value: string }[] : []
      const dataMap: Data = {}
      for (const r of rows) dataMap[r.field_key] = r.field_value ?? ''

      const renderedHtml = render(templateHtml, dataMap)
      await env.KV_CACHE.put(renderCacheKey, renderedHtml, { expirationTtl: 60 })

      return new Response(renderedHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
          'X-Powered-By': 'FinestSites',
        },
      })

    } catch (err) {
      console.error('Worker error:', err)
      return new Response('Internal Server Error', { status: 500 })
    }
  },
}

// ─── HTML Templates ───────────────────────────────────────────────────────────

function successPage(): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Danke!</title><style>
body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;}
.box{text-align:center;max-width:400px;padding:2.5rem;}
.icon{width:64px;height:64px;background:#F0FDF4;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;}
h1{font-size:1.5rem;font-weight:700;color:#111;margin-bottom:.5rem;}
p{color:#6b7280;line-height:1.6;}
a{display:inline-block;margin-top:1.5rem;padding:.6rem 1.5rem;background:#1a1a1a;color:white;border-radius:12px;text-decoration:none;font-weight:600;font-size:.9rem;}
</style></head><body><div class="box">
<div class="icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg></div>
<h1>Vielen Dank!</h1><p>Deine Nachricht wurde erfolgreich übermittelt.</p>
<a href="javascript:history.back()">← Zurück</a>
</div></body></html>`
}

function notFoundPage(username: string, domain: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nicht gefunden</title><style>
body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;}
.box{text-align:center;max-width:400px;padding:2rem;}
h1{font-size:1.5rem;font-weight:600;color:#111;margin-bottom:.5rem;}
p{color:#6b7280;font-size:.9rem;line-height:1.6;}a{color:#1a1a1a;font-weight:600;}
</style></head><body><div class="box">
<h1>Seite nicht gefunden</h1>
<p><strong>${username}.${domain}</strong> existiert noch nicht oder ist nicht veröffentlicht.</p>
<p style="margin-top:1.5rem"><a href="https://finestsites.vercel.app">Eigene Website erstellen →</a></p>
</div></body></html>`
}
