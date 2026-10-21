#!/bin/bash
# FinestSites Datenbank-Backup — läuft auf dem Hetzner DB-Server (142.132.174.86).
# Installiert als /usr/local/bin/finestsites-backup.sh
#
#   finestsites-backup.sh            täglich (Crontab 03:00): /var/backups/finestsites/backup-JJJJ-MM-TT.sql.gz, 14 Tage lokal
#   finestsites-backup.sh stuendlich stündlich:               /var/backups/finestsites/stuendlich/…, 48 Stunden lokal
#
# Jedes Backup wird zusätzlich verschlüsselt (AES-256, Schlüssel /root/.backup-passphrase) in den
# privaten Cloudflare-R2-Bucket finestsites-backups geladen (täglich/ und stuendlich/; Aufbewahrung
# dort per Lifecycle-Regel). Ein fehlgeschlagener Upload verhindert nie das lokale Backup.
#
# Wiederherstellen aus R2 (Schlüssel liegt auch in Daniels Sicherungsordner):
#   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:/root/.backup-passphrase -in DATEI.sql.gz.enc | gunzip | psql …
set -uo pipefail

MODE=${1:-taeglich}
BASE=/var/backups/finestsites
LOG=/var/log/finestsites-backup.log
STAMP=$(date +%Y-%m-%d-%H%M)
log() { echo "[$(date "+%F %T")] $*" >> "$LOG"; }

if [ "$MODE" = "stuendlich" ]; then
  DIR="$BASE/stuendlich"; FILE="$DIR/backup-$STAMP.sql.gz"; PREFIX=stuendlich; KEEP_MIN=$((48*60))
else
  DIR="$BASE"; FILE="$DIR/backup-$(date +%Y-%m-%d).sql.gz"; PREFIX=taeglich; KEEP_MIN=$((14*24*60))
fi
mkdir -p "$DIR"

log "Start ($MODE)..."
if ! sudo -u postgres pg_dump -d finestsites --no-owner --no-acl | gzip > "$FILE.tmp"; then
  log "FEHLER: pg_dump fehlgeschlagen ($MODE)"; rm -f "$FILE.tmp"; exit 1
fi
mv "$FILE.tmp" "$FILE"
log "Backup lokal: $FILE ($(du -sh "$FILE" | cut -f1))"

# Lokal aufräumen (nur Backup-Dateien dieses Modus)
if [ "$MODE" = "stuendlich" ]; then
  find "$DIR" -name "backup-*.sql.gz" -mmin +$KEEP_MIN -delete
else
  find "$DIR" -maxdepth 1 -name "backup-*.sql.gz" -mmin +$KEEP_MIN -delete
fi

# Verschlüsselt außer Haus (Cloudflare R2). Fehler hier brechen nichts ab.
if [ -f /root/.r2-backup.env ] && [ -f /root/.backup-passphrase ]; then
  set -a; . /root/.r2-backup.env; set +a
  ENC="/tmp/$(basename "$FILE").enc"
  if openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass file:/root/.backup-passphrase -in "$FILE" -out "$ENC"; then
    URL="${CLOUDFLARE_R2_ENDPOINT%/}/${R2_BUCKET}/${PREFIX}/$(basename "$ENC")"
    CODE=$(curl -s -o /tmp/r2-upload.out -w "%{http_code}" --max-time 120 \
      --aws-sigv4 "aws:amz:auto:s3" --user "${CLOUDFLARE_R2_ACCESS_KEY_ID}:${CLOUDFLARE_R2_SECRET_ACCESS_KEY}" \
      -H "Content-Type: application/octet-stream" --upload-file "$ENC" "$URL")
    if [ "$CODE" = "200" ]; then log "Upload R2 ok: ${PREFIX}/$(basename "$ENC")"; else log "FEHLER: Upload R2 HTTP $CODE: $(head -c 300 /tmp/r2-upload.out)"; fi
  else
    log "FEHLER: Verschlüsselung fehlgeschlagen"
  fi
  rm -f "$ENC" /tmp/r2-upload.out
else
  log "Hinweis: kein R2-Upload (Zugangsdaten oder Schlüssel fehlen)"
fi
log "Fertig ($MODE)"
