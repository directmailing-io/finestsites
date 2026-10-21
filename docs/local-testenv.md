# Lokale Testumgebung

Mit der lokalen Testumgebung lassen sich Änderungen an Backend und App auf dem Mac testen, ohne die Produktion zu berühren. Sie besteht aus:

- **`finestsites_dev`**: eine lokale PostgreSQL-Datenbank (Homebrew, localhost:5432). Sie wird aus einem Produktions-Dump gebaut, **anonymisiert** und um Testkonten ergänzt.
- **Next.js-Dev-Server** auf **http://localhost:3077**. Er läuft mit eigener, sauberer Umgebung: Stripe nur im Testmodus, keine Mails, keine Cloudflare-Tokens.

## Sicherheitsregeln (verbindlich)

1. **Kein Zugriff auf Produktionsserver.** Die Skripte nutzen kein SSH und verbinden sich nur mit `localhost`. Nie gegen 188.245.35.52 oder 142.132.174.86 laufen lassen.
2. **Nur Stripe-Testschlüssel.** `start.sh` liest aus `/Users/kurzeja/new-finestsites/.env.local` ausschließlich `STRIPE_TEST_SECRET_KEY`, `STRIPE_TEST_PUBLISHABLE_KEY` und `OPENAI_API_KEY`. Die Datei wird dabei nur per `grep` gelesen, nie per `source`. Ein Schlüssel, der nicht mit `sk_test_`/`pk_test_` beginnt, bricht den Start ab.
3. **Keine Mails.** `RESEND_API_KEY=re_invalid_local_only`, also scheitert jeder Versand bei Resend. Push-Benachrichtigungen gibt es lokal nicht (`EXPO_TOKEN` ist leer).
4. **Kein Cloudflare.** Alle CF-Tokens sind leer, `WORKER_SECRET`/`CRON_SECRET` sind Dummys, R2 zeigt auf `http://127.0.0.1:9`. Dadurch sind KV, R2, DNS und Custom Hostnames der Produktion unerreichbar.
5. **Next.js lädt `.env.local` automatisch.** `start.sh` setzt deshalb jede Variable aus `.env*`-Dateien des Projekts leer, sofern sie nicht in `env.local-test.example` steht. Ein leer gesetzter Wert hat Vorrang vor der Datei. Danach prüft ein Preflight mit Next.js' eigenem Env-Loader: kein Live-Key, `FS_ENV=local`, DB = `localhost/finestsites_dev`, keine Produktions-Tokens. Schlägt der Preflight fehl, startet nichts.
6. **Die Daten sind anonymisiert, bleiben aber vertraulich.** Struktur, Mengen, Benutzernamen und Template-Inhalte stammen aus der Produktion. Die DB nicht weitergeben und nicht in Screenshots für Dritte zeigen.
7. `setup.sh` löscht und erstellt **nur** die Datenbank `finestsites_dev`. Andere lokale Datenbanken (`finestsites`, `fs_t_*`, `videocomet` …) bleiben unberührt.

## Benutzung

```bash
# 1. Datenbank bauen (ca. 1 Minute; beliebig oft wiederholbar = frischer Stand)
scripts/local-testenv/setup.sh
#    anderer Dump:  scripts/local-testenv/setup.sh /pfad/zum/dump.sql.gz

# 2. Dev-Server starten (Strg+C beendet)
scripts/local-testenv/start.sh
#    → http://localhost:3077/login
```

Ohne Angabe nimmt `setup.sh` den Dump `/Users/kurzeja/finestsites-backups/2026-10-21-vor-serverarbeiten/manuell-20261021-131457.sql.gz`.

In einem Git-Worktree fehlt `node_modules`. Dann einmalig verlinken:

```bash
ln -s /Users/kurzeja/new-finestsites/node_modules node_modules
```

DB-Zugang für psql/Drizzle: `postgresql://finestsites_dev:finestsites_dev_local@localhost:5432/finestsites_dev`

### Was `setup.sh` tut

1. Legt die Rolle `finestsites_dev` an (Passwort `finestsites_dev_local`), falls sie fehlt.
2. Löscht `finestsites_dev`, legt sie neu an und spielt den Dump ein.
3. Führt `anonymize.sql` aus.
4. Führt `seed-test-accounts.sql` aus (Testkonten).
5. Vergibt die Rechte.
6. Führt `verify-anonymized.sql` aus. Das Skript durchsucht **jede** Text-/JSON-Spalte nach echten E-Mail-Adressen und Stripe-IDs und prüft Sitzungen und Passwort-Hashes. Bei einem Befund bricht es ab.

## Testkonten

Alle Konten haben das Passwort **`Test1234!`**, eine bestätigte E-Mail, einen Benutzernamen und ein erteiltes Inhalts-Einverständnis.

| E-Mail | Benutzername | Zustand |
|---|---|---|
| `qa-free@example.invalid` | qafree | ohne Tarif (kostenlos), 1 Entwurf (Linkseite) |
| `qa-starter@example.invalid` | qastarter | Starter aktiv, **Limit erreicht** (1 veröffentlicht + 1 Entwurf), geworben von qapartner |
| `qa-pro@example.invalid` | qapro | Pro aktiv, 2 veröffentlichte Seiten (Optimalset + Business), 4 Anfragen (1 Spam), offener Support-Chat |
| `qa-grace@example.invalid` | qagrace | Pro, Zahlung vor 3 Tagen fehlgeschlagen (`past_due`), Schonfrist noch 4 Tage |
| `qa-partner@example.invalid` | qapartner | Partner: Steuerprofil (regelbesteuert), Provisionen pending/available/paid, Gutschrift `GS-2026-90001` |
| `appreview@example.invalid` | appreview | Demokonto „App Review“: Pro aktiv, Optimalset + Vitalprofil veröffentlicht |
| `admin@example.invalid` | demo | Admin (`is_admin`, entspricht `ADMIN_EMAIL` lokal) |
| `user<n>@example.invalid` | (echte Benutzernamen) | anonymisierte Bestandskunden, ebenfalls mit `Test1234!` |

Die Stripe-IDs der Testkonten (`test_cus_qa_…`) gibt es bei Stripe nicht. Rechnungs- und Portal-Aufrufe enden deshalb mit „No such customer“. Für echte Checkout-Tests im Testmodus müssen Test-Preise angelegt und als `STRIPE_PRICE_*` gesetzt werden (siehe `env.local-test.example`).

## Was anonymisiert wird

- **users**: E-Mail → `user<n>@example.invalid` (Admin → `admin@example.invalid`). Namen, Telefon, Firma, Social-Profile und Teampartner-Nummer werden ersetzt. Profilbilder werden entfernt. Stripe-Kunde/Abo/Connect/Rechnung → `test_…`. Zahlungs-Fingerprints, Consent-IP/UA und Auszahlungs-E-Mail werden ebenfalls ersetzt. **Benutzernamen bleiben** (öffentliche Seitennamen).
- **accounts**: Alle Passwörter → Hash von `Test1234!`. OAuth-Tokens werden geleert.
- **sessions, verifications, impersonation_requests**: gelöscht.
- **site_data / user_sites.published_data**: Namen, Kontakt-, Impressums- und Adressfelder, Partnernummern (auch in Shop-/Registrierungs-Links), Social-Links und Fotos werden ersetzt. Freitexte („Über mich“, Intro, Zitate, Übersetzungen) → Beispieltext. Eigene Domains → `kunde<n>.example.invalid` (auch in `site_events`).
- **form_submissions**: Name, E-Mail, Telefon und Freitext werden ersetzt. Auswahl-/Score-Werte bleiben.
- **support_***: Nachrichten, Betreff und KI-Vorschläge → neutraler Text. Bild-Anhänge werden entfernt.
- **email_logs**: Empfänger, Resend-ID und Namen im Betreff werden ersetzt.
- **newsletter_sends, waitlist, waitlist_broadcasts, testimonials, tracking_configs, affiliate_tax_profiles, affiliate_payouts, affiliate_commissions, subscription_events**: Personen-, Steuer-, Stripe- und Tracking-Daten werden ersetzt.

## Stripe-Schlüssel-Wächter (Vorschlag)

`src/lib/security/stripe-key-guard.ts` exportiert `assertStripeKeyAllowed()`. Die Funktion wirft, wenn `FS_ENV` auf `local` oder `staging` steht **und** ein `sk_live_`/`rk_live_`/`pk_live_`-Schlüssel gesetzt ist. Ohne `FS_ENV` (so läuft die Produktion heute) tut sie nichts. Sie ist **noch nirgends eingebunden**. Prüfung:

```bash
npx tsx scripts/local-testenv/check-stripe-key-guard.ts
```

## Dateien

- `scripts/local-testenv/setup.sh`: DB bauen
- `scripts/local-testenv/anonymize.sql`: Anonymisierung
- `scripts/local-testenv/seed-test-accounts.sql`: Testkonten
- `scripts/local-testenv/verify-anonymized.sql`: Kontrolle auf Restdaten
- `scripts/local-testenv/start.sh`: Dev-Server mit sauberer Umgebung
- `scripts/local-testenv/env.local-test.example`: dokumentierte Variablen
- `scripts/local-testenv/hash-password.mjs`: BetterAuth-Hash für ein anderes Testpasswort erzeugen
- `scripts/local-testenv/check-stripe-key-guard.ts`: Prüfung des Wächters
