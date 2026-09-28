# Template: Der Vitalcheck

**Branche:** Unabhängige Vertriebspartner der PM-International (FitLine) – Lead-Generierung
**Zielgruppe der Seite:** Erwachsene, die wissen wollen, wie vital ihr Alltag wirklich ist (Freunde, Bekannte, Social-Media-Kontakte des Partners)
**Nutzen für den FinestSites-User:** Sammelt qualifizierte Leads inkl. Antworten, Wünschen, Motiven und Kontaktwunsch, um präzise beraten zu können

## Kernidee

Ein 3-Minuten-Check mit **20 positiv formulierten Alltags-Aussagen** in fünf Bereichen (Ernährung & Trinken, Energie & Fokus, Schlaf & Erholung, Bewegung & Fitness, Balance & Wohlbefinden). Das Ergebnis („Vitalporträt“: Radar, Vital-Level, Stärke, größter Hebel, drei Alltagstipps) wird **auf dem Gerät berechnet** und sofort angezeigt. Erst danach kann die Person freiwillig ihr Porträt an den Partner schicken (Lead-Formular mit ausdrücklicher Einwilligung).

Konzept, Psychologie, Rechtsgrundlagen und Fragen-Mapping: `docs/konzept-vitalcheck.html`

## Sektionen

1. Navigation (Avatar, Name, Links, DE/EN, CTA)
2. Hero mit animiertem Vitalporträt-Preview
3. PM-Disclaimer-Leiste (Pflichttext, gendert nach `geschlecht`)
4. So funktioniert's (3 Schritte)
5. Die 5 Bereiche + Hinweis „keine Diagnose“
6. Über mich (`about_bild`, `about_intro`, `about_me_html` mit KI-Compliance-Check)
7. FAQ (5 Fragen inkl. „Ist das ein medizinischer Test?“ und „Muss ich etwas kaufen?“)
8. CTA-Banner
9. Footer (Impressum/Datenschutz auf `/impressum`, `/datenschutz`, Disclaimer, Made with ♥)
10. Check-Overlay (Wünsche → 5 × 4 Aussagen mit Zwischenstopps → Antrieb → Investition → Ergebnis → Lead-Formular → Erfolg)
11. Cookie-Banner (identisch zu cellRESET/PM Business, nur nicht-blockierend)

## Design

- Fonts: DM Sans + Instrument Serif (Akzentwörter kursiv), wie PM Business / cellRESET
- 6 Farbthemen: mint (Default), ocean, coral, violet, sun, midnight (dunkel)
- Keine Fotos nötig außer Profil- und Über-mich-Bild: Hero-Visual ist das animierte Radar

## Personalisierbar (Schema)

| Feld | Typ | Zweck |
|---|---|---|
| `vorname`, `nachname`, `profilbild`, `geschlecht` | Profil | Name, Avatar, Gendering des Disclaimers |
| `email_benachrichtigung` | email | Empfänger der Check-Ergebnisse (`_recipient`) |
| `whatsapp_nummer` | text | Optionaler WhatsApp-Button nach dem Absenden + Footer-Link |
| `farbthema` | card_select | 6 Themes |
| `frage_motive` | section_toggle | Motiv-Frage an/aus |
| `frage_investition` | section_toggle | Investitions-Frage an/aus |
| `about_bild`, `about_intro`, `about_me_html` | Inhalte | Über-mich-Sektion |

Tags in der DB: `["pm-international", "fitline", "vitalcheck", "leads", "multilingual"]`

## Formular `kontakt` – Felder, die ankommen (alle Strings)

`name`, `email`, `phone`, `kontakt_weg` (email/telefon/whatsapp), `interesse`, `nachricht`, `vital_level` („Auf Kurs (22/40)“), `staerke`, `hebel`, `wuensche`, `antriebsmotive`, `investition_pro_tag`, `sprache`, `dsgvo_einwilligung` (ja + Zeitstempel), `score_ernaehrung` … `score_balance` („5/8“), `antworten_ernaehrung` … `antworten_balance` (lesbare Einzelantworten)

Vorschlag für `form_schemas`:

```sql
INSERT INTO form_schemas (template_id, form_name, title, fields, email_notification_enabled)
VALUES (
  '{templateId}', 'kontakt', 'Vitalcheck-Ergebnis',
  '[{"key":"name","label":"Name"},{"key":"email","label":"E-Mail"},{"key":"phone","label":"Telefon"},{"key":"kontakt_weg","label":"Gewünschter Kontaktweg"},{"key":"interesse","label":"Interesse"},{"key":"vital_level","label":"Vital-Level"},{"key":"staerke","label":"Stärke"},{"key":"hebel","label":"Größter Hebel"},{"key":"wuensche","label":"Wünsche"},{"key":"antriebsmotive","label":"Antriebsmotive"},{"key":"investition_pro_tag","label":"Investition pro Tag"},{"key":"score_ernaehrung","label":"Ernährung & Trinken"},{"key":"antworten_ernaehrung","label":"Antworten Ernährung"},{"key":"score_energie","label":"Energie & Fokus"},{"key":"antworten_energie","label":"Antworten Energie"},{"key":"score_schlaf","label":"Schlaf & Erholung"},{"key":"antworten_schlaf","label":"Antworten Schlaf"},{"key":"score_bewegung","label":"Bewegung & Fitness"},{"key":"antworten_bewegung","label":"Antworten Bewegung"},{"key":"score_balance","label":"Balance & Wohlbefinden"},{"key":"antworten_balance","label":"Antworten Balance"},{"key":"nachricht","label":"Nachricht"},{"key":"sprache","label":"Sprache"},{"key":"dsgvo_einwilligung","label":"Einwilligung"}]'::jsonb,
  true
);
```

## Rechtliche Leitplanken (im Template fest eingebaut)

- Keine Produktnamen, keine Wirk- oder Heilaussagen, keine Krankheits-/Symptomfragen (HWG § 1, § 3, § 11, § 12; LMIV Art. 7 Abs. 3; HCVO)
- Alle 20 Aussagen sind Gewohnheiten, positiv formuliert; die Auswertung spricht nur über Gewohnheiten und Routinen, nie über Gesundheitszustand
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
