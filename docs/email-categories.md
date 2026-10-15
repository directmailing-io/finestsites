# E-Mail-Kategorien und Abbestellen (seit 15.10.2026)

Jede Mail, die FinestSites verschickt, gehört zu genau einer Kategorie. Nutzer können in den
Einstellungen (`/settings?tab=mails`) alle Kategorien außer „Konto und Zahlung“ abbestellen.
Von Anfang an ist alles erlaubt. Der Versand prüft das zentral, nicht die einzelne Stelle.

| Schlüssel | Name für Nutzer        | Inhalt                                                     | abbestellbar |
|-----------|------------------------|------------------------------------------------------------|--------------|
| `system`  | Konto und Zahlung      | Rechnung, Zahlung, Passwort, Abo, Seite offline, Domain    | nein         |
| `updates` | Neues bei FinestSites  | neue Vorlagen, neue Funktionen, Verbesserungen             | ja           |
| `tips`    | Tipps und Anleitungen  | Anleitungen, Ideen für mehr Besucher                       | ja           |
| `offers`  | Angebote und Aktionen  | Rabatte, Kampagnen, Erinnerungen vor Aktionsende           | ja           |

Definition: `src/lib/email/categories.ts` (Client-sicher). Neue Kategorie = dort ein Eintrag,
alles andere (Einstellungen, Admin, Newsletter, Footer) liest die Liste.

## Daten

- `users.email_opt_out text[]` = abbestellte Kategorien, leer = alles erlaubt; `email_opt_out_updated_at`.
- `email_logs.category`, `email_logs.status` kennt `skipped` (Kategorie abbestellt, absichtlich nicht gesendet).
- `newsletter_sends.category`, `newsletter_sends.skipped`.
- Migration: `supabase/migrations/20261015100000_email_preferences.sql`.

## Versandwege (nur diese benutzen)

1. **Einzelmail aus der App**: `sendEmail({ to, subject, html, type, category })` in `src/lib/resend.ts`.
   Ohne `category` gilt `EMAIL_TYPE_CATEGORY[type]`, sonst `system`. Bei abbestellbaren Kategorien
   prüft `sendEmail` den Nutzer, überspringt (Log `skipped`) und setzt sonst List-Unsubscribe-Header.
2. **Mail an viele**: `sendCategoryMail()` in `src/lib/email/bulk.ts`. Filtert Opt-outs, baut den
   Footer mit „Diese Mails abbestellen“ + „E-Mail-Einstellungen“, sendet in 100er-Paketen, loggt alles.
   - Admin-Oberfläche `/admin/newsletter`: Kategorie ist Pflicht, Empfängerzahl zeigt Abbestellte.
   - Kommandozeile auf dem App-Server:
     `node --env-file=.env.production --import tsx scripts/send-category-mail.ts --category updates --subject "…" --body-file mail.md [--send] [--segment with-sub|without-sub] [--to adresse]`
     Ohne `--send` nur Trockenlauf (zählt, zeigt Abbestellte, sendet nichts).

Ältere Einzelskripte (`send-vitalcheck-launch-mail.ts`, `send-partner-contacts-mail.ts`, `newsletter-samstag-*.ts`)
rufen Resend direkt auf und kennen die Opt-outs NICHT. Nicht wiederverwenden, stattdessen `send-category-mail.ts`.

## Abbestellen aus der Mail

`GET /api/email/unsubscribe?u=<userId>&c=<kategorie>&t=<hmac>` (Link im Footer, kein Login nötig,
HMAC-SHA256 über `unsub:<userId>:<kategorie>` mit `BETTER_AUTH_SECRET`, `src/lib/email/unsubscribe.ts`).
`POST` auf dieselbe URL ist der One-Click-Weg für Gmail/Apple Mail (`List-Unsubscribe-Post`).
`system` lässt sich über den Link nicht abbestellen (400).

## Admin

- Kundenansicht `/admin/users/[id]`: Karte „E-Mail-Benachrichtigungen“ mit Erlaubt/Abbestellt je Kategorie
  und Datum der letzten Änderung. Nur Anzeige, die Entscheidung liegt beim Nutzer.
- `/admin/emails`: Spalte Kategorie, Status „Abbestellt“; übersprungene Mails zählen nicht gegen das Resend-Kontingent.
