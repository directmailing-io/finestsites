# Cloudflare Worker Architecture

FinestSites uses a single Cloudflare Worker (`finestsites-worker`) as the public
edge layer for all user-created sites. The Worker serves HTML, assets, and form
endpoints — and never connects to the database directly. All data access goes through
the FinestSites app API running on the Hetzner VPS.

---

## Overview

```
Browser request to john.myevnt.io
        │
        ▼
Cloudflare Edge (Worker: finestsites-worker)
        │
        ├─ KV_CACHE hit? ──────────────────────► Return cached HTML immediately
        │
        ├─ Static asset (.css/.js/.png…) ──────► R2 bucket (1-year immutable cache)
        │
        ├─ HTML render (cache miss)
        │       ├─ GET /api/worker/site-meta  ──► App API → PostgreSQL
        │       ├─ GET /api/worker/site-data  ──► App API → PostgreSQL
        │       ├─ render(templateHtml, data)
        │       └─ store in KV (60s TTL) ──────► Return rendered HTML
        │
        └─ Form POST /.finestsites/forms/…
                ├─ Rate limit check (KV)
                ├─ POST /api/worker/submit ─────► App API → PostgreSQL
                └─ GET /api/worker/site-info ───► App API → PostgreSQL (email, fire-and-forget)
```

---

## Site Serving: Cache Hit vs Cache Miss

### Cache Hit (fast path)

1. Worker receives `GET /` for `john.myevnt.io`.
2. Hostname resolved → username = `john`, domain = `myevnt.io`.
3. KV lookup: `rendered:john:myevnt.io` → HTML string found.
4. Return HTML with `X-Cache: HIT` header. Total: ~1–5 ms edge latency.

### Cache Miss (full render)

1. Worker receives `GET /` — no rendered HTML in KV.
2. KV lookup: `meta:john:myevnt.io` — site meta not cached either.
3. Worker calls `GET /api/worker/site-meta?username=john&domain=myevnt.io`.
   App returns `{ siteId, templateId, r2BasePath }` and Worker caches it (60s TTL).
4. Worker fetches `${r2BasePath}/index.html` from R2 (raw template HTML with `{{placeholders}}`).
5. Worker calls `GET /api/worker/site-data?siteId=…`.
   App returns `[{ fieldKey, fieldValue }, …]` — the user's content.
6. Worker runs `render(templateHtml, dataMap)` — Handlebars-like substitution.
7. Rendered HTML stored in KV (`rendered:john:myevnt.io`, 60s TTL).
8. Return HTML to browser.

---

## Form Submission Flow

Forms on user sites POST to `/.finestsites/forms/{formName}`.

```
Visitor submits form
        │
        ▼
Worker: handleFormSubmission()
        │
        ├─ Parse form data (multipart, urlencoded, or JSON)
        │   Strip system fields: _redirect, _honeypot, _recipient, _*
        │
        ├─ Honeypot check (filled → isSpam = true, still saved, no email)
        │
        ├─ KV rate limit: rate:{siteId}:{ip} — 5 req / 10 min per IP
        │   Exceeded → 429 response
        │
        ├─ SHA-256 hash the submitter IP (privacy-safe storage)
        │
        ├─ POST /api/worker/submit → App persists to form_submissions table
        │
        ├─ ctx.waitUntil(sendSubmissionEmail())   ← fire-and-forget, never blocks response
        │       ├─ GET /api/worker/site-info → user email + form schema
        │       └─ POST https://api.resend.com/emails
        │
        └─ Response:
            Accept: application/json → { success: true }
            _redirect field set     → 302 redirect
            default                 → inline success HTML page
```

---

## Worker ↔ App API Contract

All four endpoints live under `/api/worker/` in the Next.js app. They share the
same authentication model: the Worker sends `x-worker-secret: <WORKER_SECRET>` on
every request; the app rejects requests with a wrong or missing header (401).
In development, `WORKER_SECRET` may be unset — the app then allows all requests.

### GET /api/worker/site-meta

Resolves a (username, template domain) pair to site IDs and R2 path.
Called on KV meta cache miss. Response cached in Worker KV for 60s.

```
Request:
  GET /api/worker/site-meta?username=john&domain=myevnt.io
  x-worker-secret: <secret>

Response 200:
  { siteId: "uuid", templateId: "uuid", r2BasePath: "templates/uuid/v3" }

Response 404:
  { error: "not found" }   — site doesn't exist or isn't published
```

### GET /api/worker/site-data

Returns all placeholder key/value pairs for a site. Called on rendered HTML
cache miss, immediately after site-meta. Response is NOT cached separately —
the Worker caches the final rendered HTML instead.

```
Request:
  GET /api/worker/site-data?siteId=<uuid>
  x-worker-secret: <secret>

Response 200:
  [ { fieldKey: "business_name", fieldValue: "Muster GmbH" }, … ]
```

### POST /api/worker/submit

Persists a form submission to PostgreSQL. The Worker has already rate-limited
and spam-checked before calling this.

```
Request:
  POST /api/worker/submit
  x-worker-secret: <secret>
  Content-Type: application/json

  {
    "userSiteId":      "uuid",
    "formName":        "contact",
    "data":            { "name": "Anna", "email": "anna@example.com" },
    "submitterIpHash": "sha256hex…",
    "isSpam":          false
  }

Response 200:
  { success: true, id: "uuid" }
```

### GET /api/worker/site-info

Returns the site owner's email address and the form schema (field labels,
title, notification preference). Called fire-and-forget after submit.

```
Request:
  GET /api/worker/site-info?siteId=<uuid>&templateId=<uuid>&formName=contact
  x-worker-secret: <secret>

Response 200:
  {
    "userEmail": "owner@example.com",
    "formSchema": {
      "title": "Kontaktanfrage",
      "fields": [ { "key": "name", "label": "Name" }, … ],
      "emailNotificationEnabled": true
    }
  }
```

---

## KV Cache Strategy

The KV namespace (`KV_CACHE`, binding in wrangler.toml) serves multiple purposes:

| Key pattern                        | Content                          | TTL      | Set by              |
|------------------------------------|----------------------------------|----------|---------------------|
| `meta:{username}:{domain}`         | JSON SiteMeta or `__offline__`   | 60s      | Worker (on fetch)   |
| `rendered:{username}:{domain}`     | Rendered HTML string             | 60s      | Worker (on render)  |
| `custom:{hostname}`                | JSON `{username, templateDomain}`| no TTL   | App (kv-api.ts)     |
| `rate:{siteId}:{ip}`               | Submission count (string int)    | 600s     | Worker (on submit)  |
| `demo:{slug}`                      | Pre-rendered HTML for admin preview | 24h  | App (admin preview) |

**Invalidation:** When a user publishes or unpublishes a site, the app calls
`POST /.finestsites/kv` on the Worker with action `purge` or `offline`.
This deletes or overwrites the `meta:` and `rendered:` keys immediately, bypassing
the 60s TTL. The `custom:` and `demo:` keys are written directly via the Cloudflare
API (`src/lib/cloudflare/kv-api.ts`).

---

## R2 Bucket Structure

Bucket name: `finestsites-templates`

```
finestsites-templates/
└── templates/
    └── {templateId}/         ← one directory per template version
        ├── index.html        ← raw template with {{placeholder}} syntax
        ├── style.css
        ├── main.js
        └── assets/
            ├── logo.png
            └── font.woff2
```

The `r2BasePath` returned by `/api/worker/site-meta` points to `templates/{templateId}`
(the `/index.html` suffix is stripped). The Worker constructs asset keys as
`${r2BasePath}/${assetPath}` for all non-HTML requests.

Assets are served with `Cache-Control: public, max-age=31536000, immutable` because
template bundles are versioned — a new template version gets a new directory.

---

## Hostname Resolution

The Worker supports two hostname patterns, checked in order:

1. **Custom domain** — Worker does KV lookup for `custom:{hostname}`.
   If found, parses `{ username, templateDomain }` from the JSON value.
   This mapping is written by the app when a user connects a custom domain.

2. **Subdomain** — Falls back to splitting on `.`:
   `john.myevnt.io` → username = `john`, domain = `myevnt.io`.
   Requires at least 3 hostname parts; otherwise returns 404.

**Edge case — workers.dev proxy:** When the app middleware forwards a request
through the Worker's `*.workers.dev` URL, the actual hostname is passed in
`X-Forwarded-Host` because CF rejects a mismatched `Host` header. The Worker
detects this and reads the forwarded header instead.

---

## Custom Domains (CF for SaaS)

Users can connect arbitrary domains (e.g. `www.my-business.de`) to their site.
The setup uses Cloudflare for SaaS (Custom Hostnames):

```
www.my-business.de
        │  (user sets CNAME → proxy.finestsites.io)
        ▼
Cloudflare for SaaS (womenplus.io zone)
        │  Custom Hostname entry for www.my-business.de
        │  Fallback Origin → worker.finestsites.com
        ▼
CF Worker Custom Domain: worker.finestsites.com
        │  (separate zone avoids orange-to-orange 522 loop)
        ▼
finestsites-worker (reads Host header, looks up KV custom:{hostname})
```

The app writes the `custom:{hostname}` KV entry via `setCustomDomainKV()` in
`src/lib/cloudflare/kv-api.ts` when the user saves their domain in settings.
The CF for SaaS Custom Hostname entry (SSL provisioning) is managed separately
via the Cloudflare API in `src/lib/cloudflare/custom-hostnames.ts`.

---

## Environment Variables and Secrets

### Worker (wrangler.toml + CF dashboard secrets)

| Name              | Where set              | Purpose                                     |
|-------------------|------------------------|---------------------------------------------|
| `APP_URL`         | wrangler.toml `[vars]` | Base URL of the FinestSites app             |
| `WORKER_SECRET`   | CF dashboard secret    | Shared secret for app API authentication    |
| `RESEND_API_KEY`  | CF dashboard secret    | Resend API key for notification emails      |
| `R2_BUCKET`       | wrangler.toml binding  | R2 bucket binding (name: finestsites-templates) |
| `KV_CACHE`        | wrangler.toml binding  | KV namespace binding (id in wrangler.toml)  |

### App (VPS .env.production)

| Name                        | Purpose                                               |
|-----------------------------|-------------------------------------------------------|
| `WORKER_SECRET`             | Must match the Worker's secret — used to validate inbound requests |
| `CLOUDFLARE_API_TOKEN`      | Zone/KV/SSL operations (read via kv-api.ts fallback)  |
| `CLOUDFLARE_KV_TOKEN`       | KV Storage:Edit — preferred token for KV writes       |
| `CLOUDFLARE_ACCOUNT_ID`     | CF account ID for API calls                           |
| `CLOUDFLARE_KV_NAMESPACE_ID`| KV namespace ID (matches wrangler.toml)               |
| `CLOUDFLARE_ZONE_ID_*`      | Per-template-domain zone IDs for Custom Hostnames API |

---

## Security Model

- **Worker → App:** Every request from the Worker to `/api/worker/*` carries
  `x-worker-secret: <WORKER_SECRET>`. The app rejects requests without this header
  (401). The secret is never sent to the browser.

- **App → Worker (KV admin):** The app POSTs to `/.finestsites/kv` on the Worker
  with `Authorization: Bearer <WORKER_SECRET>`. The Worker validates this before
  mutating any KV keys.

- **Rate limiting:** Form submissions are rate-limited at the Worker edge (5 per
  IP per 10 minutes using KV). This prevents database spam before it reaches the
  app API.

- **Honeypot:** A hidden `_honeypot` field in every form. Bots that fill it trigger
  `isSpam=true` — the submission is saved for review but no email is sent.

- **IP privacy:** Submitter IPs are hashed with SHA-256 before storage. The raw IP
  never reaches the database.

- **Custom domain SSL:** Managed by Cloudflare for SaaS; certificates are
  provisioned automatically when the user adds a Custom Hostname entry.

---

## Deployment

```bash
# Always deploy from the project root, pointing at the worker's config file.
# Do NOT use `wrangler deploy` from inside the cloudflare-worker/ directory —
# the wrangler.toml contains relative path references that break without the
# correct working directory.

wrangler deploy --config cloudflare-worker/wrangler.toml
```

The Worker is deployed to:
- `finestsites-worker.{account}.workers.dev` (workers_dev = true)
- `*.womenplus.io/*` (zone route)
- `*.myevnt.io/*` (zone route)
- `*.lnko.me/*` (zone route)
- `worker.finestsites.com` (Custom Domain — fallback origin for CF for SaaS)

Route definitions in `wrangler.toml` are authoritative. Any routes set manually
in the CF dashboard will be overwritten on next deploy.

---

## Template Engine

The Worker contains a full copy of the template engine from
`src/lib/utils/template-engine.ts`. The two files must be kept in sync because
the Worker renders the live site and the app renders previews — they must produce
identical HTML for the same data.

Supported syntax:
- `{{key}}` — HTML-escaped placeholder substitution
- `{{{key}}}` — Raw (unescaped) substitution for stored HTML (e.g. rich text)
- `{{#each items}}…{{this.field}}…{{/each}}` — loops with nesting support
- `{{#if condition}}…{{/if}}` — conditionals (truthy/falsy or equality checks)
- `{{#unless condition}}…{{/unless}}` — inverse conditionals
- `{{@index}}` — 1-based loop index
- `{{../parentField}}` — parent scope access inside loops
