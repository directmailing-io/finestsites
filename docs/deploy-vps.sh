#!/bin/bash
# FinestSites VPS Deployment Script
# Run as root on the Hostinger VPS (187.124.187.228)
# Usage: bash deploy-vps.sh

set -e

APP_DIR="/var/www/finestsites"
APP_PORT=3002
REPO_URL="https://github.com/directmailing-io/finestsites.git"

echo "=== FinestSites VPS Deployment ==="

# ---- Env vars (edit these if needed) ----
export NEXT_PUBLIC_APP_URL="https://app.finestsites.io"
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."  # fill in from .env.local

# ---- Install dependencies if missing ----
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi

# ---- Clone or update repo ----
if [ -d "$APP_DIR/.git" ]; then
  echo "Updating existing repo..."
  cd "$APP_DIR"
  git pull origin main
else
  echo "Cloning repo..."
  mkdir -p "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ---- Write environment file ----
# IMPORTANT: Replace all placeholder values below with real values from your .env.local
cat > "$APP_DIR/.env.production" << 'ENVEOF'
NODE_ENV=production

# Database (Supabase - IPv6 works from this VPS)
DATABASE_URL=postgresql://postgres:s6pNItJtjy83CFtG@db.blgxussxxziglevezzrk.supabase.co:5432/postgres

# BetterAuth
BETTER_AUTH_SECRET=REPLACE_FROM_ENV_LOCAL
BETTER_AUTH_URL=https://app.finestsites.io

# App URL
NEXT_PUBLIC_APP_URL=https://app.finestsites.io

# Stripe
STRIPE_SECRET_KEY=REPLACE_FROM_ENV_LOCAL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=REPLACE_FROM_ENV_LOCAL
STRIPE_WEBHOOK_SECRET=REPLACE_FROM_ENV_LOCAL
STRIPE_PRICE_STARTER_MONTHLY=REPLACE_FROM_ENV_LOCAL
STRIPE_PRICE_STARTER_YEARLY=REPLACE_FROM_ENV_LOCAL
STRIPE_PRICE_PRO_MONTHLY=REPLACE_FROM_ENV_LOCAL
STRIPE_PRICE_PRO_YEARLY=REPLACE_FROM_ENV_LOCAL
STRIPE_PRICE_UNLIMITED_MONTHLY=REPLACE_FROM_ENV_LOCAL
STRIPE_PRICE_UNLIMITED_YEARLY=REPLACE_FROM_ENV_LOCAL
STRIPE_PRICE_SECRET_MONTHLY=REPLACE_FROM_ENV_LOCAL
STRIPE_AUTOMATIC_TAX=false
STRIPE_AFFILIATE_COUPON_ID=REPLACE_FROM_ENV_LOCAL

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=REPLACE_FROM_ENV_LOCAL
CLOUDFLARE_API_TOKEN=REPLACE_FROM_ENV_LOCAL
CLOUDFLARE_ZONE_ID=REPLACE_FROM_ENV_LOCAL
CLOUDFLARE_KV_NAMESPACE_ID=REPLACE_FROM_ENV_LOCAL
CLOUDFLARE_WORKERS_TOKEN=REPLACE_FROM_ENV_LOCAL
CLOUDFLARE_R2_ENDPOINT=REPLACE_FROM_ENV_LOCAL
CLOUDFLARE_R2_BUCKET_NAME=REPLACE_FROM_ENV_LOCAL
CLOUDFLARE_R2_ACCESS_KEY_ID=REPLACE_FROM_ENV_LOCAL
CLOUDFLARE_R2_SECRET_ACCESS_KEY=REPLACE_FROM_ENV_LOCAL

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://blgxussxxziglevezzrk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_FROM_ENV_LOCAL
SUPABASE_SERVICE_ROLE_KEY=REPLACE_FROM_ENV_LOCAL
SUPABASE_DB_PASSWORD=REPLACE_FROM_ENV_LOCAL

# Resend (email)
RESEND_API_KEY=REPLACE_FROM_ENV_LOCAL
RESEND_FROM_EMAIL=REPLACE_FROM_ENV_LOCAL

# Admin
ADMIN_EMAIL=info@daniel-kurzeja.de
CRON_SECRET=REPLACE_FROM_ENV_LOCAL

# OpenAI
OPENAI_API_KEY=REPLACE_FROM_ENV_LOCAL
ENVEOF

echo "⚠️  IMPORTANT: Edit $APP_DIR/.env.production and fill in all REPLACE_FROM_ENV_LOCAL values!"
echo "   Then re-run this script with: bash $APP_DIR/docs/deploy-vps.sh --skip-env"

if [ "$1" = "--skip-env" ] || [ "$1" = "--run" ]; then
  # ---- Install npm dependencies ----
  echo "Installing npm dependencies..."
  cd "$APP_DIR"
  npm ci --legacy-peer-deps

  # ---- Build Next.js ----
  echo "Building Next.js app..."
  source "$APP_DIR/.env.production"
  npm run build

  # ---- Start/restart with PM2 ----
  echo "Starting app with PM2 on port $APP_PORT..."
  pm2 delete finestsites 2>/dev/null || true
  pm2 start "$APP_DIR/.next/standalone/server.js" \
    --name finestsites \
    --env production \
    -- --port $APP_PORT \
    2>/dev/null || \
  pm2 start "node $APP_DIR/.next/standalone/server.js" \
    --name finestsites \
    --env production

  pm2 env finestsites > /dev/null 2>&1 && true

  # Set env vars for the PM2 process
  PORT=$APP_PORT pm2 restart finestsites --update-env

  pm2 save
  pm2 startup 2>/dev/null || true

  echo ""
  echo "✅ FinestSites deployed on port $APP_PORT"
  echo "   Test: curl http://localhost:$APP_PORT/api/auth/ok"
fi
