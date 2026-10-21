#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Startet den Next.js-Dev-Server gegen die lokale Test-DB `finestsites_dev`
# auf http://localhost:3077 – mit sauberer Umgebung.
#
#   scripts/local-testenv/start.sh            # Vordergrund (Strg+C beendet)
#   FS_SECRETS_FILE=/pfad/.env.local scripts/local-testenv/start.sh
#
# Sicherheit:
# - Startet mit `env -i` (nichts aus der eigenen Shell wird vererbt, z. B. ein
#   exportierter Cloudflare-Token).
# - Aus der Secrets-Datei werden NUR STRIPE_TEST_SECRET_KEY,
#   STRIPE_TEST_PUBLISHABLE_KEY und OPENAI_API_KEY gelesen (per grep, die
#   Datei wird nie ge-`source`-t).
# - Jede andere Variable, die in einer .env*-Datei des Projekts steht, wird
#   leer gesetzt – Next.js lädt .env.local sonst automatisch nach, und dort
#   stehen Live-Schlüssel.
# - Vor dem Start prüft ein Preflight mit Next.js' eigenem Env-Loader, dass
#   kein Live-Stripe-Key, kein Cloudflare-Token und keine fremde DB ankommt.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SECRETS_FILE="${FS_SECRETS_FILE:-/Users/kurzeja/new-finestsites/.env.local}"
PORT="${FS_DEV_PORT:-3077}"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

read_key() {
  # Liest genau einen Schlüssel KEY=wert (letzte Zeile gewinnt), entfernt Anführungszeichen.
  local key="$1"
  [[ -f "$SECRETS_FILE" ]] || { echo ""; return; }
  grep -E "^${key}=" "$SECRETS_FILE" | tail -n 1 | cut -d= -f2- | sed -E 's/^["'\'']//; s/["'\'']$//' || true
}

STRIPE_TEST_SK="$(read_key STRIPE_TEST_SECRET_KEY)"
STRIPE_TEST_PK="$(read_key STRIPE_TEST_PUBLISHABLE_KEY)"
OPENAI_KEY="$(read_key OPENAI_API_KEY)"

if [[ -n "$STRIPE_TEST_SK" && "$STRIPE_TEST_SK" != sk_test_* ]]; then
  echo "Abbruch: STRIPE_TEST_SECRET_KEY ist kein sk_test_-Schlüssel." >&2; exit 1
fi
if [[ -n "$STRIPE_TEST_PK" && "$STRIPE_TEST_PK" != pk_test_* ]]; then
  echo "Abbruch: STRIPE_TEST_PUBLISHABLE_KEY ist kein pk_test_-Schlüssel." >&2; exit 1
fi
[[ -n "$STRIPE_TEST_SK" ]] || echo "⚠ Kein STRIPE_TEST_SECRET_KEY gefunden – Stripe-Funktionen schlagen fehl."

if [[ ! -d "$PROJECT_DIR/node_modules" ]]; then
  echo "Abbruch: $PROJECT_DIR/node_modules fehlt. 'npm install' ausführen" >&2
  echo "  (oder in einem Worktree: ln -s /Users/kurzeja/new-finestsites/node_modules \"$PROJECT_DIR/node_modules\")" >&2
  exit 1
fi

if ! psql -X -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='finestsites_dev'" | grep -q 1; then
  echo "Abbruch: Datenbank finestsites_dev fehlt – zuerst scripts/local-testenv/setup.sh ausführen." >&2; exit 1
fi

# ─── Umgebung zusammenbauen ──────────────────────────────────────────────────
declare -a ENVV=(
  "PATH=$PATH"
  "HOME=${HOME:-/tmp}"
  "USER=${USER:-dev}"
  "LANG=${LANG:-de_DE.UTF-8}"
  "TMPDIR=${TMPDIR:-/tmp}"
  "TERM=${TERM:-xterm-256color}"
  "NEXT_TELEMETRY_DISABLED=1"
)

# Alle Werte aus der Vorlage übernehmen (Platzhalter <…> werden ersetzt)
declare -a OWN_KEYS=()
while IFS= read -r line; do
  [[ "$line" =~ ^[A-Z_][A-Z0-9_]*= ]] || continue
  k="${line%%=*}"; v="${line#*=}"
  case "$v" in
    "<STRIPE_TEST_SECRET_KEY>")      v="$STRIPE_TEST_SK" ;;
    "<STRIPE_TEST_PUBLISHABLE_KEY>") v="$STRIPE_TEST_PK" ;;
    "<OPENAI_API_KEY>")              v="$OPENAI_KEY" ;;
  esac
  ENVV+=("$k=$v"); OWN_KEYS+=("$k")
done < "$SCRIPT_DIR/env.local-test.example"
ENVV+=("PORT=$PORT")
OWN_KEYS+=("PORT")

# Jede weitere Variable aus .env*-Dateien des Projekts leer setzen
# (definiert-aber-leer verhindert, dass Next.js den Wert aus der Datei lädt)
shopt -s nullglob
for f in "$PROJECT_DIR"/.env "$PROJECT_DIR"/.env.*; do
  case "$f" in *.example) continue ;; esac
  [[ -f "$f" ]] || continue
  while IFS= read -r k; do
    skip=0
    for o in "${OWN_KEYS[@]}"; do [[ "$o" == "$k" ]] && { skip=1; break; }; done
    [[ $skip == 1 ]] && continue
    ENVV+=("$k="); OWN_KEYS+=("$k")
  done < <(grep -oE '^(export +)?[A-Za-z_][A-Za-z0-9_]*=' "$f" | sed -E 's/^export +//; s/=$//' | sort -u)
done
shopt -u nullglob

# ─── Preflight mit Next.js' eigenem Env-Loader ───────────────────────────────
env -i "${ENVV[@]}" node -e '
  const { loadEnvConfig } = require(require.resolve("@next/env", { paths: [process.argv[1]] }));
  loadEnvConfig(process.argv[1], true, { info() {}, error: console.error });
  const e = process.env, bad = [];
  if (/^(sk|rk)_live_/.test(e.STRIPE_SECRET_KEY || "")) bad.push("STRIPE_SECRET_KEY ist LIVE");
  if (/^pk_live_/.test(e.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")) bad.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ist LIVE");
  if (e.FS_ENV !== "local") bad.push("FS_ENV ist nicht local");
  if (!/@localhost:\d+\/finestsites_dev$/.test(e.DATABASE_URL || "")) bad.push("DATABASE_URL zeigt nicht auf localhost/finestsites_dev");
  for (const k of ["CLOUDFLARE_API_TOKEN","CLOUDFLARE_WORKERS_TOKEN","CLOUDFLARE_KV_TOKEN","CLOUDFLARE_FINESTSITES_TOKEN","CLOUDFLARE_FINESTSITES_DNS_TOKEN","HETZNER_API_TOKEN","MAILGUN_API_KEY","SUPABASE_SERVICE_ROLE_KEY","EXPO_TOKEN"])
    if (e[k]) bad.push(k + " ist gesetzt");
  if (e.RESEND_API_KEY !== "re_invalid_local_only") bad.push("RESEND_API_KEY ist nicht der ungültige Dummy");
  if (!/^local-/.test(e.WORKER_SECRET || "")) bad.push("WORKER_SECRET ist nicht der Dummy");
  if (bad.length) { console.error("Preflight FEHLGESCHLAGEN:\n - " + bad.join("\n - ")); process.exit(1); }
  console.log("Preflight OK: Stripe " + ((e.STRIPE_SECRET_KEY||"").slice(0,8) || "(leer)") + "…, DB finestsites_dev, keine Produktions-Tokens.");
' "$PROJECT_DIR"

echo "▶ Starte Next.js auf http://localhost:$PORT  (DB finestsites_dev, FS_ENV=local)"
cd "$PROJECT_DIR"
exec env -i "${ENVV[@]}" ./node_modules/.bin/next dev -p "$PORT"
