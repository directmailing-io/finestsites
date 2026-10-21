#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Lokale Testumgebung: baut die Datenbank `finestsites_dev` aus einem
# Produktions-Dump neu auf, anonymisiert sie und legt Testkonten an.
#
#   scripts/local-testenv/setup.sh [pfad/zum/dump.sql.gz]
#
# - Läuft NUR gegen den lokalen PostgreSQL (Homebrew, localhost:5432).
# - Löscht/erstellt ausschließlich die Datenbank `finestsites_dev`.
# - Rolle `finestsites_dev` (Passwort `finestsites_dev_local`) wird bei
#   Bedarf angelegt; sie besitzt alle Objekte der Datenbank.
# - Kein SSH, kein Zugriff auf Produktionsserver.
# Idempotent: kann beliebig oft laufen, jedes Mal frischer Stand.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_DUMP="/Users/kurzeja/finestsites-backups/2026-10-21-vor-serverarbeiten/manuell-20261021-131457.sql.gz"
DUMP="${1:-${FS_DEV_DUMP:-$DEFAULT_DUMP}}"

DB_NAME="finestsites_dev"
DB_ROLE="finestsites_dev"
DB_PASS="finestsites_dev_local"
PGHOST_LOCAL="localhost"
PGPORT_LOCAL="${FS_DEV_PGPORT:-5432}"

export PATH="/opt/homebrew/bin:/opt/homebrew/opt/postgresql@18/bin:$PATH"

# Sicherheitsnetz: niemals gegen einen entfernten Host arbeiten.
unset PGHOST PGHOSTADDR PGSERVICE DATABASE_URL || true

if [[ "$DB_NAME" != "finestsites_dev" ]]; then
  echo "Abbruch: Skript darf nur finestsites_dev anfassen." >&2; exit 1
fi
if [[ ! -f "$DUMP" ]]; then
  echo "Dump nicht gefunden: $DUMP" >&2; exit 1
fi

# Superuser-Verbindung (lokaler Homebrew-Nutzer, Socket)
SU_PSQL=(psql -X -q -v ON_ERROR_STOP=1 -p "$PGPORT_LOCAL" -d postgres)
DEV_PSQL=(env PGPASSWORD="$DB_PASS" psql -X -q -v ON_ERROR_STOP=1 -h "$PGHOST_LOCAL" -p "$PGPORT_LOCAL" -U "$DB_ROLE" -d "$DB_NAME")

echo "▶ Rolle $DB_ROLE sicherstellen"
ROLE_EXISTS="$("${SU_PSQL[@]}" -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_ROLE'")"
if [[ "$ROLE_EXISTS" != "1" ]]; then
  "${SU_PSQL[@]}" -c "CREATE ROLE $DB_ROLE LOGIN PASSWORD '$DB_PASS' NOSUPERUSER NOCREATEDB NOCREATEROLE"
else
  "${SU_PSQL[@]}" -c "ALTER ROLE $DB_ROLE LOGIN PASSWORD '$DB_PASS'"
fi

echo "▶ Datenbank $DB_NAME neu anlegen"
"${SU_PSQL[@]}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid()" > /dev/null
dropdb -p "$PGPORT_LOCAL" --if-exists "$DB_NAME"
createdb -p "$PGPORT_LOCAL" -O "$DB_ROLE" "$DB_NAME"

echo "▶ Dump einspielen: $DUMP"
if [[ "$DUMP" == *.gz ]]; then
  gzip -dc "$DUMP" | "${DEV_PSQL[@]}" > /dev/null
else
  "${DEV_PSQL[@]}" -f "$DUMP" > /dev/null
fi

if [[ "${FS_DEV_SKIP_ANON:-0}" == "1" ]]; then
  echo "⚠ FS_DEV_SKIP_ANON=1 – Anonymisierung übersprungen (nur zur Analyse!)"
  exit 0
fi

echo "▶ Anonymisieren"
"${DEV_PSQL[@]}" -f "$SCRIPT_DIR/anonymize.sql"

echo "▶ Testkonten anlegen"
"${DEV_PSQL[@]}" -f "$SCRIPT_DIR/seed-test-accounts.sql"

echo "▶ Rechte vergeben"
"${DEV_PSQL[@]}" -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO $DB_ROLE; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO $DB_ROLE;"

echo "▶ Prüfung auf verbliebene echte Daten"
"${DEV_PSQL[@]}" -f "$SCRIPT_DIR/verify-anonymized.sql"

echo
echo "✔ finestsites_dev ist bereit."
echo "  DATABASE_URL=postgresql://$DB_ROLE:$DB_PASS@localhost:$PGPORT_LOCAL/$DB_NAME"
echo "  Start: scripts/local-testenv/start.sh   (Port 3077)"
