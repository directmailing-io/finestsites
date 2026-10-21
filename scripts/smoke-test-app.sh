#!/bin/bash
# VORSCHLAG (noch nicht im Deploy): Smoke-Test der App-Schnittstellen nach dem Deploy.
# Nur lesende/anonyme Anfragen – keine Anmeldung, keine Schreibzugriffe, kein Push.
# Aufruf: bash scripts/smoke-test-app.sh   (Exit 1 bei Fehlern)
# Später in scripts/smoke-test.sh übernehmen, wenn die App-Routen live sind.
set -u
APP=${APP_URL:-https://app.finestsites.io}
fail=0
check() { # check <erwartet> <beschreibung> <methode> <url> [muss-enthalten] [header...]
  local want=$1 desc=$2 method=$3 url=$4 pat=${5:-}
  shift 5 2>/dev/null || shift $#
  local hdrs=(-H "X-Smoke: 1")
  for h in "$@"; do hdrs+=(-H "$h"); done
  local body; body=$(curl -s -m 25 -X "$method" -A "FinestSites-SmokeTest" "${hdrs[@]}" -w "\n__CODE__%{http_code}" "$url")
  local code=${body##*__CODE__}; body=${body%__CODE__*}
  if [ "$code" != "$want" ]; then echo "  ✗ $desc → $code (erwartet $want)"; fail=1; return; fi
  if [ -n "$pat" ] && ! grep -q -- "$pat" <<<"$body"; then echo "  ✗ $desc → $code, aber „${pat}“ fehlt"; fail=1; return; fi
  echo "  ✓ $desc"
}
echo "▶ Smoke-Test App-Schnittstellen"
check 200 "App-Config öffentlich"            GET  "$APP/api/app/v1/config" '"apiVersion":1'
check 401 "App /me ohne Anmeldung"           GET  "$APP/api/app/v1/me" '"code":"UNAUTHORIZED"' "X-FS-Client: ios"
check 401 "App /overview ohne Anmeldung"     GET  "$APP/api/app/v1/overview" '"code":"UNAUTHORIZED"' "X-FS-Client: ios"
check 401 "App Partner ohne Anmeldung"       GET  "$APP/api/app/v1/affiliate" '"code":"UNAUTHORIZED"' "X-FS-Client: ios"
check 403 "Kauf-Sperre App (checkout)"       POST "$APP/api/billing/checkout" '"code":"APP_PURCHASE_DISABLED"' "X-FS-Client: ios"
check 403 "Kauf-Sperre App (subscription)"   GET  "$APP/api/billing/subscription" '"code":"APP_PURCHASE_DISABLED"' "X-FS-Client: ios"
check 401 "Browser-Kaufroute unverändert"    GET  "$APP/api/billing/subscription" '"Unauthorized"'
check 400 "Editor-Übergabe ohne Schlüssel"   GET  "$APP/api/app/v1/editor-handoff?ott=x" 'abgelaufen'
check 302 "Connect-Rückweg ohne State"       GET  "$APP/api/app/v1/affiliate/connect/return" ''
check 401 "Cron push-drain ohne Secret"      GET  "$APP/api/cron/push-drain" ''
check 401 "Cron push-receipts ohne Secret"   GET  "$APP/api/cron/push-receipts" ''
check 200 "Web-Session anonym (null)"        GET  "$APP/api/auth/get-session" 'null'
if [ $fail -ne 0 ]; then echo "⚠️  SMOKE-TEST APP FEHLGESCHLAGEN"; exit 1; fi
echo "✅ Smoke-Test App ok"
