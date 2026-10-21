# Notfall: Rücksprung und Backups (Stand 21.10.2026)

## 1. Fehlerhafter Deploy → zurück zur vorigen Version (Sekunden)

Das Deploy-Skript behält die vorige Version als `/var/www/finestsites/.next/standalone.prev`.
Schlägt der Smoke-Test nach einem Deploy zweimal fehl, springt es **automatisch** zurück.

Manuell (z. B. wenn ein Fehler erst später auffällt):

```bash
ssh -i ~/.ssh/finestsites_hetzner root@188.245.35.52 "/usr/local/bin/finestsites-rollback.sh"
```

- Ein zweiter Aufruf tauscht wieder zurück (umkehrbar).
- **Danach den fehlerhaften Commit in git rückgängig machen** (`git revert <commit>` + push),
  sonst wird er beim nächsten Deploy wieder ausgeliefert.
- Skripte im Repo: `deploy.sh` (= `/usr/local/bin/finestsites-deploy.sh`), `scripts/rollback.sh`
  (= `/usr/local/bin/finestsites-rollback.sh`). Alte Deploy-Version: `/usr/local/bin/finestsites-deploy.sh.bak-2026-10-21`.

## 2. Datenbank-Backups

| Was | Wo | Aufbewahrung |
|---|---|---|
| Stündlich (Minute 17) | DB-Server `/var/backups/finestsites/stuendlich/` | 48 Stunden |
| Täglich 03:00 | DB-Server `/var/backups/finestsites/backup-JJJJ-MM-TT.sql.gz` | 14 Tage |
| Verschlüsselt außer Haus | Cloudflare R2, privater Bucket `finestsites-backups` (`stuendlich/`, `taeglich/`) | 3 bzw. 30 Tage (Lifecycle-Regel) |
| Stand vor den Serverarbeiten | R2 `dauerhaft/vor-serverarbeiten-2026-10-21-1314.sql.gz.enc` | dauerhaft |

- Skript: `scripts/backup-db.sh` (= `/usr/local/bin/finestsites-backup.sh` auf dem DB-Server), Protokoll `/var/log/finestsites-backup.log`.
- Verschlüsselung: AES-256 (openssl, pbkdf2, 200.000 Runden). Schlüssel: `/root/.backup-passphrase` auf dem DB-Server
  **und** bei Daniel (`~/finestsites-backups/BACKUP-SCHLUESSEL.txt`, zusätzlich in den Passwort-Manager legen).
  Ohne diesen Schlüssel sind die R2-Backups nicht lesbar.
- R2-Zugang auf dem DB-Server: `/root/.r2-backup.env` (nur root lesbar).
- Wiederherstellung am 21.10.2026 erfolgreich getestet (R2 → entschlüsseln → Test-Datenbank, alle Zeilenzahlen identisch).

### Wiederherstellen (Beispiel aus R2)

```bash
# auf dem DB-Server
set -a; . /root/.r2-backup.env; set +a
curl -f --aws-sigv4 "aws:amz:auto:s3" --user "$CLOUDFLARE_R2_ACCESS_KEY_ID:$CLOUDFLARE_R2_SECRET_ACCESS_KEY" \
  "${CLOUDFLARE_R2_ENDPOINT%/}/finestsites-backups/stuendlich/DATEI.sql.gz.enc" -o /tmp/r.enc
sudo -u postgres createdb finestsites_restore            # NIE direkt über die Live-DB spielen
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:/root/.backup-passphrase -in /tmp/r.enc \
  | gunzip | sudo -u postgres psql -d finestsites_restore
# prüfen, dann gezielt Daten zurückholen oder (nur im Notfall, App vorher stoppen) Datenbanken tauschen
```

## 3. Komplette Server-Abbilder (Hetzner Snapshots)

- `finestsites-app vor Serverarbeiten 2026-10-21` (ID 446292027) und `finestsites-db vor Serverarbeiten 2026-10-21` (ID 446292028)
- Ältere: `… nach Umzug 2026-09-03`
- Wiederherstellen über die Hetzner-Konsole („Rebuild“ aus Snapshot) oder API. Achtung: setzt den ganzen Server auf den Stand zurück.

## 4. Sicherung auf Daniels Mac

`~/finestsites-backups/2026-10-21-vor-serverarbeiten/`: Datenbank-Export, Rollen, komplettes App-Verzeichnis
inkl. `.env.production`, laufender Build, Caddy, Cronjobs, Deploy-Skripte, Cloudflare-Worker, Routen und DNS.

## 5. Cronjobs

Kopien: `docs/server/crontab-app-server.txt` (CRON_SECRET entfernt), `docs/server/crontab-db-server.txt`.
