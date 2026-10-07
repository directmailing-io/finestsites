# Template: Dein Vitalprofil (`vitalprofil.net`)

Profilseite mit eingebautem Vitalprofil für PM-International-Teampartner. Gleiche 20 Verhaltens-Aussagen und Rechtsleitplanken wie `templates/vitalcheck/` (siehe dort und `docs/konzept-vitalcheck.html`), aber als **Profilseite wie die Linkseite** (`templates/lnko-bio/`) mit dem Check direkt darunter. Produktname auf der Seite: **Vitalprofil** (nicht mehr „Vitalcheck“). Früherer Ordnername: `templates/vitalcheck-b/`.

Template-ID in der DB: `8a3ef41a-78fa-419d-937d-ccc7b552da1a` (Status `coming_soon`, `is_test = true`, bis Domain und R2 stehen).

## Aufbau

Eine ruhige Spalte (600 px), jede Einheit eine weiße Karte. Kein Ansichtswechsel: Das Profil bleibt oben stehen, darunter läuft alles in Karten. Hintergrund: Verlauf in der Themenfarbe hinter dem Profil (zwei weiche Lichtflecken + vertikaler Übergang), der nach 760 px in die ruhige Seitenfarbe ausläuft.

1. **Profil**: Profilbild 112 px (weißer Ring, farbiger Schatten), Name, kurzer Text, Social-Icons (Instagram, TikTok, Facebook, YouTube, LinkedIn, WhatsApp, E-Mail; nur gesetzte). Keine Rollenzeile; die PM-Kennzeichnung steht im Footer und in der Beratungs-Karte. Rechts oben nur der Sprachschalter.
   **Duo** (`partner_modus=duo`): zwei Fotos leicht überlappend, gemeinsamer Name (gleicher Nachname → „Daniel & Anna Kurzeja“, sonst „Daniel Kurzeja & Anna Müller“, in JS), gemeinsamer Text (Standardtext auf „wir“), zwei Kontaktspalten mit Vorname und eigener Icon-Zeile. Duo zieht sich durch Signatur, Beratungs-Karte, Formular, Einwilligung, Danke-Seite (zwei WhatsApp-Buttons) und Footer.
2. **Check-Karte**: „Schritt n von 8“ mit Balken, Wünsche → fünf Bereiche (vier Aussagen als Abschnitte, fünfstufige Skala in Akzent-Abstufungen) → Motive (abschaltbar) → Tagesbudget (abschaltbar) → Reveal. „Weiter“ volle Breite, „Zurück“ als Textlink.
3. **Auswertung** als Kartenfolge: Typ-Karte im Farbverlauf (Abzeichen, Typ, Merkmale, Vitallevel, größter Hebel, fünf Bereichs-Ringe, **Teilen** + **Als Story speichern**, Signatur mit Foto) → Beratungs-Karte (einmal) → Dein Tag → Deine fünf Bereiche → Drei Dinge (mit Wunsch-Rückbezug) → **Meine Seiten** (optional, eigene Karte) → Werkzeuge (Beratung anfragen, Story, Nochmal). Teilen: Web Share mit Story-PNG + Text + URL, sonst Link kopieren. Story-PNG 1080×1920 endet mit „Erstell dein eigenes Vitalprofil auf {host}“.
4. **Formular** (`/.finestsites/forms/kontakt`, `_recipient`, Honeypot, Einwilligung Art. 9) und **Danke** als Karten.
5. **Footer**: dunkler Streifen volle Breite, Profil + PM-Kennzeichnung, zwei Icon-Zeilen (Daten bleiben bei dir · Selbsteinschätzung, keine Diagnose), unten „© Jahr Name · Impressum · Datenschutz“ und „Made with ♥ von FinestSites“ mit Logo.

Sechs Farbthemen `gruen` (Standard), `orange`, `rot`, `blau`, `violett`, `nacht`, jeweils Akzent + Verlauf (`--wash-a/-b/-c`).

## Editor (so einfach wie bei den anderen Templates)

- **Aus dem Profil übernommen** beim Anlegen der Seite (`src/app/api/sites/route.ts`, `profileToPlaceholders`) und beim Öffnen des Editors (`PROFILE_KEY_MAP` in `edit/page.tsx`): `vorname`, `nachname`, `profilbild`, `instagram`, `facebook`, `linkedin`, `tiktok`, `youtube` (Handle aus der Profil-URL), `whatsapp_nummer` (aus der Profil-Telefonnummer als Ziffern). Felder für Person 2 (`*2`) bleiben leer, das Profil gehört dem Kontoinhaber.
- **Social-Links**: Benutzername oder kompletter Link, die Engine (`rewriteSocialHrefs`) macht daraus gültige Links; WhatsApp wird normalisiert.
- **Eigener Text** `intro`: Richtext (400 Zeichen) mit **KI-Compliance-Check** (`compliance_check: true`, Freigabe liegt in `intro__chk`). Leer = Standardtext DE/EN.
- **Duo**: `partner_modus` (Nur ich / Wir zu zweit) wie bei cellRESET; die `*2`-Felder erscheinen nur im Duo (`show_when`), farblich als Person 2 markiert (`color_tag`).
- **Meine Seiten**: Loop `links` mit `site_picker_only`; der Editor erlaubt keine freie URL, nur veröffentlichte Seiten aus dem eigenen Konto.
- **Check anpassen**: Motiv-Frage und Budget-Frage als Section-Toggles.
- Abschnitte im Editor: Profil · Social Media · Kontakt · Meine Seiten · Design · Vitalprofil anpassen.

## Rechtliches

- **Kein Freitext in der Auswertung** (Entscheidung 07.10.2026): Ein FitLine-Erfahrungsbericht neben dem Gewohnheits-Ergebnis wäre im Gesamteindruck eine gesundheitsbezogene Angabe (HCVO Art. 10, Art. 12 lit. c), dazu UWG § 5 und PM-Richtlinien. Eine KI-Prüfung reicht nicht, weil Wirkung aus Kontext entsteht und FinestSites mit „geprüft“ in Mitverantwortung käme. Eigener Text nur im Profil-Intro, dort mit Compliance-Check.
- **Seiten-Links**: nur eigene veröffentlichte FinestSites-Seiten, eigener Block, für alle gleich, fester Hinweis „keine Empfehlung aus deinem Vitalprofil“. Begründung siehe Abschnitt unten.
- **Impressum/Datenschutz** kommen vom Worker (`/impressum`, `/datenschutz`), Design `vitalprofil.net` in `LEGAL_DESIGNS`, Akzent je `farbthema`. Die Datenschutzerklärung enthält für diese Domain einen eigenen Abschnitt „Vitalprofil (Selbsteinschätzung zu Alltagsgewohnheiten)“: Auswertung im Browser, Übertragung nur mit Formular, Art. 6 Abs. 1 lit. a + Art. 9 Abs. 2 lit. a, FinestSites als Auftragsverarbeiter, Widerruf, Löschung. Damit ist der offene Punkt aus der Risikomatrix (Worker-Datenschutzerklärung) geschlossen.

### Rechtlicher Rahmen der Seiten-Links

Problem: Ein Link aus einer Gewohnheits-Auswertung auf eine Produktseite kann im Gesamteindruck als „das Produkt hilft bei den geprüften Bereichen“ gelesen werden (HCVO Art. 10, UWG § 5, Linkhaftung). Lösung: Auswertung nennt nie ein Produkt; Links sind ein Profil-Element in eigener Karte mit festem Hinweissatz, erst nach der Beratungs-Karte; keine Logik nach Score/Typ; nur veröffentlichte eigene Seiten; kommerzielle Absicht durch Kennzeichnung erkennbar. Restrisiko niedrig bis mittel.

## Rollout (nach `docs/new-template-checklist.md`)

Erledigt (07.10.2026):
- [x] Template, Schema v2, Readme im Repo (`templates/vitalprofil/`)
- [x] Editor: `site_picker_only` (deployt)
- [x] Worker: `LEGAL_DESIGNS['vitalprofil.net']`, Theme-Akzente, Datenschutz-Abschnitt (Code im Repo; Worker-Deploy siehe unten)
- [x] DB-Row `8a3ef41a-…` aktualisiert: Titel „Dein Vitalprofil“, slug `vitalprofil`, domain `vitalprofil.net`, Schema, Tags, `is_test = true`, Status `coming_soon`
- [x] `form_schemas`-Row `kontakt` („Beratungsanfrage Vitalprofil“) angelegt
- [x] Preview-Bild `public/previews/vitalprofil.jpg`

Offen (braucht die Domain):
1. **Domain** `vitalprofil.net` bei Cloudflare registrieren (Account `6d5e22b7…`), Zone-ID notieren.
2. CF Dashboard: Proxied Wildcard-A `*.vitalprofil.net → 192.0.2.1`.
3. `cloudflare-worker/wrangler.toml`: den vorbereiteten `[[routes]]`-Block für `*.vitalprofil.net/*` aktivieren und die Zone-ID eintragen.
4. Worker vom App-Server deployen:
   `ssh -i ~/.ssh/finestsites_hetzner root@188.245.35.52 "cd /var/www/finestsites && git pull origin main && cd cloudflare-worker && CLOUDFLARE_API_TOKEN=… npx wrangler deploy --config wrangler.toml"`
5. R2 (mit `--remote`!): `templates/8a3ef41a-78fa-419d-937d-ccc7b552da1a/index.html` und `assets/fs-logo.svg` hochladen. `assets/hero.jpg` wird nicht mehr gebraucht.
6. Health-Check `curl https://test.vitalprofil.net/.finestsites/health` → 200; `/impressum` und `/datenschutz` auf einer Testseite prüfen (Abschnitt „Vitalprofil“ sichtbar).
7. Testseite als Test-Account anlegen (Solo und Duo), Formular absenden, Mail an `email_benachrichtigung` prüfen (Betreff „Neue Anfrage: Beratungsanfrage Vitalprofil“), Story-Export auf dem Handy.
8. Freigabe: `status = 'published'`, `is_test = false`. Marketing-Seite `/vorlagen/vitalprofil` (detail_content) kann danach gefüllt werden.

## Lokale Vorschau

```
npx tsx scripts/render-template-preview.ts vitalprofil --theme gruen                       # Startseite
npx tsx scripts/render-template-preview.ts vitalprofil --theme gruen --result              # Auswertung
npx tsx scripts/render-template-preview.ts vitalprofil --theme gruen --result --step lead  # Formular (auch area:1, done)
npx tsx scripts/render-template-preview.ts vitalprofil --theme blau --duo [--result]       # Duo-Modus
```
Dateien in `preview-lokal/` (gitignored).

## Hinweis Zufriedenheitsgarantie

PM-International gewährt Kunden laut AGB eine 30-tägige Rückgabegarantie ab Rechnungsdatum. Der CTA-Text muss zu den aktuellen PM-Bedingungen passen; bei Änderung anpassen.
