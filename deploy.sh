#!/bin/bash
# FinestSites Deploy-Script — läuft auf dem Hetzner App-Server (188.245.35.52)
# Installiert als /usr/local/bin/finestsites-deploy.sh
#
# Ablauf vom Mac aus:
#   git push origin main
#   ssh -i ~/.ssh/finestsites_hetzner root@188.245.35.52 "/usr/local/bin/finestsites-deploy.sh"
#
# Baut in /tmp, tauscht das standalone-Verzeichnis atomisch und macht ein
# PM2 Rolling-Reload (2 Cluster-Instanzen → kein Ausfall). PM2 läuft als Nutzer "finestsites":
#   Status/Logs auf dem Server: /usr/local/bin/finestsites-pm2 list | logs finestsites
# Installiert KEINE Dependencies — bei neuen Paketen vorher auf dem Server:
#   cd /var/www/finestsites && npm install --no-audit --no-fund
set -e

APP_DIR=/var/www/finestsites
BUILD_DIR=/tmp/fs-build-$(date +%s)

echo "▶ [1/5] Code aktualisieren..."
cd "$APP_DIR" && git pull origin main
# .env.production ist die EINZIGE Quelle für Einstellungen. Vor Build und Reload laden, damit
# Variablen aus der aufrufenden Shell (z. B. ein für wrangler exportierter CLOUDFLARE_API_TOKEN)
# nicht per --update-env in die laufende App wandern. (Vorfall 04./05.10.2026: falscher
# Cloudflare-Schlüssel in der App -> eigene Kunden-Domains ließen sich nicht verbinden.)
set -a; . "$APP_DIR/.env.production"; set +a

echo "▶ [2/5] Build-Verzeichnis vorbereiten (live-Seite läuft weiter)..."
mkdir -p "$BUILD_DIR"
rsync -a --exclude='.next' --exclude='node_modules' "$APP_DIR/" "$BUILD_DIR/"
ln -s "$APP_DIR/node_modules" "$BUILD_DIR/node_modules"

echo "▶ [2b] Render-Check aller Templates (Richtext roh, Text escaped)..."
npx tsx scripts/check-template-render.ts
echo "▶ [3/5] Build starten..."
cd "$BUILD_DIR"
NEXT_TELEMETRY_DISABLED=1 npm run build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

echo "▶ [4/5] Atomischer Swap..."
BACKUP="${APP_DIR}/.next/standalone.prev"
[ -d "$BACKUP" ] && rm -rf "$BACKUP"
mv "${APP_DIR}/.next/standalone" "$BACKUP"
mv "${BUILD_DIR}/.next/standalone" "${APP_DIR}/.next/standalone"

echo "▶ [5/5] Rolling Reload (kein Ausfall)..."
# Die App läuft seit 08.10.2026 unter dem Systemnutzer "finestsites" (nicht root). Der Build hier
# passiert als root, danach gehört das standalone-Verzeichnis dem Nutzer (Bild-Cache muss schreibbar
# sein). Reload über den Wrapper, der .env.production als root lädt und dann zum Nutzer wechselt.
chown -R finestsites:finestsites "${APP_DIR}/.next/standalone"
/usr/local/bin/finestsites-pm2 reload finestsites --update-env

echo "▶ Aufräumen..."
rm -rf "$BUILD_DIR" "$BACKUP"

echo "✅ Deploy abgeschlossen. Keine Ausfallzeit."
# Nach dem Reload: zentrale Pfade von außen prüfen (Login, Vorschau-Endpunkte, Demo-Seiten, Schutz)
sleep 3
bash "$APP_DIR/scripts/smoke-test.sh" || true
