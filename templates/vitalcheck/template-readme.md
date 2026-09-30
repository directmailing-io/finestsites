# Template: Der Vitalcheck

**Branche:** Unabhängige Vertriebspartner der PM-International (FitLine) – Lead-Generierung
**Zielgruppe der Seite:** Erwachsene, die wissen wollen, wie vital ihr Alltag wirklich ist (Freunde, Bekannte, Social-Media-Kontakte des Partners)
**Nutzen für den FinestSites-User:** Sammelt qualifizierte Leads inkl. Antworten, Wünschen, Motiven und Kontaktwunsch, um präzise beraten zu können

## Kernidee

Die Seite **ist** der Check. Ein 3-Minuten-Check mit **20 reinen Verhaltens-Aussagen** (beobachtbare Gewohnheiten, keine Befindlichkeiten) in fünf Bereichen (Ernährung & Trinken, Tagesstruktur & Pausen, Schlaf & Abschalten, Bewegung & Fitness, Ausgleich & Zeit für dich). Das Ergebnis (Gewohnheits-Level, Radar, Stärke, größter Hebel, drei Alltagstipps) wird **auf dem Gerät berechnet** und sofort angezeigt. Erst danach kann die Person freiwillig ihr Ergebnis an den Partner schicken (Lead-Formular mit ausdrücklicher Einwilligung).

Konzept, Psychologie, Rechtsgrundlagen und Fragen-Mapping: `docs/konzept-vitalcheck.html`

## Aufbau (Bühne statt Karte, max. 820 px)

1. Ganz oben: 5 Fortschritts-Segmente (je Bereich, füllen sich mit jeder Antwort)
2. Kopfzeile: Zurück-Button (ab Schritt 2), Avatar + Name, Zähler „4 / 22“, Sprachschalter mit Flaggen
3. **Die Bühne = der Check**, ohne Karte, große Typografie (Frage bis 52 px, Start-Headline bis 68 px). Der Hintergrund ist oben sanft in der Farbe des aktuellen Bereichs getönt (Ernährung grün, Tagesstruktur blau, Schlaf indigo, Bewegung koralle, Ausgleich amber) und wechselt weich beim Bereichswechsel.
   Ablauf: Wünsche (mit Kopfzeile „Wie vital ist dein Alltag?“) → 5 × 4 Aussagen als große Antwortzeilen mit Icon-Faces (✓ / – / ✕, Tasten 1-2-3) → Zwischenstopp mit großer Ziffer „1 / 5“ und „Gut zu wissen“ → Antrieb (optional) → Budget-Frage „Was ist dir dein Wohlbefinden pro Tag wert?“ (Standard an, überspringbar) → Ergebnis (Konfetti in Bereichsfarben, Level groß, Zähler, Radar mit farbigen Punkten, Stärke/Hebel, 5 Bereiche mit Prozentzahlen und „Gut zu wissen“-Einordnung zur Versorgung bei mittleren/niedrigen Werten, 3 Tipps mit sichtbarem Bezug: Bereich + niedrigste Antwort, Wunsch, dunkle Gesprächseinladung mit Foto, persönlicher Zeile, 3 Nutzenpunkten) → Formular „Gespräch anfragen“ (Sendebox mit Level/Hebel/Inhalt, Nachricht einklappbar, Vertrauenszeile) → Danke
4. Fuß: Pflichtkennzeichnung mit Avatar, Kontakt/Impressum/Datenschutz, Selbsteinschätzungs-Hinweis, Made by finestsites
5. Cookie-Banner (identisch zu cellRESET/PM Business, nicht-blockierend, Reopener rechts unten)

Kein „Über mich“: Der Berater erscheint mit Foto und Name in der Kopfzeile, in der Pflichtkennzeichnung und in der Einladung am Ende.

## Design

- Font: **Geist** (wie die FinestSites-App), enge Laufweite bei Headlines, Tabellenziffern
- Warmes Off-White (bzw. Midnight dunkel), weiße Flächen nur für interaktive Elemente, 1,5-px-Linien, große Radien, weiche Schatten nur bei Hover
- 6 Akzentfarben (mint Default, ocean, coral, violet, sun, midnight) für Buttons, Auswahl, Segmente; die fünf Bereichsfarben sind fix
- Keine Fotos nötig außer dem Profilbild

## Personalisierbar (Schema)

| Feld | Typ | Zweck |
|---|---|---|
| `vorname`, `nachname`, `profilbild`, `geschlecht` | Profil | Name, Avatar, Gendering des Disclaimers |
| `email_benachrichtigung` | email | Empfänger der Check-Ergebnisse (`_recipient`) |
| `whatsapp_nummer` | text | Optionaler WhatsApp-Button nach dem Absenden + Footer-Link |
| `farbthema` | card_select | 6 Themes |
| `frage_motive` | section_toggle | Motiv-Frage an/aus |
| `frage_investition` | section_toggle | Budget-Frage an/aus (Standard an) |

Tags in der DB: `["pm-international", "fitline", "vitalcheck", "leads", "multilingual"]`

## Formular `kontakt` – Felder, die ankommen (alle Strings)

`name`, `email`, `phone`, `kontakt_weg` (email/telefon/whatsapp), `interesse`, `nachricht`, `vitallevel` („Auf Kurs (22/40)“), `staerke`, `hebel`, `wuensche`, `antriebsmotive`, `investition_pro_tag`, `sprache`, `dsgvo_einwilligung` (ja + Zeitstempel), `score_ernaehrung`, `score_tag`, `score_schlaf`, `score_bewegung`, `score_ausgleich` („5/8“), `antworten_ernaehrung` … `antworten_ausgleich` (lesbare Einzelantworten)

Vorschlag für `form_schemas`:

```sql
INSERT INTO form_schemas (template_id, form_name, title, fields, email_notification_enabled)
VALUES (
  '{templateId}', 'kontakt', 'Vitalcheck-Ergebnis',
  '[{"key":"name","label":"Name"},{"key":"email","label":"E-Mail"},{"key":"phone","label":"Telefon"},{"key":"kontakt_weg","label":"Gewünschter Kontaktweg"},{"key":"interesse","label":"Interesse"},{"key":"vitallevel","label":"Vitallevel"},{"key":"staerke","label":"Stärke"},{"key":"hebel","label":"Größter Hebel"},{"key":"wuensche","label":"Wünsche"},{"key":"antriebsmotive","label":"Antriebsmotive"},{"key":"investition_pro_tag","label":"Investition pro Tag"},{"key":"score_ernaehrung","label":"Ernährung & Trinken"},{"key":"antworten_ernaehrung","label":"Antworten Ernährung"},{"key":"score_tag","label":"Tagesstruktur & Pausen"},{"key":"antworten_tag","label":"Antworten Tagesstruktur"},{"key":"score_schlaf","label":"Schlaf & Abschalten"},{"key":"antworten_schlaf","label":"Antworten Schlaf"},{"key":"score_bewegung","label":"Bewegung & Fitness"},{"key":"antworten_bewegung","label":"Antworten Bewegung"},{"key":"score_ausgleich","label":"Ausgleich & Zeit für dich"},{"key":"antworten_ausgleich","label":"Antworten Ausgleich"},{"key":"nachricht","label":"Nachricht"},{"key":"sprache","label":"Sprache"},{"key":"dsgvo_einwilligung","label":"Einwilligung"}]'::jsonb,
  true
);
```

## Rechtliche Leitplanken (im Template fest eingebaut)

- Keine Produktnamen, keine Wirk- oder Heilaussagen, keine Krankheits-/Symptomfragen (HWG § 1, § 3, § 11, § 12; LMIV Art. 7 Abs. 3; HCVO)
- Alle 20 Aussagen sind beobachtbares Verhalten, positiv formuliert (keine Befindlichkeiten wie „Ich wache erholt auf“); die Auswertung spricht nur über Gewohnheiten und Routinen, nie über Gesundheitszustand
- Kritische Prüfung „Auswertung + Beratungsangebot“ und Verhaltensregeln fürs Gespräch: `docs/konzept-vitalcheck.html`, Abschnitt 5b
- Tipps sind allgemeine Empfehlungen (DGE, WHO, National Sleep Foundation) ohne Produktbezug
- „Gut zu wissen“-Einordnungen (Obst/Gemüse als Vitaminbasis, Tageslicht und Vitamin D, Bedarf bei Bewegung) sind allgemeine Ernährungsfakten in der Sprache „Versorgung im Blick behalten“; keine Produkte, keine Wörter wie Mangel/Defizit/Risiko, keine Wirkaussage
- Ergebnis wird clientseitig berechnet; Übermittlung nur nach aktiver Entscheidung + ausdrücklicher Einwilligung (DSGVO Art. 9 Abs. 2 lit. a, Art. 7), unangekreuzte Checkbox, Widerrufshinweis, Zeitstempel
- Werbezweck transparent: PM-Disclaimer unter dem Hero und im Footer, FAQ „Muss ich etwas kaufen? Nein.“
- Hinweis „Selbsteinschätzung, keine Diagnose“ auf der Seite, im Ergebnis und im Footer; Zielgruppe ab 18

## Lokal testen

```bash
SC=/pfad/zum/scratch
npx tsx $SC/render.ts templates/vitalcheck/index.html $SC/data.json $SC/out.html
```
(Renderer nutzt `src/lib/utils/template-engine.ts`; Beispiel-Daten siehe Konzept-Doku.)

## Rollout (Checkliste `docs/new-template-checklist.md`)

Offen: Domain kaufen → CF-Zone + Wildcard-A + `wrangler.toml`-Route → DB-Row `templates` (bestehende Row „Der VitalCheck“ `8a3ef41a-78fa-419d-937d-ccc7b552da1a` aktualisieren: slug `vitalcheck`, domain, `r2_bundle_path`, `placeholder_schema`, tags, `status`) → `form_schemas`-Row → R2-Upload `index.html` + `assets/fs-logo.svg` (`--remote`) → KV-Purge → Test-Submit an info@daniel-kurzeja.de.
