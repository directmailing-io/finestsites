#!/bin/bash
# FinestSites Rücksprung auf die vorige Version — läuft auf dem Hetzner App-Server.
# Installiert als /usr/local/bin/finestsites-rollback.sh
#
# Tauscht .next/standalone und .next/standalone.prev und macht ein PM2 Rolling-Reload.
# Ein zweiter Aufruf tauscht wieder zurück (Rücksprung ist umkehrbar).
# Wichtig: Der fehlerhafte Commit bleibt in git. Vor dem nächsten Deploy rückgängig machen
# (git revert), sonst wird er wieder ausgeliefert.
set -e

APP_DIR=/var/www/finestsites
CUR="${APP_DIR}/.next/standalone"
PREV="${APP_DIR}/.next/standalone.prev"
TMP="${APP_DIR}/.next/standalone.swap"

if [ ! -d "$PREV" ]; then
  echo "✗ Keine vorige Version vorhanden ($PREV fehlt). Nichts geändert."
  exit 1
fi

echo "▶ Rücksprung: aktuelle Version ↔ vorige Version tauschen..."
rm -rf "$TMP"
mv "$CUR" "$TMP"
mv "$PREV" "$CUR"
mv "$TMP" "$PREV"
chown -R finestsites:finestsites "$CUR"

echo "▶ Rolling Reload..."
/usr/local/bin/finestsites-pm2 reload finestsites --update-env

echo "✅ Rücksprung abgeschlossen. Die zuletzt ausgelieferte Version liegt jetzt als standalone.prev."
if [ "${1:-}" != "--automatisch" ]; then
  sleep 3
  bash "$APP_DIR/scripts/smoke-test.sh" || echo "⚠️  Auch nach dem Rücksprung schlägt der Smoke-Test fehl – Ursache liegt vermutlich nicht im Code (Cloudflare, DB, Worker)."
fi
