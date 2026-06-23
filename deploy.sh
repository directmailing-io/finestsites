#!/bin/bash
# Deploy script for FinestSites on Hostinger VPS
# Usage: ./deploy.sh  (run from local machine after git push)
# Or: run directly on VPS after git pull

set -e

APP_DIR="${APP_DIR:-/var/www/finestsites}"
cd "$APP_DIR"

echo "→ Pulling latest code..."
git pull origin main

echo "→ Installing dependencies..."
npm ci --legacy-peer-deps

echo "→ Building..."
npm run build

echo "→ Copying static assets to standalone output..."
# Next.js standalone output requires manual copy of public/ and .next/static/
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

echo "→ Restarting PM2..."
pm2 restart finestsites --update-env

echo "✓ Deployed successfully"
pm2 list | grep finestsites
