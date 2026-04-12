# FinestSites - Setup Guide

## Project Status: Initial scaffold complete

The Next.js project has been initialized with all dependencies, configuration, database schema, and folder structure.

---

## What's Been Set Up

### Core Framework
- Next.js 16.x (App Router, TypeScript)
- Tailwind CSS v4
- shadcn/ui components (button, card, input, label, form, select, textarea, badge, alert, dialog, sheet, tabs, avatar, dropdown-menu, separator, progress, sonner)
- ESLint configured

### Dependencies Installed
- `@supabase/supabase-js` + `@supabase/ssr` - Supabase client & server
- `stripe` - Payment processing
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` - Cloudflare R2 (S3-compatible)
- `nodemailer` + `resend` - Email sending
- `zod` - Schema validation
- `react-hook-form` + `@hookform/resolvers` - Form handling
- `lucide-react` - Icons
- `date-fns` - Date utilities

### Library Files Created
- `src/lib/supabase/client.ts` - Browser Supabase client
- `src/lib/supabase/server.ts` - Server-side Supabase client
- `src/lib/supabase/admin.ts` - Admin Supabase client (service role)
- `src/lib/supabase/middleware.ts` - Auth session middleware
- `src/lib/stripe/client.ts` - Stripe client + plan definitions
- `src/lib/r2/client.ts` - Cloudflare R2 upload/download utilities
- `src/lib/utils/placeholder-engine.ts` - {{KEY}} placeholder replacement engine
- `src/middleware.ts` - Next.js route protection middleware
- `src/types/index.ts` - TypeScript type definitions

### Database
- `supabase/migrations/001_initial_schema.sql` - Full database schema including:
  - `users` table (extends auth.users)
  - `templates` table (admin-managed)
  - `user_sites` table (user's activated templates)
  - `site_data` table (form field values)
  - `site_images` table (uploaded images)
  - `template_updates` table (update notifications)
  - `user_notifications` table
  - Row Level Security policies for all tables
  - Auto-create user profile trigger on signup
  - updated_at triggers

### Cloudflare Worker
- `cloudflare-worker/src/index.ts` - Worker that serves user sites
- `cloudflare-worker/wrangler.toml` - Wrangler configuration

---

## What Still Needs to Be Done

### Credentials to Fill In (.env.local)

| Variable | Status | How to Get |
|----------|--------|------------|
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | REPLACE_ME | Cloudflare Dashboard → R2 → Manage R2 API Tokens |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | REPLACE_ME | Same as above |
| `STRIPE_WEBHOOK_SECRET` | REPLACE_ME | Stripe Dashboard → Webhooks → Add endpoint |
| `STRIPE_PRICE_STARTER_MONTHLY` | REPLACE_ME | Stripe Dashboard → Products → Create product |
| `STRIPE_PRICE_STARTER_YEARLY` | REPLACE_ME | Same |
| `STRIPE_PRICE_PRO_MONTHLY` | REPLACE_ME | Same |
| `STRIPE_PRICE_PRO_YEARLY` | REPLACE_ME | Same |
| `STRIPE_PRICE_UNLIMITED_MONTHLY` | REPLACE_ME | Same |
| `STRIPE_PRICE_UNLIMITED_YEARLY` | REPLACE_ME | Same |
| `MAILGUN_API_KEY` | REPLACE_ME | Mailgun Dashboard → API Keys |
| `MAILGUN_DOMAIN` | REPLACE_ME | Mailgun Dashboard → Domains |

### Database Setup
Run the migration in Supabase:
1. Go to https://supabase.com/dashboard/project/blgxussxxziglevezzrk
2. Go to SQL Editor
3. Paste and run `supabase/migrations/001_initial_schema.sql`

### Stripe Products to Create
Create these products in Stripe Dashboard (https://dashboard.stripe.com/test/products):
1. **Starter** - €17/month, €170/year (1 site)
2. **Pro** - €29/month, €290/year (3 sites)
3. **Unlimited** - €39/month, €390/year (unlimited sites)

After creating, copy the Price IDs into `.env.local`.

### Stripe Webhook
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET` in `.env.local`

### Cloudflare Worker
1. Create KV namespace in Cloudflare Dashboard
2. Update `cloudflare-worker/wrangler.toml` with KV namespace ID
3. Deploy: `cd cloudflare-worker && npx wrangler deploy`

### Next Steps (Pages to Build)
- [ ] Auth pages: login, register, forgot-password, setup-username
- [ ] Dashboard layout with navigation
- [ ] Sites listing and management pages
- [ ] Template selector page
- [ ] Site editor (form for placeholder fields)
- [ ] Settings and billing pages
- [ ] Admin panel (templates, users management)
- [ ] API routes for all operations
- [ ] Email templates

---

## Development

```bash
npm run dev     # Start development server
npm run build   # Build for production
npm run lint    # Run ESLint
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Auth pages (login, register, etc.)
│   ├── (dashboard)/     # User dashboard pages
│   ├── (admin)/         # Admin panel pages
│   └── api/             # API routes
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── auth/            # Auth-related components
│   ├── dashboard/       # Dashboard components
│   ├── admin/           # Admin components
│   └── shared/          # Shared/layout components
├── lib/
│   ├── supabase/        # Supabase clients
│   ├── stripe/          # Stripe client + plan config
│   ├── r2/              # Cloudflare R2 utilities
│   ├── mailgun/         # Email utilities
│   └── utils/           # General utilities (placeholder engine)
├── types/               # TypeScript types
└── middleware.ts         # Route protection

supabase/
└── migrations/          # Database migrations

cloudflare-worker/       # Separate Cloudflare Worker project
├── src/index.ts
└── wrangler.toml
```
