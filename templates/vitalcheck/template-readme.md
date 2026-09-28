# Template: Der Vitalcheck

**Branche:** Unabhängige Vertriebspartner der PM-International (FitLine) – Lead-Generierung
**Zielgruppe der Seite:** Erwachsene, die wissen wollen, wie vital ihr Alltag wirklich ist (Freunde, Bekannte, Social-Media-Kontakte des Partners)
**Nutzen für den FinestSites-User:** Sammelt qualifizierte Leads inkl. Antworten, Wünschen, Motiven und Kontaktwunsch, um präzise beraten zu können

## Kernidee

Die Seite **ist** der Check. Ein 3-Minuten-Check mit **20 reinen Verhaltens-Aussagen** (beobachtbare Gewohnheiten, keine Befindlichkeiten) in fünf Bereichen (Ernährung & Trinken, Tagesstruktur & Pausen, Schlaf & Abschalten, Bewegung & Fitness, Ausgleich & Zeit für dich). Das Ergebnis (Gewohnheits-Level, Radar, Stärke, größter Hebel, drei Alltagstipps) wird **auf dem Gerät berechnet** und sofort angezeigt. Erst danach kann die Person freiwillig ihr Ergebnis an den Partner schicken (Lead-Formular mit ausdrücklicher Einwilligung).

Konzept, Psychologie, Rechtsgrundlagen und Fragen-Mapping: `docs/konzept-vitalcheck.html`

## Aufbau (App-Karte, max. 720 px)

1. Leiste: Avatar + Name, Sprachschalter mit Flaggen (DE/EN)
2. Bereichs-Fortschritt: 5 Icons (Ernährung, Tagesstruktur, Schlaf, Bewegung, Ausgleich) mit Füllbalken, aktueller Bereich hervorgehoben, fertige Bereiche mit Haken
3. **Die Karte = der Check**, startet ohne Intro direkt mit Schritt 1 (Wünsche, mit kurzer Kopfzeile „Wie vital ist dein Alltag?“) → 5 × 4 Aussagen als Antwortkarten mit Icon-Faces (✓ / – / ✕, Tasten 1-2-3) → Zwischenstopp nach jedem Bereich (Pop-Haken + „Gut zu wissen“) → Antrieb (optional) → Investition (optional, Standard aus) → Ergebnis (Konfetti, Radar, Gewohnheits-Level, Stärke/Hebel, 5 Bereiche, 3 Tipps, Wunsch) → Einladung zum Gespräch → Lead-Formular → Danke
4. PM-Disclaimer-Leiste (Pflichttext, gendert nach `geschlecht`)
5. Footer (Kontakt, `/impressum`, `/datenschutz`, Selbsteinschätzungs-Hinweis, Made by finestsites)
6. Cookie-Banner (identisch zu cellRESET/PM Business, nur nicht-blockierend)

Kein „Über mich“: Die Seite besteht nur aus dem Check. Der Berater erscheint mit Foto und Name in der Leiste, in der Pflichtkennzeichnung und in der Einladung am Ende.

## Design

- Font: **Geist** (wie die FinestSites-App), keine Serif, keine Glow-Blobs, keine Feature-Kacheln
- Getönter Hintergrund je Theme, weiße Karte mit weichem Schatten, Akzentfarbe für Buttons, Auswahl, Fortschritt und Radar
- 6 Themes: mint (Default), ocean, coral, violet, sun, midnight (dunkel)
- Keine Fotos nötig außer dem Profilbild

## Personalisierbar (Schema)

| Feld | Typ | Zweck |
|---|---|---|
| `vorname`, `nachname`, `profilbild`, `geschlecht` | Profil | Name, Avatar, Gendering des Disclaimers |
| `email_benachrichtigung` | email | Empfänger der Check-Ergebnisse (`_recipient`) |
| `whatsapp_nummer` | text | Optionaler WhatsApp-Button nach dem Absenden + Footer-Link |
| `farbthema` | card_select | 6 Themes |
| `frage_motive` | section_toggle | Motiv-Frage an/aus |
| `frage_investition` | section_toggle | Investitions-Frage an/aus (Standard aus, siehe Rechtsprüfung) |

Tags in der DB: `["pm-international", "fitline", "vitalcheck", "leads", "multilingual"]`

## Formular `kontakt` – Felder, die ankommen (alle Strings)

`name`, `email`, `phone`, `kontakt_weg` (email/telefon/whatsapp), `interesse`, `nachricht`, `gewohnheits_level` („Auf Kurs (22/40)“), `staerke`, `hebel`, `wuensche`, `antriebsmotive`, `investition_pro_tag`, `sprache`, `dsgvo_einwilligung` (ja + Zeitstempel), `score_ernaehrung`, `score_tag`, `score_schlaf`, `score_bewegung`, `score_ausgleich` („5/8“), `antworten_ernaehrung` … `antworten_ausgleich` (lesbare Einzelantworten)

Vorschlag für `form_schemas`:

```sql
INSERT INTO form_schemas (template_id, form_name, title, fields, email_notification_enabled)
VALUES (
  '{templateId}', 'kontakt', 'Vitalcheck-Ergebnis',
  '[{"key":"name","label":"Name"},{"key":"email","label":"E-Mail"},{"key":"phone","label":"Telefon"},{"key":"kontakt_weg","label":"Gewünschter Kontaktweg"},{"key":"interesse","label":"Interesse"},{"key":"gewohnheits_level","label":"Gewohnheits-Level"},{"key":"staerke","label":"Stärke"},{"key":"hebel","label":"Größter Hebel"},{"key":"wuensche","label":"Wünsche"},{"key":"antriebsmotive","label":"Antriebsmotive"},{"key":"investition_pro_tag","label":"Investition pro Tag"},{"key":"score_ernaehrung","label":"Ernährung & Trinken"},{"key":"antworten_ernaehrung","label":"Antworten Ernährung"},{"key":"score_tag","label":"Tagesstruktur & Pausen"},{"key":"antworten_tag","label":"Antworten Tagesstruktur"},{"key":"score_schlaf","label":"Schlaf & Abschalten"},{"key":"antworten_schlaf","label":"Antworten Schlaf"},{"key":"score_bewegung","label":"Bewegung & Fitness"},{"key":"antworten_bewegung","label":"Antworten Bewegung"},{"key":"score_ausgleich","label":"Ausgleich & Zeit für dich"},{"key":"antworten_ausgleich","label":"Antworten Ausgleich"},{"key":"nachricht","label":"Nachricht"},{"key":"sprache","label":"Sprache"},{"key":"dsgvo_einwilligung","label":"Einwilligung"}]'::jsonb,
  true
);
```

## Rechtliche Leitplanken (im Template fest eingebaut)

- Keine Produktnamen, keine Wirk- oder Heilaussagen, keine Krankheits-/Symptomfragen (HWG § 1, § 3, § 11, § 12; LMIV Art. 7 Abs. 3; HCVO)
- Alle 20 Aussagen sind beobachtbares Verhalten, positiv formuliert (keine Befindlichkeiten wie „Ich wache erholt auf“); die Auswertung spricht nur über Gewohnheiten und Routinen, nie über Gesundheitszustand
- Kritische Prüfung „Auswertung + Beratungsangebot“ und Verhaltensregeln fürs Gespräch: `docs/konzept-vitalcheck.html`, Abschnitt 5b
- Tipps sind allgemeine Empfehlungen (DGE, WHO, National Sleep Foundation) ohne Produktbezug
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
