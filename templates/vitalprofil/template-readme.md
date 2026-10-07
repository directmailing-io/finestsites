# Template: Dein Vitalprofil (`vitalprofil.net`)

Profilseite mit eingebautem Vitalprofil für PM-International-Teampartner. Gleiche 20 Verhaltens-Aussagen und Rechtsleitplanken wie `templates/vitalcheck/` (siehe dort und `docs/konzept-vitalcheck.html`), aber als **Profilseite wie die Linkseite** (`templates/lnko-bio/`) mit dem Check direkt darunter. Produktname auf der Seite: **Vitalprofil** (nicht mehr „Vitalcheck“). Früherer Ordnername: `templates/vitalcheck-b/`.

Template-ID in der DB: `8a3ef41a-78fa-419d-937d-ccc7b552da1a` (Status `published`, `is_test = true` bis zur Freigabe).

## Aufbau

Eine ruhige Spalte (600 px), jede Einheit eine weiße Karte. Kein Ansichtswechsel: Das Profil bleibt oben stehen, darunter läuft alles in Karten. Hintergrund: Verlauf in der Themenfarbe hinter dem Profil (zwei weiche Lichtflecken + vertikaler Übergang), der nach 760 px in die ruhige Seitenfarbe ausläuft.

1. **Profil**: Profilbild 112 px (weißer Ring, farbiger Schatten), Name, kurzer Text, Social-Icons (Instagram, TikTok, Facebook, YouTube, LinkedIn, WhatsApp, E-Mail; nur gesetzte). Keine Rollenzeile; die PM-Kennzeichnung steht im Footer und in der Beratungs-Karte. Rechts oben nur der Sprachschalter.
   **Duo** (`partner_modus=duo`): zwei Fotos leicht überlappend, gemeinsamer Name (gleicher Nachname → „Daniel & Anna Kurzeja“, sonst „Daniel Kurzeja & Anna Müller“, in JS), gemeinsamer Text (Standardtext auf „wir“), zwei Kontaktspalten mit Vorname und eigener Icon-Zeile. Duo zieht sich durch Signatur, Beratungs-Karte, Formular, Einwilligung, Danke-Seite (zwei WhatsApp-Buttons) und Footer.
2. **Check-Karte**: „Schritt n von 8“ mit Balken, Wünsche → fünf Bereiche (vier Aussagen als Abschnitte, fünfstufige Skala in Akzent-Abstufungen) → Motive (abschaltbar) → Tagesbudget (abschaltbar) → Reveal. „Weiter“ volle Breite, „Zurück“ als Textlink.
3. **Auswertung** als Kartenfolge: Typ-Karte im Farbverlauf (Abzeichen, Typ, Merkmale, Vitallevel, größter Hebel, fünf Bereichs-Ringe, **Teilen** + **Als Story speichern**, Signatur mit Foto) → Beratungs-Karte (einmal) → Dein Tag → Deine fünf Bereiche → Drei Dinge (mit Wunsch-Rückbezug) → **Meine Seiten** (optional, eigene Karte) → Werkzeuge (Beratung anfragen, Story, Nochmal). Teilen: Web Share mit Story-PNG + Text + URL, sonst Link kopieren. Story-PNG 1080×1920, gebaut für Instagram-Safe-Zones (oben/unten je 250 px frei): „MEIN VITALPROFIL“, Abzeichen, „Ich bin … Der Nachtruhe-Typ“, Level-Pille, fünf Balken in Bereichsfarbe, unten eine weiße CTA-Karte „Welcher Vital-Typ bist du? · 20 Aussagen · 3 Minuten · kostenlos“ mit der Seitenadresse als farbige Pille (ohne Host: „Vitalprofil von {Name}“). Share-Text: „Ich bin {Typ} ({n} %). Welcher Vital-Typ bist du? 20 Aussagen, 3 Minuten, kostenlos: {URL}“. Die Typ-Karte hat `isolation: isolate`, die Deko-Kreise liegen mit `z-index: 0` und `pointer-events: none` unter den Buttons (Safari malte `::after` sonst über „Teilen“).
4. **Formular** (`/.finestsites/forms/kontakt`, `_recipient`, Honeypot, Einwilligung Art. 9) und **Danke** als Karten. Payload-Schlüssel: `name`, `email`, `telefon`, `kontaktweg`, `interesse`, `nachricht`, `vitaltyp`, `vitallevel`, `staerke`, `hebel`, `wuensche`, `antriebsmotive`, `budget_pro_tag`, `bereich_{ernaehrung,tag,schlaf,bewegung,ausgleich}` (erste Zeile „12/16 · 75 %“, dann je Aussage eine Zeile „Aussage: Antwort“), `sprache`, `einwilligung`. Der Worker baut daraus eine strukturierte Mail (`vitalprofilMailBody`: Kontakt → Profil-Kacheln → fünf Bereiche mit Balken und Antworten), Betreff „Vitalprofil von {Name}: {Typ}“; im Dashboard erscheinen die Blöcke mit Zeilenumbrüchen.
5. **Footer**: dunkler Streifen volle Breite, Profil + PM-Kennzeichnung, zwei Icon-Zeilen (Daten bleiben bei dir · Selbsteinschätzung, keine Diagnose), unten „© Jahr Name · Impressum · Datenschutz“ und „Made with ♥ von FinestSites“ mit Logo.

Sechs Farbthemen `gruen` (Standard), `orange`, `rot`, `blau`, `violett`, `nacht`, jeweils Akzent + Verlauf (`--wash-a/-b/-c`).

## Editor (so einfach wie bei den anderen Templates)

- **Aus dem Profil übernommen** beim Anlegen der Seite (`src/app/api/sites/route.ts`, `profileToPlaceholders`) und beim Öffnen des Editors (`PROFILE_KEY_MAP` in `edit/page.tsx`): `vorname`, `nachname`, `profilbild`, `instagram`, `facebook`, `linkedin`, `tiktok`, `youtube` (Handle aus der Profil-URL), `whatsapp_nummer` (aus der Profil-Telefonnummer als Ziffern). Felder für Person 2 (`*2`) bleiben leer, das Profil gehört dem Kontoinhaber.
- **Social-Links**: Benutzername oder kompletter Link, die Engine (`rewriteSocialHrefs`) macht daraus gültige Links; WhatsApp wird normalisiert.
- **Eigener Text** `intro`: Richtext (400 Zeichen) mit **KI-Compliance-Check** (`compliance_check: true`, Freigabe liegt in `intro__chk`). Leer = Standardtext DE/EN; ein leeres Feld gilt als geprüft (kein „Prüfen“-Knopf, nur ein Hinweis), erst eigener Text löst den Check aus.
- **Duo**: `partner_modus` (Nur ich / Wir zu zweit) wie bei cellRESET; die `*2`-Felder erscheinen nur im Duo (`show_when`), farblich als Person 2 markiert (`color_tag`).
- **Meine Seiten**: Loop `links` mit `site_picker_only` + `prefill_sites`. Beim Anlegen der Seite werden alle veröffentlichten Seiten des Nutzers eingetragen (Titel = Template-Titel, URL = eigene Domain oder username.domain); im Editor keine freie URL, jede Seite nur einmal wählbar, „hinzufügen“ verschwindet, wenn alle Seiten drin sind.
- Abschnitte im Editor: Profil · Social Media · Kontakt · Meine Seiten · Design. Motiv- und Budget-Frage werden immer gestellt (Entscheidung 07.10.2026).

## Rechtliches

- **Kein Freitext in der Auswertung** (Entscheidung 07.10.2026): Ein FitLine-Erfahrungsbericht neben dem Gewohnheits-Ergebnis wäre im Gesamteindruck eine gesundheitsbezogene Angabe (HCVO Art. 10, Art. 12 lit. c), dazu UWG § 5 und PM-Richtlinien. Eine KI-Prüfung reicht nicht, weil Wirkung aus Kontext entsteht und FinestSites mit „geprüft“ in Mitverantwortung käme. Eigener Text nur im Profil-Intro, dort mit Compliance-Check.
- **Seiten-Links**: nur eigene veröffentlichte FinestSites-Seiten, eigener Block, für alle gleich, fester Hinweis „keine Empfehlung aus deinem Vitalprofil“. Begründung siehe Abschnitt unten.
- **Impressum/Datenschutz** kommen vom Worker (`/impressum`, `/datenschutz`), Design `vitalprofil.net` in `LEGAL_DESIGNS`, Akzent je `farbthema`. Die Datenschutzerklärung enthält für diese Domain einen eigenen Abschnitt „Vitalprofil (Selbsteinschätzung zu Alltagsgewohnheiten)“: Auswertung im Browser, Übertragung nur mit Formular, Art. 6 Abs. 1 lit. a + Art. 9 Abs. 2 lit. a, FinestSites als Auftragsverarbeiter, Widerruf, Löschung. Damit ist der offene Punkt aus der Risikomatrix (Worker-Datenschutzerklärung) geschlossen.

### Rechtlicher Rahmen der Seiten-Links

Problem: Ein Link aus einer Gewohnheits-Auswertung auf eine Produktseite kann im Gesamteindruck als „das Produkt hilft bei den geprüften Bereichen“ gelesen werden (HCVO Art. 10, UWG § 5, Linkhaftung). Lösung: Auswertung nennt nie ein Produkt; Links sind ein Profil-Element in eigener Karte mit festem Hinweissatz, erst nach der Beratungs-Karte; keine Logik nach Score/Typ; nur veröffentlichte eigene Seiten; kommerzielle Absicht durch Kennzeichnung erkennbar. Restrisiko niedrig bis mittel.

## Rollout-Stand (07.10.2026)

Alles eingerichtet, Template läuft live, aber **nur für den Admin sichtbar** (Stand nach der Editor-Runde vom 07.10.):

- Zone `vitalprofil.net` (ID `649f7422ce4f0d12dc89228530b39997`, Account `bc6cb133…`), Wildcard-A `*` und Apex `@` → 192.0.2.1 proxied
- Worker-Route `*.vitalprofil.net/*` aktiv, Worker deployt (Legal-Design, Datenschutz-Abschnitt „Vitalprofil“)
- R2: `templates/8a3ef41a-78fa-419d-937d-ccc7b552da1a/index.html` + `assets/fs-logo.svg` (`--remote`)
- DB: `status = 'published'`, **`is_test = true`** → auf Startseite und `/vorlagen` unsichtbar, im Dashboard nur für Nutzer mit `template_access`-Eintrag (aktuell: Admin `demo`)
- Demo-Seite: `https://demo.vitalprofil.net` (Site `f838a210-…`, Daten aus dem Admin-Profil, Farbthema grün, Links auf demo.lnko.me und demo.wellpreneur.io)
- Thumbnail `public/previews/vitalprofil.jpg` = Screenshot der Live-Demo (1280×800)
- `/impressum` und `/datenschutz` auf der Demo geprüft (200, Vitalprofil-Abschnitt vorhanden)

**Freigabe für alle Nutzer** (ein SQL, danach erscheint die Vorlage automatisch als Premium auf der Startseite und unter `/vorlagen`, Badge „NEU“, Sortierung 40):
```sql
UPDATE templates SET is_test = false, updated_at = now() WHERE id = '8a3ef41a-78fa-419d-937d-ccc7b552da1a';
```
Vorher noch offen: Formular-Testsendung auf der Demo (Mail an info@daniel-kurzeja.de), Story-Export am Handy, Duo-Testseite. Nach einem Template-Update in R2: KV-Purge für `demo.vitalprofil.net` (`POST /.finestsites/kv {"action":"purge"}` mit `Authorization: Bearer WORKER_SECRET`).

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
