#!/bin/bash
# Smoke-Test nach dem Deploy: die wichtigsten öffentlichen Pfade müssen antworten.
# Aufruf: bash scripts/smoke-test.sh   (Exit 1 bei Fehlern – der Deploy ist dann schon durch,
# aber die Ausgabe zeigt sofort, was kaputt ist.)
set -u
APP=${APP_URL:-https://app.finestsites.io}
fail=0
check() { # check <erwartet> <beschreibung> <url> [muss-enthalten] [darf-nicht-enthalten]
  local want=$1 desc=$2 url=$3 pat=${4:-} nopat=${5:-}
  local body; body=$(curl -s -m 25 -A "FinestSites-SmokeTest" -w "\n__CODE__%{http_code}" "$url")
  local code=${body##*__CODE__}; body=${body%__CODE__*}
  if [ "$code" != "$want" ]; then echo "  ✗ $desc → $code (erwartet $want)"; fail=1; return; fi
  if [ -n "$pat" ] && ! grep -q -- "$pat" <<<"$body"; then echo "  ✗ $desc → $code, aber „${pat}“ fehlt"; fail=1; return; fi
  if [ -n "$nopat" ] && grep -q -- "$nopat" <<<"$body"; then echo "  ✗ $desc → $code, enthält aber „${nopat}“ (Richtext escaped?)"; fail=1; return; fi
  echo "  ✓ $desc"
}
echo "▶ Smoke-Test"
check 200 "App Login" "$APP/login"
check 200 "Marketing Startseite" "https://finestsites.io/"
check 200 "Vorschau lnko"        "$APP/api/templates/21c773ae-5ecd-418e-a9b9-a978a7bdbd98/public-preview" "<html"
check 200 "Vorschau Business"    "$APP/api/templates/fbcf2022-2036-424a-93de-5878c5fa5b6d/public-preview" "<html"
check 200 "Vorschau cellRESET"   "$APP/api/templates/b1d028a9-b4be-4d87-9178-9a92ebb2fb83/public-preview" "<html"
check 200 "Vorschau Dailyoptimal" "$APP/api/templates/5df9aab8-d32f-45eb-bc36-f4debc7819d2/public-preview" "<html"
check 200 "Demo lnko"            "https://demo.lnko.me/" '<html' '&lt;p&gt;'
check 200 "Kundenseite lnko (Richtext roh)" "https://loewenduo.lnko.me/" 'class="bio"><p>' '&lt;p&gt;'
check 200 "Demo Business (Richtext roh)" "https://demo.wellpreneur.io/" 'about-me-richtext l-de"><p>' '&lt;p&gt;'
check 200 "Demo cellRESET"       "https://demo.cellrestart.net/" "<html"
check 200 "Kundenseite (Custom Domain)" "https://business.loewenduo.com/" "<html"
check 404 "Scanner-Pfad Kundenseite" "https://demo.lnko.me/.git/config"
check 401 "Cron ohne Secret"     "$APP/api/cron/check-domains"
check 401 "Worker-API ohne Secret" "$APP/api/worker/site-data?siteId=x"
if [ $fail -ne 0 ]; then echo "⚠️  SMOKE-TEST FEHLGESCHLAGEN – bitte sofort prüfen (ggf. vorherigen Commit deployen)."; exit 1; fi
echo "✅ Smoke-Test ok"
