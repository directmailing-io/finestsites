# FinestSites — Platform Architecture

> Last updated: 2026-07-12
> Stack: Next.js 15 (App Router) · BetterAuth · Drizzle ORM · PostgreSQL · Cloudflare Worker · R2 · Stripe

---

## Table of Contents

1. [Infrastructure Overview](#1-infrastructure-overview)
2. [Authentication & Session](#2-authentication--session)
3. [Onboarding Flow](#3-onboarding-flow)
4. [Template System](#4-template-system)
5. [Publish Flow](#5-publish-flow)
6. [Cloudflare Worker & KV](#6-cloudflare-worker--kv)
7. [API Endpoint Map](#7-api-endpoint-map)
8. [Database Schema](#8-database-schema)
9. [Billing & Plans](#9-billing--plans)
10. [Affiliate System](#10-affiliate-system)
11. [Deployment](#11-deployment)

---

## 1. Infrastructure Overview

```
User browser
    │
    ├─ finestsites.io   (marketing site, Next.js, same VPS)
    │
    └─ app.finestsites.io  (app, Next.js, Hetzner VPS)
            │
            ├─ Caddy (reverse proxy, port 80 → 3002)
            ├─ PM2 process: "finestsites" (Next.js standalone, port 3002)
            └─ PostgreSQL (via DATABASE_URL in .env.production)

User-created sites:
    {username}.{template-domain}  →  Cloudflare Worker  →  KV cache / R2
    e.g. anna.myevnt.io           →  finestsites-worker →  rendered HTML
```

**Key hostnames:**
- `app.finestsites.io` — the SaaS app (login, editor, dashboard)
- `finestsites.io` — marketing/landing page only (middleware blocks app routes)
- `*.myevnt.io`, `*.womenplus.io`, `*.lnko.me`, `*.dailyoptimal.de` — template domains for user sites

**Cloudflare Worker** sits in front of all template domains. The Next.js app itself is NOT on Cloudflare — it lives behind Caddy on the VPS.

---

## 2. Authentication & Session

**Library:** BetterAuth (NOT Supabase Auth).

Sessions are stored server-side. Cookies are HTTP-only, SameSite=Lax.

### Middleware (Edge Runtime limitation)

Next.js middleware runs in Edge Runtime, which cannot use the PostgreSQL driver (`pg`/`postgres`). To work around this, the middleware makes a loopback HTTP call to:

```
GET /api/middleware/auth-check   (Node.js runtime, can use DB)
```

This endpoint returns `{ user, profile }` where `profile` includes:
- `username` — whether onboarding step 1 is done
- `contentConsentAt` — whether onboarding step 2 is done
- `subscriptionStatus` — plan/billing status

The middleware uses this data to enforce the onboarding funnel and protect app routes.

### Route protection logic (middleware.ts)

```
Not logged in + protected route   →  redirect /login
Logged in + no username           →  redirect /onboarding/username
Logged in + no consent            →  redirect /onboarding/consent
Logged in + visiting /login|/register  →  redirect /sites
Admin email                       →  bypass all checks
```

---

## 3. Onboarding Flow

New users go through two mandatory steps before accessing the app:

### Step 1: Username (`/onboarding/username`)
- Sets `users.username` (unique, URL-safe slug)
- Username becomes the subdomain: `{username}.{template-domain}`

### Step 2: Content Consent (`/onboarding/consent`)
- User reads and accepts the content policy (no Heilaussagen, legal images, etc.)
- Stored in: `users.content_consent_at`, `content_consent_ip`, `content_consent_ua`, `content_consent_version`, `content_consent_text_hash`
- Consent text is SHA-256 hashed for legal proof
- After saving, the page does a **hard navigation** (`window.location.href`) — NOT `router.push` — to guarantee the middleware reads the freshly committed DB value

### Why hard navigation matters
`router.push` is client-side; the middleware runs server-side on the next request. If middleware's auth-check call hits a connection pool read slightly before the DB write is committed, it would redirect the user BACK to consent, creating a loop. `window.location.href` forces a full round-trip, so the write is always visible.

---

## 4. Template System

Templates are HTML files stored in Cloudflare R2. Each template has:
- A **domain** (e.g. `myevnt.io`) — determines the subdomain pattern
- A **placeholder schema** (JSON) — defines the fields the editor shows
- An **R2 bundle path** — the raw HTML template file in R2

### Placeholder syntax in HTML templates

```
{{firstName}}              — simple text replacement
{{#section}}...{{/section}} — conditional block
{{coverImage}}             — image field
```

The template engine (`src/lib/utils/template-engine.ts`) processes these on publish.

### Template access tiers

- **Free templates** — publishable without a subscription
- **Premium templates** — require an active subscription + within plan quota

---

## 5. Publish Flow

```
User clicks "Publish" in editor
    │
    POST /api/sites/[id]/publish
    │
    ├─ Gate 1: Auth (valid session)
    ├─ Gate 2: Ownership (site belongs to user)
    ├─ Gate 3: Template has R2 bundle
    ├─ Gate 4: Subscription (if premium template)
    │     ├─ Active subscription required
    │     └─ Plan quota not exceeded (starter=1, pro=3, unlimited=∞)
    ├─ Gate 5: Content consent (users.content_consent_at must be set)
    │
    ├─ DB: set status='published', publishedAt=now()
    ├─ KV: purge cache keys for {username}.{domain}
    └─ KV: pre-render HTML with user's data → write rendered:{username}:{domain}
```

**Pre-rendering:** After publish, the route fetches the raw template HTML from R2, runs it through the template engine with the user's placeholder data, and writes the result directly to the Worker's KV cache. This means the very first visitor sees the fully rendered page with zero cold-render latency.

### Unpublish flow

```
DELETE /api/sites/[id]/publish
    │
    ├─ DB: set status='draft'
    └─ KV: mark site offline (removes rendered HTML + site-meta from KV)
```

---

## 6. Cloudflare Worker & KV

See `docs/cloudflare-worker-architecture.md` for the full Worker design.

**KV key patterns:**
- `site:{username}:{domain}` — SiteMeta (id, templateId, isPublished, customDomain)
- `rendered:{username}:{domain}` — pre-rendered HTML (written by publish, served directly)
- `custom:{hostname}` — custom domain → username/domain mapping (for custom user domains)

**Worker API endpoints** (called by the Worker, protected by `x-worker-secret`):
- `GET /api/worker/site-meta?username=&domain=` — fresh SiteMeta for KV population
- `GET /api/worker/site-data?siteId=` — user's placeholder values
- `POST /api/worker/submit` — save a form submission
- `GET /api/worker/site-info?siteId=&templateId=&formName=` — email + form schema for notifications

**Deploying the Worker:**
```bash
# Must be done FROM THE VPS (not locally — wrangler.jsonc in root interferes)
ssh root@187.124.187.228 "cd /var/www/finestsites/cloudflare-worker && \
  CLOUDFLARE_API_TOKEN=... npx wrangler deploy"
```

**Adding a new template domain:**
1. CF Dashboard: add proxied wildcard A record `*.newdomain.tld → 192.0.2.1` in the zone
2. `cloudflare-worker/wrangler.toml`: add `[[routes]]` entry + `zone_id`
3. Deploy Worker from VPS
4. Test: `curl https://test.newdomain.tld/.finestsites/health`

---

## 7. API Endpoint Map

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/[...all]` | BetterAuth catch-all (login, logout, session) |
| POST | `/api/auth/consent` | Save onboarding content consent |
| POST | `/api/auth/register` | Custom registration (also handles template intent cookie) |
| POST | `/api/auth/forgot-password` | Password reset email |
| GET | `/api/middleware/auth-check` | Internal: used by middleware for session + profile |

### Sites
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sites` | List user's sites |
| POST | `/api/sites` | Create new site (optionally from template intent cookie) |
| GET | `/api/sites/[id]` | Get site detail + placeholder data |
| PATCH | `/api/sites/[id]` | Update site placeholder values |
| DELETE | `/api/sites/[id]` | Delete site |
| POST | `/api/sites/[id]/publish` | Publish site (see Publish Flow above) |
| DELETE | `/api/sites/[id]/publish` | Unpublish site |
| GET/POST | `/api/sites/[id]/domain` | Set/verify custom domain |
| GET | `/api/sites/[id]/submissions` | List form submissions for a site |

### Templates (public)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/templates` | List available templates (public + filtered by plan access) |
| GET | `/api/templates/[id]/public-preview` | Render template HTML for preview iframe |
| GET | `/api/templates/[id]/public-preview/asset/[...path]` | R2 asset proxy for preview |

### Billing
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/billing/checkout` | Create Stripe Checkout session |
| POST | `/api/billing/portal` | Create Stripe Customer Portal session |
| GET | `/api/billing/subscription` | Get current subscription details |
| POST | `/api/billing/activate` | Activate subscription after payment |
| GET | `/api/billing/verify-session` | Verify Stripe session after return |
| POST | `/api/webhooks/stripe` | Stripe webhook handler |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users |
| GET/PATCH/DELETE | `/api/admin/users/[id]` | Get/update/delete user |
| GET | `/api/admin/templates` | List all templates |
| GET/PATCH | `/api/admin/templates/[id]` | Get/update template |
| POST | `/api/admin/templates/[id]/upload` | Upload template HTML to R2 |
| POST | `/api/admin/templates/[id]/cover` | Upload template cover image |

### Worker (internal, protected by x-worker-secret)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/worker/site-meta` | Site metadata for KV cache |
| GET | `/api/worker/site-data` | Placeholder values |
| POST | `/api/worker/submit` | Save form submission |
| GET | `/api/worker/site-info` | Email + form schema |

### Cron
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cron/billing-enforcement` | Deactivate overdue/cancelled subscriptions |
| GET | `/api/cron/check-domains` | Verify pending custom domains |
| GET | `/api/cron/cleanup-drafts` | Delete very old abandoned drafts |
| GET | `/api/cron/affiliate-payouts` | Process pending affiliate payouts |

---

## 8. Database Schema

### `users`
Core user record (managed by BetterAuth + custom columns).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `email` | text | unique |
| `username` | varchar(50) | URL-safe slug, set at onboarding step 1 |
| `subscription_status` | text | `active`, `trialing`, `past_due`, `canceled`, null |
| `plan` | text | `starter`, `pro`, `unlimited`, `secret` |
| `stripe_customer_id` | text | |
| `stripe_subscription_id` | text | |
| `content_consent_at` | timestamp | Set at onboarding step 2 — gates all publishes |
| `content_consent_ip` | varchar(64) | Legal proof |
| `content_consent_ua` | text | Legal proof |
| `content_consent_version` | varchar(20) | Consent text version |
| `content_consent_text_hash` | text | SHA-256 of the exact consent text shown |

### `templates`
Platform templates managed by admin.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `title` | text | Display name |
| `description` | text | Short description shown on template cards |
| `domain` | text | e.g. `myevnt.io` — determines user subdomain pattern |
| `r2_bundle_path` | text | Path to HTML in R2, e.g. `templates/{id}/index.html` |
| `placeholder_schema` | jsonb | Field definitions for the editor |
| `is_free` | boolean | Free = publishable without subscription |
| `is_coming_soon` | boolean | Not yet available, shown as "Bald" on template cards |
| `preview_images` | jsonb | Array of CDN URLs for card thumbnails |
| `nm_companies` | jsonb | NM company filters, e.g. `["PM-International"]` |

### `user_sites`
A user's instance of a template (one record per site).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → users |
| `template_id` | uuid | FK → templates |
| `status` | text | `draft`, `published`, `deactivated` |
| `published_at` | timestamp | When last published |
| `custom_domain` | text | User's own domain, e.g. `www.anna-events.de` |
| `custom_domain_status` | text | `pending`, `active`, `failed` |
| `cf_custom_hostname_id` | text | Cloudflare for SaaS hostname ID |
| `content_consent_given_at` | timestamp | **@deprecated** — superseded by `users.content_consent_at` |

### `site_data`
One row per placeholder field per site.

| Column | Type | Notes |
|--------|------|-------|
| `user_site_id` | uuid | FK → user_sites |
| `field_key` | text | e.g. `firstName`, `coverImage` |
| `field_value` | text | The user's value |

### `site_images`
Uploaded images (stored in R2, referenced here).

### `submissions`
Form submissions collected by the Worker and stored via `/api/worker/submit`.

### `affiliate_referrals`, `affiliate_payouts`
Affiliate tracking tables. See `supabase/migrations/006_affiliate_system.sql`.

---

## 9. Billing & Plans

**Provider:** Stripe (card + SEPA debit only — no Klarna).

**Plans:**
| Plan | Sites | Monthly |
|------|-------|---------|
| Starter | 1 premium site | 20€ |
| Pro | 3 premium sites | 30€ |
| Unlimited | ∞ | custom |

**Rules:**
- Upgrade only — no downgrade in the billing portal
- Free templates are always publishable regardless of plan
- `past_due` subscriptions still count as active (grace period)
- Stripe webhooks update `users.subscription_status` and `users.plan`

---

## 10. Affiliate System

- Users generate a referral link with their username
- Conversions tracked via `affiliate_referrals` table
- Payouts processed via Stripe Connect (`/api/affiliate/connect`)
- Cron job (`/api/cron/affiliate-payouts`) runs monthly

---

## 11. Deployment

### App (Next.js on VPS)

```bash
# Full deploy sequence
git push origin main
ssh root@187.124.187.228 "
  cd /var/www/finestsites &&
  git pull origin main &&
  npm run build &&
  cp -r public .next/standalone/ &&
  cp -r .next/static .next/standalone/.next/ &&
  pm2 restart finestsites --update-env
"
```

The app runs as `pm2` process `finestsites` in cluster mode (port 3002). Caddy proxies `app.finestsites.io` → port 3002.

### Worker (Cloudflare)

```bash
# MUST be run from VPS, not local machine
ssh root@187.124.187.228 "
  cd /var/www/finestsites &&
  git pull origin main &&
  cd cloudflare-worker &&
  CLOUDFLARE_API_TOKEN=... npx wrangler deploy
"
```

The `wrangler.jsonc` in the project root is for OpenNext and must NOT be committed — it interferes with the Worker deploy.

### Environment Variables

Key variables in `/var/www/finestsites/.env.production` on VPS:
- `DATABASE_URL` — PostgreSQL connection string
- `WORKER_SECRET` — shared secret for `/api/worker/*` endpoints
- `CLOUDFLARE_API_TOKEN` — scoped to Zone/KV/SSL
- `CLOUDFLARE_WORKERS_TOKEN` — scoped to Workers/R2/KV deploy
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY` — transactional email
- `NEXT_PUBLIC_APP_URL` — `https://app.finestsites.io`

### KV Cache Invalidation

After deploying a new template version, purge the KV cache:
```bash
curl -X POST https://app.finestsites.io/.finestsites/kv \
  -H "Authorization: Bearer {WORKER_SECRET}" \
  -d '{"action":"purge"}'
```
