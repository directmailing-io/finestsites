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

// Returns null if not found/not published, or the string '__offline__' if explicitly offline
async function getSiteMeta(username: string, domain: string, env: Env): Promise<SiteMeta | '__offline__' | null> {
  const cacheKey = `meta:${username}:${domain}`
  const cached = await env.KV_CACHE.get(cacheKey)

  // Offline sentinel — site was explicitly taken offline
  if (cached === '__offline__') return '__offline__'

  if (cached) {
    try { return JSON.parse(cached) as SiteMeta } catch { /* stale/corrupt cache, fall through */ }
  }

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
  await env.KV_CACHE.put(cacheKey, JSON.stringify(meta))
  return meta
}

// ─── KV Admin Handler ─────────────────────────────────────────────────────────

async function handleKvAdmin(request: Request, username: string, domain: string, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization') ?? ''
  if (auth !== `Bearer ${env.SUPABASE_SERVICE_KEY}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await request.json() as { action?: string }
  const metaKey = `meta:${username}:${domain}`
  const renderedKey = `rendered:${username}:${domain}`

  if (body.action === 'purge') {
    await Promise.allSettled([
      env.KV_CACHE.delete(metaKey),
      env.KV_CACHE.delete(renderedKey),
    ])
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  if (body.action === 'offline') {
    await Promise.allSettled([
      env.KV_CACHE.put(metaKey, '__offline__'),
      env.KV_CACHE.delete(renderedKey),
    ])
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  return new Response('Bad Request', { status: 400 })
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

    // KV admin — called by Vercel on publish/unpublish (no Cloudflare API token needed)
    if (pathname === '/.finestsites/kv' && request.method === 'POST') {
      return handleKvAdmin(request, username, domain, env)
    }

    try {
      const meta = await getSiteMeta(username, domain, env)

      // Site explicitly taken offline
      if (meta === '__offline__') {
        return new Response(offlinePage(username, domain), {
          status: 410,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        })
      }

      // Site not found / never published
      if (!meta) {
        return new Response(notFoundPage(username, domain), {
          status: 404,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
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
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Cache': 'HIT' },
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
          'Cache-Control': 'no-cache',
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

const LOGO_BLACK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620.04 126"><defs><style>.cls-1{fill:#1a1a1a;}</style></defs><g><g><path class="cls-1" d="M82.71,34.42A9.75,9.75,0,0,1,73,24.7a9.5,9.5,0,0,1,2.85-6.91,9.56,9.56,0,0,1,11.77-1.54,10.79,10.79,0,0,1,3.63,3.54A9.13,9.13,0,0,1,92.6,24.7a9.29,9.29,0,0,1-2.9,6.86A9.57,9.57,0,0,1,82.71,34.42Z"/><rect class="cls-1" x="75.12" y="45.18" width="14.84" height="70.01"/><path class="cls-1" d="M137.84,43.13A32.81,32.81,0,0,1,151.27,46,25.08,25.08,0,0,1,162,55.2q4.22,6.25,4.22,16.33v43.66h-15V74.43q0-10.41-4.86-15.14a17.19,17.19,0,0,0-12.53-4.73,18.25,18.25,0,0,0-9.68,2.85,22.7,22.7,0,0,0-7.63,7.85,21.56,21.56,0,0,0-3,11.3v38.63H98.7v-70h14.83V57.63c.51-1.94,1.91-4,4.18-6.31a28.8,28.8,0,0,1,8.7-5.8A27.44,27.44,0,0,1,137.84,43.13Z"/><path class="cls-1" d="M238.89,59.59A29.91,29.91,0,0,0,227,47.44a35.87,35.87,0,0,0-17.94-4.31q-11.26,0-19.23,4.78a31.45,31.45,0,0,0-12.15,13,40.18,40.18,0,0,0-4.18,18.46A42,42,0,0,0,178,99a32.52,32.52,0,0,0,12.66,13.4q8.22,4.8,19.48,4.81a51.58,51.58,0,0,0,14.16-1.67,29.31,29.31,0,0,0,9.85-4.73,31.05,31.05,0,0,0,6.86-7.16l-7.25-9a23.13,23.13,0,0,1-4.18,4.81,25.1,25.1,0,0,1-7.46,4.61A28.43,28.43,0,0,1,211,106.06,25.23,25.23,0,0,1,198.13,103a20.07,20.07,0,0,1-7.89-8.28,25.9,25.9,0,0,1-2.73-11.52h55.34c.06-.45.11-1.25.18-2.42s.08-2,.08-2.43Q243.11,67.44,238.89,59.59ZM188,72a21.81,21.81,0,0,1,2.47-7.89,18.34,18.34,0,0,1,6.71-7c3-1.93,7.06-2.91,12.05-2.91,4.84,0,8.68,1,11.52,3A17.79,17.79,0,0,1,227,64.36,20,20,0,0,1,229,72Z"/><path class="cls-1" d="M276.91,43.13a44.51,44.51,0,0,1,10.19,1.11,46.45,46.45,0,0,1,8.19,2.64,23.35,23.35,0,0,1,4.9,2.73L294.31,59a24.36,24.36,0,0,0-6.14-3.45,24.68,24.68,0,0,0-9.89-1.92A20.48,20.48,0,0,0,268.13,56,7.4,7.4,0,0,0,264,62.74c0,3,1.44,5.3,4.31,7a40.47,40.47,0,0,0,11.55,4.3,59.08,59.08,0,0,1,10.87,3.67,21.42,21.42,0,0,1,8.23,6.35q3.15,4.05,3.16,10.79a20.09,20.09,0,0,1-2.56,10.45,19.6,19.6,0,0,1-6.91,6.9,32.52,32.52,0,0,1-9.72,3.8A50.51,50.51,0,0,1,272,117.23a47.64,47.64,0,0,1-11.69-1.32,41.43,41.43,0,0,1-8.74-3.15,29.86,29.86,0,0,1-5.16-3.2L252.27,99a28.16,28.16,0,0,0,7.29,4.52,26.68,26.68,0,0,0,11.55,2.39q7.17,0,11.6-3A9.15,9.15,0,0,0,287.14,95,8.15,8.15,0,0,0,285,89.09a15.43,15.43,0,0,0-5.71-3.58,65.15,65.15,0,0,0-7.85-2.39,55.26,55.26,0,0,1-8-2.47,29.65,29.65,0,0,1-7.08-4,18.1,18.1,0,0,1-5.07-6,17.52,17.52,0,0,1-1.88-8.32A15,15,0,0,1,253.29,52a24.68,24.68,0,0,1,10.06-6.61A38.91,38.91,0,0,1,276.91,43.13Z"/><path class="cls-1" d="M305.46,45.18h13.73V15.06H334V45.18h18v12.7H334V92.5q0,6.15,2.17,9a6.94,6.94,0,0,0,5.84,2.9,9.06,9.06,0,0,0,5-1.19c1.2-.8,3.64-2.31,3.87-2.6l5.52,11c-.34.28-2.62,1.68-4.1,2.47a26.45,26.45,0,0,1-5.71,2.13,31.64,31.64,0,0,1-8.19.94,19.6,19.6,0,0,1-13.69-5q-5.49-5-5.5-15.81V57.88H305.46Z"/><path class="cls-1" d="M391.62,43.13a44.58,44.58,0,0,1,10.19,1.11A46.6,46.6,0,0,1,410,46.88a23.22,23.22,0,0,1,4.91,2.73L409,59a24,24,0,0,0-6.14-3.45A24.61,24.61,0,0,0,393,53.62,20.44,20.44,0,0,0,382.84,56a7.4,7.4,0,0,0-4.18,6.78c0,3,1.43,5.3,4.3,7a40.55,40.55,0,0,0,11.56,4.3,59.34,59.34,0,0,1,10.87,3.67,21.49,21.49,0,0,1,8.23,6.35q3.15,4.05,3.15,10.79a20.18,20.18,0,0,1-2.55,10.45,19.6,19.6,0,0,1-6.91,6.9,32.52,32.52,0,0,1-9.72,3.8,50.53,50.53,0,0,1-10.92,1.19A47.56,47.56,0,0,1,375,115.91a41.22,41.22,0,0,1-8.74-3.15,29.86,29.86,0,0,1-5.16-3.2L367,99a27.81,27.81,0,0,0,7.29,4.52,26.68,26.68,0,0,0,11.55,2.39q7.17,0,11.6-3A9.17,9.17,0,0,0,401.85,95a8.15,8.15,0,0,0-2.13-5.89A15.52,15.52,0,0,0,394,85.51a65.71,65.71,0,0,0-7.85-2.39,54.5,54.5,0,0,1-8-2.47,29.46,29.46,0,0,1-7.08-4,18.1,18.1,0,0,1-5.07-6,17.52,17.52,0,0,1-1.88-8.32A15,15,0,0,1,368,52a24.68,24.68,0,0,1,10.06-6.61A38.91,38.91,0,0,1,391.62,43.13Z"/><path class="cls-1" d="M430.83,34.42a9.75,9.75,0,0,1-9.72-9.72A9.5,9.5,0,0,1,424,17.79a9.56,9.56,0,0,1,11.77-1.54,10.79,10.79,0,0,1,3.63,3.54,9.13,9.13,0,0,1,1.36,4.91,9.29,9.29,0,0,1-2.9,6.86A9.57,9.57,0,0,1,430.83,34.42Z"/><rect class="cls-1" x="423.24" y="45.18" width="14.84" height="70.01"/><path class="cls-1" d="M444.58,45.18h13.73V15.06h14.75V45.18h18v12.7h-18V92.5q0,6.15,2.17,9a6.94,6.94,0,0,0,5.84,2.9,9.06,9.06,0,0,0,5-1.19,12.8,12.8,0,0,0,2.14-1.62l5.88,10.91a20.28,20.28,0,0,1-2.73,1.62,26.45,26.45,0,0,1-5.71,2.13,31.59,31.59,0,0,1-8.19.94,19.56,19.56,0,0,1-13.68-5q-5.51-5-5.5-15.81V57.88H444.58Z"/><path class="cls-1" d="M557.46,59.59A29.91,29.91,0,0,0,545.6,47.44a35.89,35.89,0,0,0-18-4.31q-11.25,0-19.23,4.78a31.52,31.52,0,0,0-12.15,13,40.3,40.3,0,0,0-4.18,18.46A42.09,42.09,0,0,0,496.53,99a32.61,32.61,0,0,0,12.67,13.4q8.2,4.8,19.47,4.81a51.4,51.4,0,0,0,14.15-1.67,29,29,0,0,0,9.85-4.73,30.48,30.48,0,0,0,6.87-7.16l-7.24-9a23.44,23.44,0,0,1-4.18,4.81,25.23,25.23,0,0,1-7.46,4.61,28.5,28.5,0,0,1-11,1.92A25.2,25.2,0,0,1,516.7,103a20.07,20.07,0,0,1-7.89-8.28,25.64,25.64,0,0,1-2.73-11.52h55.34c.05-.45.11-1.25.18-2.42s.08-2,.08-2.43Q561.68,67.44,557.46,59.59ZM506.59,72a21.42,21.42,0,0,1,2.47-7.89,18.31,18.31,0,0,1,6.7-7c3-1.93,7.06-2.91,12.06-2.91,4.84,0,8.67,1,11.52,3a17.84,17.84,0,0,1,6.17,7.16,19.88,19.88,0,0,1,2,7.68Z"/><path class="cls-1" d="M594.89,43.13a44.64,44.64,0,0,1,10.19,1.11,46.6,46.6,0,0,1,8.18,2.64,23.09,23.09,0,0,1,4.9,2.73L612.28,59a24.17,24.17,0,0,0-6.14-3.45,24.64,24.64,0,0,0-9.89-1.92A20.5,20.5,0,0,0,586.1,56a7.42,7.42,0,0,0-4.18,6.78c0,3,1.44,5.3,4.31,7a40.47,40.47,0,0,0,11.55,4.3,59.44,59.44,0,0,1,10.88,3.67,21.57,21.57,0,0,1,8.23,6.35Q620,88.15,620,94.89a20.09,20.09,0,0,1-2.56,10.45,19.57,19.57,0,0,1-6.9,6.9,32.48,32.48,0,0,1-9.73,3.8,50.51,50.51,0,0,1-10.91,1.19,47.5,47.5,0,0,1-11.68-1.32,41.22,41.22,0,0,1-8.74-3.15,29.86,29.86,0,0,1-5.16-3.2L570.24,99a28.16,28.16,0,0,0,7.29,4.52,26.73,26.73,0,0,0,11.56,2.39q7.15,0,11.59-3A9.16,9.16,0,0,0,605.12,95,8.15,8.15,0,0,0,603,89.09a15.48,15.48,0,0,0-5.72-3.58,65,65,0,0,0-7.84-2.39,55,55,0,0,1-8-2.47,29.58,29.58,0,0,1-7.07-4,18.13,18.13,0,0,1-5.08-6,17.52,17.52,0,0,1-1.87-8.32A15.08,15.08,0,0,1,571.26,52a24.71,24.71,0,0,1,10.07-6.61A38.91,38.91,0,0,1,594.89,43.13Z"/><path class="cls-1" d="M18.33,126a18.31,18.31,0,0,1-9.26-2.58c-6.17-3.73-9.36-10.86-9-17.94C.87,85.92,14.13,77.23,28.63,71.84c-.06-2.72-.13-5.61-.21-8.9A59.28,59.28,0,0,1,1,64.07L3.75,50.56a46.28,46.28,0,0,0,24.32-2c-.07-3.32-.14-6.67-.19-10,0-1.3-.07-2.62-.12-4-.23-6.6-.49-14.08,2-21.06C32.77,5,40.25-.32,48.8,0S64.16,6.18,66.48,14.88c2.45,9.17-1,17.83-4.32,23.48a52.69,52.69,0,0,1-20.09,19c.09,3.38.17,6.76.26,10.14a88,88,0,0,0,14.31-5.26q2.56-1.24,5-2.69,2.59,4.47,5.21,8.9l1.76,3a84.83,84.83,0,0,1-21.4,9c-1.57.45-3.09.89-4.56,1.33.09,3.45.19,7.11.32,11.45.31,10.12-2.9,22.3-11.48,28.5A22.28,22.28,0,0,1,18.33,126ZM29,86.59c-9.35,4.18-14.77,9.59-15.2,19.49-.1,2.34.65,4.53,1.88,5.42a4.81,4.81,0,0,0,3.19.72c8.6-.72,10.52-12.46,10.33-18.56C29.13,91.1,29.06,88.78,29,86.59Zm19.08-72.8c-1.87,0-4.2,1.14-5.34,4.37-1.6,4.51-1.39,10.33-1.19,16,.05,1.43.1,2.84.12,4.22,0,.91,0,1.83,0,2.74a36.14,36.14,0,0,0,8.55-9.72c1.63-2.77,4.17-8.12,2.89-12.91-.77-2.86-2.55-4.56-4.9-4.65Z"/></g></g></svg>`

function sharedStyles(): string {
  return `<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem}
.card{background:#fff;border-radius:24px;padding:2.5rem 2rem 2rem;max-width:420px;width:100%;text-align:center;box-shadow:0 2px 16px rgba(0,0,0,0.07),0 0 0 1px rgba(0,0,0,0.04)}
.logo-wrap{margin-bottom:1.75rem}
.logo-wrap a{display:inline-block}
.logo-svg{height:26px;width:auto;display:block}
.sep{height:1px;background:#F1F5F9;margin:0 0 1.75rem}
.icon-wrap{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.1rem}
h1{font-size:1.2rem;font-weight:700;color:#111;margin-bottom:.4rem;letter-spacing:-0.02em}
.url{display:inline-block;background:#F8FAFC;color:#64748B;font-family:ui-monospace,SFMono-Regular,monospace;font-size:.72rem;padding:.2rem .65rem;border-radius:6px;margin:.6rem 0 .9rem;border:1px solid #E2E8F0}
p{color:#6B7280;font-size:.85rem;line-height:1.65;margin-bottom:1.5rem}
.cta{display:inline-flex;align-items:center;gap:7px;padding:.65rem 1.4rem;background:#1a1a1a;color:#fff;border-radius:12px;text-decoration:none;font-weight:600;font-size:.85rem}
.cta:hover{background:#333}
.footer{margin-top:1.5rem;font-size:.72rem;color:#CBD5E1}
.footer a{color:#94A3B8;text-decoration:none}
</style>`
}

function successPage(): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Danke!</title>${sharedStyles()}</head><body>
<div class="card">
  <div class="logo-wrap"><a href="https://finestsites.com">${LOGO_BLACK}</a></div>
  <div class="sep"></div>
  <div class="icon-wrap" style="background:#F0FDF4">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
  </div>
  <h1>Vielen Dank!</h1>
  <p>Deine Nachricht wurde erfolgreich übermittelt.</p>
  <a href="javascript:history.back()" class="cta">← Zurück zur Seite</a>
</div>
</body></html>`
}

function offlinePage(username: string, domain: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seite offline – FinestSites</title>${sharedStyles()}</head><body>
<div class="card">
  <div class="logo-wrap"><a href="https://finestsites.com">${LOGO_BLACK}</a></div>
  <div class="sep"></div>
  <div class="icon-wrap" style="background:#FEF3C7">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="#D97706"/></svg>
  </div>
  <h1>Diese Seite ist offline</h1>
  <div class="url">${username}.${domain}</div>
  <p>Der Inhaber hat diese Webseite vorübergehend deaktiviert.<br>Sie ist momentan nicht öffentlich zugänglich.</p>
  <a href="https://finestsites.com" class="cta">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
    Eigene Webseite erstellen
  </a>
  <p class="footer">Powered by <a href="https://finestsites.com">FinestSites</a></p>
</div>
</body></html>`
}

function notFoundPage(username: string, domain: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seite nicht gefunden – FinestSites</title>${sharedStyles()}</head><body>
<div class="card">
  <div class="logo-wrap"><a href="https://finestsites.com">${LOGO_BLACK}</a></div>
  <div class="sep"></div>
  <div class="icon-wrap" style="background:#F3F4F6">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
  </div>
  <h1>Seite nicht gefunden</h1>
  <div class="url">${username}.${domain}</div>
  <p>Diese Adresse existiert noch nicht oder wurde noch nicht veröffentlicht.</p>
  <a href="https://finestsites.com" class="cta">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
    Eigene Webseite erstellen
  </a>
  <p class="footer">Powered by <a href="https://finestsites.com">FinestSites</a></p>
</div>
</body></html>`
}
